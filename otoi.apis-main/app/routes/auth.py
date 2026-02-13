from flask import Blueprint, request, jsonify, g, current_app
from flask_jwt_extended import create_access_token
from app.models.user import User, Role
from app.extensions import db
from app.services.mail_service import send_reset_password_email
import os
import jwt
from datetime import datetime, timedelta
from itsdangerous import URLSafeTimedSerializer
import base64

auth_blueprint = Blueprint("auth", __name__)

@auth_blueprint.route("/signup", methods=["POST"])
def signup():
    """
    Register a new user
    ---
    tags:
      - Authentication
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [firstName, lastName, username, email, password]
            properties:
              firstName:
                type: string
                example: "john"
              lastName:
                type: string
                example: "doe"
              username:
                type: string
                example: "john_doe"
              email:
                type: string
                example: "john@example.com"
              mobileNo:
                type: string
                example: "83******25"
              password:
                type: string
                example: "StrongP@ssw0rd"
              role:
                type: string
                description: Role name to assign (defaults to "User")
                example: "User"
    responses:
      201:
        description: User created
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: string
                  example: "550e8400-e29b-41d4-a716-446655440000"
                firstName:
                  type: string
                lastName:
                  type: string
                username:
                  type: string
                email:
                  type: string
                mobileNo:
                  type: string
                role:
                  type: string
                created_at:
                  type: string
      400:
        description: Bad request
    """
    data = request.get_json(silent=True) or {}

    firstName = (data.get("firstName") or "")
    lastName = (data.get("lastName") or "")
    email = (data.get("email") or "").strip().lower()
    mobileNo = (data.get("mobileNo") or "").strip()
    password = data.get("password") or ""
    password_confirmation = data.get("password_confirmation") or data.get("changepassword") or ""
    username = (data.get("username") or (email.split("@")[0] if email else "")).strip()
    # Always default to 'User' role; ignore any incoming role input

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    if password != password_confirmation:
        return jsonify({"error": "password and password_confirmation do not match"}), 400

    # Uniqueness checks
    if User.query.filter_by(username=username).first() is not None:
        return jsonify({"error": "username already exists"}), 400
    if User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "email already exists"}), 400

    # Resolve default role 'User' (auto-create if missing)
    role = Role.query.filter_by(name="User").first()
    if role is None:
        role = Role(name="User")
        db.session.add(role)
        db.session.flush()

    # Create user
    user = User(firstName=firstName, lastName=lastName, username=username, email=email, mobileNo=mobileNo, role=role)
    user.set_password(password)

    # Persist and set audit fields
    db.session.add(user)
    db.session.flush()  # to get user.uuid
    user.created_by = user.uuid
    user.updated_by = user.uuid

    db.session.commit()

    # Issue token like login
    business_id = user.businesses[0].id if user.businesses else None
    token = create_access_token(identity=str(user.uuid), additional_claims={
        "username": user.username,
        "role": user.role.name if user.role else None,
        "business_id": business_id
    })
    # for signup endpoint, return user data in response
    return jsonify({
        "access_token": token, 
        "token_type": "Bearer",
        "user": {
            "id": str(user.uuid),
            "username": user.username,
            "email": user.email,
            "role": user.role.name if user.role else None,
            "business_id": business_id
        }
    }), 201

@auth_blueprint.route("/signup", methods=["POST"])
def register():
    # Alias to support frontend REGISTER_URL
    return signup()

@auth_blueprint.route("/login", methods=["POST"])
def login():
    """
    Login a user
    ---
    tags:
      - Authentication
    consumes:
      - application/json
      - application/x-www-form-urlencoded
    parameters:
      - in: formData
        name: username
        type: string
        required: true
        description: User email (OAuth2 uses username field)
      - in: formData
        name: password
        type: string
        required: true
        description: User password
    responses:
      200:
        description: Successful login
        content:
          application/json:
            schema:
              type: object
              properties:
                access_token:
                  type: string
                token_type:
                  type: string
      401:
        description: Invalid credentials
    """
    try:
        # Handle both JSON and form data
        if request.is_json:
            data = request.get_json()
        elif request.form:
            data = request.form.to_dict()
        else:
            # Try to get JSON as fallback
            data = request.get_json() or {}        
        # Handle OAuth2 password flow - it might send username instead of email
        email = data.get("email") or data.get("username", "")
        password = data.get("password", "")
        
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = User.query.filter_by(email=email).first()

        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        if not user.check_password(password):
            return jsonify({"error": "Invalid password"}), 401

        if not user.isActive:
            return jsonify({"error": "Account Deactivated"}), 403

        business_id = user.businesses[0].id if user.businesses and len(user.businesses) > 0 else None
        
        # Ensure user has a role
        if not user.role:
            return jsonify({"error": "User role not found"}), 403

        token = create_access_token(
            identity=str(user.uuid),
            additional_claims={
                "username": user.username,
                "role": user.role.name,
                "business_id": business_id
            }
        )
        
        g.user_id = user.uuid
        g.business_id = business_id
        
        return jsonify({
            "access_token": token,
            "token_type": "Bearer",
            "user": {
                "id": str(user.uuid),
                "username": user.username,
                "email": user.email,
                "role": user.role.name,
                "business_id": business_id
            }
        }), 200
        
    except Exception as e:
        # Log the error for debugging
        return jsonify({"error": "An error occurred during login. Please try again."}), 500

    return jsonify({"error": "Invalid credentials"}), 401

