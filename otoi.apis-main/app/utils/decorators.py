from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from functools import wraps
from flask import jsonify
from app.models.user import User

def login_required(fn):
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        return fn(*args, **kwargs)
    return wrapper

def role_required(required_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            identity = get_jwt_identity()
            user = User.query.filter_by(id=int(identity)).first()
            
            if not user or user.role.name not in required_roles:
                return jsonify({"error": "Access forbidden: insufficient role"}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator