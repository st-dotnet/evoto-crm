from uuid import UUID
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from functools import wraps
from flask import jsonify, request, Response
from app.models.user import User

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return Response(status=200)
        verify_jwt_in_request()
        return fn(*args, **kwargs)
    return wrapper

def role_required(required_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Skip JWT verification for OPTIONS requests (CORS preflight)
            # Flask-CORS will handle OPTIONS requests automatically
            if request.method == "OPTIONS":
                return Response(status=200)
            verify_jwt_in_request()
            identity = get_jwt_identity()
            user = User.query.filter_by(uuid=UUID(identity)).first()
            
            if not user or user.role.name not in required_roles:
                return jsonify({"error": "Access forbidden: unauthrised role"}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator