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
    role_name = (data.get("role") or "User").strip()

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    if password != password_confirmation:
        return jsonify({"error": "password and password_confirmation do not match"}), 400

    # Uniqueness checks
    if User.query.filter_by(username=username).first() is not None:
        return jsonify({"error": "username already exists"}), 400
    if User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "email already exists"}), 400

    # Resolve role
    role = Role.query.filter_by(name=role_name).first()
    if role is None and role_name:
        return jsonify({"error": f"role '{role_name}' not found"}), 400

    # Create user
    user = User(firstName=firstName, lastName=lastName, username=username, email=email, mobileNo=mobileNo, role=role)
    user.set_password(password)

    # Persist and set audit fields
    db.session.add(user)
    db.session.flush()  # to get user.id
    user.created_by = user.id
    user.updated_by = user.id

    db.session.commit()

    # Issue token like login
    business_id = user.businesses[0].id if user.businesses else None
    token = create_access_token(identity=str(user.id), additional_claims={
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
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              email:
                type: string
                example: "info@evototechnologies.com"
              password:
                type: string
                example: "admin123"
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
        data = request.get_json()
        if not data or "email" not in data or "password" not in data:
            return jsonify({"error": "Email and password are required"}), 400

        email = data["email"].strip().lower()
        password = data["password"]

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
            identity=str(user.id),
            additional_claims={
                "username": user.username,
                "role": user.role.name,
                "business_id": business_id
            }
        )
        
        g.user_id = user.id
        g.business_id = business_id
        
        return jsonify({
            "access_token": token,
            "token_type": "Bearer",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role.name,
                "business_id": business_id
            }
        }), 200
        
    except Exception as e:
        # Log the error for debugging
        print(f"Login error: {str(e)}")
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
