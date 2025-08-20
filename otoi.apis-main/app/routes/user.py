from flask import Blueprint, jsonify
from app.utils.decorators import role_required
from app.models.user import User
from flask import g

user_blueprint = Blueprint("user", __name__)

@user_blueprint.route("/profile", methods=["GET"])
@role_required(["Admin", "User"])
def profile():
    """
    Get user profile
    ---
    tags:
      - User
    security:
      - BearerAuth: []
    responses:
      200:
        description: User profile data
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  description: User ID
                  example: 1
                first_name:
                  type: string
                  description: User's first name
                  example: "John"
                last_name:
                  type: string
                  description: User's last name
                  example: "Doe"
                email:
                  type: string
                  description: User's email address
                  example: "john.doe@example.com"
                role:
                  type: string
                  description: User's role
                  example: "Admin"
                businesses:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: Business ID
                        example: 101
                      name:
                        type: string
                        description: Business name
                        example: "TechCorp"
      401:
        description: Unauthorized - Invalid credentials
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "Invalid credentials"
      403:
        description: Forbidden - Role not allowed
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "Forbidden access"
    """
    user = User.query.filter_by(id=g.user_id).first()
    # Extract business IDs from the user object
    businesses = [{"id": business.id, "name": business.name} for business in user.businesses]
    if user: 
        return jsonify({ 
        "id": user.id,
        "first_name": user.username,
        "last_name": user.username,
        "email": user.email, 
        "role": user.role.name, 
        "businesses": businesses
        }), 200

    return jsonify({"error": "Invalid credentials"}), 401
