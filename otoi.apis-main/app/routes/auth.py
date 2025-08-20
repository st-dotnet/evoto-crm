from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from app.models.user import User
from flask import g

auth_blueprint = Blueprint("auth", __name__)

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
      401:
        description: Invalid credentials
    """
    data = request.json
    email = data.get("email")
    password = data.get("password")
 
    user = User.query.filter_by(email=email).first()
    
    if user and user.check_password(password):
        # Access the id of the first business
        business_id = user.businesses[0].id if user.businesses else None  # Handle empty business list
        token = create_access_token(identity=str(user.id), additional_claims={
            "username": user.username,
            "role": user.role.name,
            "business_id": business_id
        })
        g.user_id = user.id
        g.business_id = business_id
        return jsonify({"access_token": token , "token_type":"Bearer"}), 200

    return jsonify({"error": "Invalid credentials"}), 401
