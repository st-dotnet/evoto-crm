from flask import g, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
import logging

logging.basicConfig(level=logging.ERROR)

def extract_jwt_info():
    """
    Middleware to verify JWT and extract user_id and business_id.
    Skips specified routes and unauthenticated/preflight requests.
    """
    excluded_endpoints = ["auth.login"]  # List of endpoints to skip JWT verification

    # Skip middleware for excluded endpoints
    if request.endpoint in excluded_endpoints:
        return

    # Skip CORS preflight and requests without Authorization header
    if request.method == "OPTIONS" or not request.headers.get("Authorization"):
        return

    try:
        # Verify the token and extract claims
        verify_jwt_in_request()
        g.user_id = get_jwt_identity()  # Extract user_id (identity)
        claims = get_jwt()              # Extract claims from token
        g.business_id = claims.get("business_id")  # Extract business_id from claims
        g.role = claims.get("role")  # Extract role from claims
    except Exception as e:
        logging.error(f"JWT Verification Error: {e}")
        g.user_id = None
        g.business_id = None