@auth_blueprint.route("/check-email", methods=["POST"])
def check_email():
    """
    Check if the email exists in the database
    ---
    tags:
      - Authentication
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              email:
                type: string
                example: "user@example.com"
    responses:
      200:
        description: Email found
      404:
        description: Email not found
    """
    data = request.get_json()
    email = data.get("email")
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Email not found"}), 404
    return jsonify({"message": "Email found"}), 200

@auth_blueprint.route("/update-password", methods=["POST"])
def update_password():
    data = request.get_json()
    email = data.get("email")
    new_password = data.get("newPassword")

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Email not found"}), 404

    user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Password updated"}), 200

@auth_blueprint.route("/forgot-password", methods=["POST"])
def forgot_password():
    """
    Step 1: Accept email and send reset link with dynamic JWT
    """
    data = request.get_json()
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # For security, don't reveal if user exists. 
        # But in many CRMs, it's okay. I'll stick to a generic success message or 404 depending on preference.
        # User requested: "Check if the user exists... If found, generate...".
        return jsonify({"error": "User with this email does not exist"}), 404

    # Generate dynamic secret for itsdangerous
    dynamic_secret = current_app.config["SECRET_KEY"] + user.password_hash
    serializer = URLSafeTimedSerializer(dynamic_secret)
    token = serializer.dumps(user.email, salt="password-reset")

    # Base64 encode email for obfuscation in URL
    encoded_email = base64.urlsafe_b64encode(user.email.encode()).decode().rstrip("=")

    frontend_url = current_app.config["FRONTEND_URL"] #change URL based on diff environments
    reset_link = f"{frontend_url}/auth/reset-password/change?token={token}&e={encoded_email}"
    
    if send_reset_password_email(user.email, reset_link, user.firstName):
        return jsonify({"message": "Password reset link sent to your email"}), 200
    else:
        return jsonify({"error": "Failed to send email. Please try again later."}), 500

@auth_blueprint.route("/verify-reset-token", methods=["POST"])
def verify_reset_token():
    """
    Check if a reset token is still valid (on page load)
    """
    data = request.get_json()
    token = data.get("token")
    encoded_email = data.get("e")

    if not token or not encoded_email:
        return jsonify({"error": "Token and encoded email are required"}), 400

    try:
        # Decode base64 email
        missing_padding = len(encoded_email) % 4
        if missing_padding:
            encoded_email += '=' * (4 - missing_padding)
        email = base64.urlsafe_b64decode(encoded_email).decode()
    except Exception:
        return jsonify({"error": "Invalid email encoding"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Verify token using dynamic secret
    dynamic_secret = current_app.config["SECRET_KEY"] + user.password_hash
    serializer = URLSafeTimedSerializer(dynamic_secret)
    try:
        # Verify token (expires in 10 mins = 600s)
        token_email = serializer.loads(token, salt="password-reset", max_age=600)
        if token_email != email:
            return jsonify({"error": "This reset link is not valid for the provided email.", "valid": False}), 400
        
        return jsonify({"message": "Token is valid", "valid": True}), 200
    except Exception:
        return jsonify({"error": "Reset link has expired or is invalid.", "valid": False}), 400

@auth_blueprint.route("/reset-password-confirm", methods=["POST"])
def reset_password_confirm():
    """
    Step 2: Verify token and update password
    """
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("newPassword")
    confirm_password = data.get("confirmPassword")
    encoded_email = data.get("e") 

    if not token or not new_password or not confirm_password or not encoded_email:
        return jsonify({"error": "Token, encoded email, newPassword, and confirmPassword are required"}), 400

    try:
        # Decode base64 email
        # Add padding if necessary
        missing_padding = len(encoded_email) % 4
        if missing_padding:
            encoded_email += '=' * (4 - missing_padding)
        email = base64.urlsafe_b64decode(encoded_email).decode()
    except Exception:
        return jsonify({"error": "Invalid email encoding"}), 400

    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Verify token using dynamic secret
    dynamic_secret = current_app.config["SECRET_KEY"] + user.password_hash
    serializer = URLSafeTimedSerializer(dynamic_secret)
    try:
        # Verify token (expires in 10 mins = 600s)
        token_email = serializer.loads(token, salt="password-reset", max_age=600)
        if token_email != email:
            return jsonify({"error": "This reset link is not valid for the provided email."}), 400
    except Exception:
        # serializer.loads raises BadSignature or SignatureExpired
        return jsonify({"error": "Your reset password token has expired or is invalid. Please request a new link."}), 400

    # Update password
    user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Password has been successfully reset"}), 200
