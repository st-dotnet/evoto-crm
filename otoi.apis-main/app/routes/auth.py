from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import create_access_token
from app.models.user import User, Role
from app.extensions import db
from flask import g

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

    return jsonify({"access_token": token, "token_type": "Bearer"}), 201

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

@auth_blueprint.route("/forgot-password", methods=["POST"])
def forgot_password():
    """
    Request a password reset link via email (Stateless JWT)
    ---
    tags:
      - Authentication
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [email]
            properties:
              email:
                type: string
                example: "user@example.com"
    responses:
      200:
        description: Password reset email sent
      404:
        description: Email not found
      500:
        description: Failed to send email
    """
    from app.services.mail_service import send_password_reset_email
    from flask import current_app
    from app.models.user import PasswordResetToken
    import secrets
    import bcrypt
    from datetime import datetime

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    
    # Generic response regardless of existence to prevent email enumeration
    message = "If an account exists with this email, a password reset link has been sent."

    if user:
        try:
            # Generate secure random token
            token = secrets.token_urlsafe(32)
            token_hash = bcrypt.hashpw(token.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            # Store hashed token in DB
            reset_token = PasswordResetToken(user_id=user.uuid, token_hash=token_hash)
            db.session.add(reset_token)
            db.session.commit()

            # Build the reset link with RAW token
            # Dynamically use the Origin from which the request came
            # Prioritize 'origin' from request body if provided by frontend
            origin = data.get('origin') or request.headers.get('Origin')
            frontend_url = origin.rstrip('/') if origin else current_app.config.get("FRONTEND_URL", "http://localhost:5173").rstrip('/')
            reset_link = f"{frontend_url}/auth/reset-password/change?token={token}"

            # Send the email
            user_name = user.firstName or ""
            send_password_reset_email(user.email, reset_link, user_name)

        except Exception as e:
            # Still return 200 to not leak information, but log the error
            current_app.logger.error(f"Error in forgot_password: {str(e)}")
            pass

    current_app.logger.info(f"Forgot password request for email: {email}")
    return jsonify({"message": message}), 200


@auth_blueprint.route("/validate-reset-token/<token>", methods=["GET"])
def validate_reset_token(token):
    """
    Validate a password reset token (Database Token)
    """
    from app.models.user import PasswordResetToken
    from datetime import datetime
    import bcrypt

    try:
        # Find all active tokens for checking
        # Since we use bcrypt, we have to check each one (slow but secure)
        # Or we could index by user_id if we passed it in the reset link
        # To keep it simple and secure, we'll fetch all unexpired, unused tokens
        active_tokens = PasswordResetToken.query.filter(
            PasswordResetToken.expiry > datetime.utcnow(),
            PasswordResetToken.used == False
        ).all()

        for t in active_tokens:
            if bcrypt.checkpw(token.encode('utf-8'), t.token_hash.encode('utf-8')):
                return jsonify({"message": "Token is valid"}), 200

        return jsonify({"error": "This reset link is invalid or has expired"}), 400

    except Exception:
        return jsonify({"error": "Invalid or expired reset link"}), 400


@auth_blueprint.route("/reset-password", methods=["POST"])
def reset_password():
    """
    Reset password using a valid token (Database Token)
    """
    from app.models.user import PasswordResetToken
    from datetime import datetime
    import bcrypt

    data = request.get_json(silent=True) or {}
    token = data.get("token")
    new_password = data.get("newPassword")
    confirm_password = data.get("confirmPassword", new_password)

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400

    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        active_tokens = PasswordResetToken.query.filter(
            PasswordResetToken.expiry > datetime.utcnow(),
            PasswordResetToken.used == False
        ).all()

        valid_token = None
        for t in active_tokens:
            if bcrypt.checkpw(token.encode('utf-8'), t.token_hash.encode('utf-8')):
                valid_token = t
                break

        if not valid_token:
            return jsonify({"error": "This reset link is invalid or has expired"}), 400

        user = User.query.get(valid_token.user_id)
        if not user:
            return jsonify({"error": "User not found"}), 400

        # Update password
        user.set_password(new_password)
        
        # Mark token as used
        valid_token.used = True
        
        db.session.commit()

        current_app.logger.info(f"Password reset successful for user_id: {user.uuid}")
        return jsonify({"message": "Password has been reset successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred. Please try again."}), 500
