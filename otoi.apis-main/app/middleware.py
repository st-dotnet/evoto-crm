from flask import g, request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
import logging

logging.basicConfig(level=logging.ERROR)

def extract_jwt_info():
    """
    Middleware to verify JWT and extract user_id and business_id.
    Properly handles CORS preflight and invalid tokens.
    """

    if request.method == "OPTIONS":
        return None

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    try:
        verify_jwt_in_request()
        g.user_id = get_jwt_identity()
        claims = get_jwt()
        g.business_id = claims.get("business_id")
        g.role = claims.get("role")

    except Exception as e:
        logging.error(f"JWT Verification Error: {e}")

        return jsonify({
            "message": "Invalid or expired token"
        }), 401
