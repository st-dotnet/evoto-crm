from flask import g, request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from app.models.user import User
import logging

logging.basicConfig(level=logging.ERROR)

def extract_jwt_info():
    """
    Middleware to verify JWT and extract user_id and business_id.
    Ensures that deactivated users are automatically logged out.
    """

    if request.method == "OPTIONS":
        return None

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        
        # Check if the user is still active in the database
        user = User.query.filter_by(uuid=user_id).first()
        if not user or not user.isActive:
            return jsonify({
                "message": "Account deactivated or user not found. Please log in again."
            }), 403

        g.user_id = user_id
        claims = get_jwt()
        g.business_id = claims.get("business_id")
        g.role = claims.get("role")

    except Exception as e:
        logging.error(f"JWT Verification Error: {e}")

        return jsonify({
            "message": "Invalid or expired token"
        }), 401
