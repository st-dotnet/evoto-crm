from flask import g, request, jsonify, abort
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from app.models.user import User
import logging

logging.basicConfig(level=logging.ERROR)

def extract_jwt_info():
    """
    Middleware to verify JWT and extract user_id and business_id.
    Blocks all requests except public endpoints and OPTIONS requests.
    """
    
    # Allow CORS preflight requests
    if request.method == "OPTIONS":
        return None
    
    public_endpoints = [
        '/api/auth/signup',
        '/api/auth/login',
        '/api/auth/forgot-password',
        '/api/auth/validate-reset-token',
        '/api/auth/reset-password',

        # Swagger / Docs
        '/apidocs',
        '/apidocs/',
        '/apidocs/index.html',
        '/apidocs/swagger.json',
        '/apidocs/swagger.yaml',

    # Flask-apispec spec endpoint (IMPORTANT)
        '/apispec_1.json',

    # Other
        '/flasgger',
        '/flasgger/',
        '/favicon.ico'
    ]
    
    # Check if current endpoint is public
    # print(f"Request path: {request.path}")
    if any(request.path.startswith(endpoint) for endpoint in public_endpoints):
        return None

    # Require authentication for all other endpoints
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        abort(401, description="Not authorized.")

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
        abort(401, description="Invalid or expired token ")
