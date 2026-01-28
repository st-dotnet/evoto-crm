from flask import Blueprint, jsonify, request
from app.models.user import Role
from app.extensions import db

# Roles blueprint
roles_blueprint = Blueprint("roles", __name__, url_prefix="/roles")

@roles_blueprint.route("/", methods=["GET"])
def get_roles():
    """
    Get all roles.
    ---
    tags:
      - Roles
    responses:
      200:
        description: A list of roles.
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: Role ID
                  name:
                    type: string
                    description: Name of the role
    """
    # Flask-CORS will handle OPTIONS automatically via middleware
    # Don't manually handle OPTIONS here to avoid interfering with CORS headers
    
    try:
        roles = Role.query.all()
        # Return empty array if no roles found, not an error
        return jsonify([{'id': role.id, 'name': role.name} for role in roles])
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_roles: {str(e)}")
        print(error_details)
        return jsonify({"error": f"Failed to fetch roles: {str(e)}"}), 500
