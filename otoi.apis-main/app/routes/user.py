from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.user import User, Role
from app.utils.stamping import set_created_fields, set_updated_fields, set_business
from sqlalchemy import or_, func, cast, String
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError
from flask import current_app, g
from app.utils.decorators import role_required

# --- Existing Blueprint for Profile (Login/Signup) ---
user_profile_blueprint = Blueprint("user_profile", __name__, url_prefix="")  # Prefix will be set during registration

@user_profile_blueprint.route("/profile", methods=["GET", "OPTIONS"])
@role_required(["Admin", "User", "Manager"])
def profile():
    """
    Get logged-in user's profile (for login/signup).
    """
    user = User.query.filter_by(uuid=g.user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    businesses = [{"id": business.id, "name": business.name} for business in user.businesses]
    return jsonify({
        "id": str(user.uuid),
        "first_name": user.username,
        "last_name": user.username,
        "email": user.email,
        "role": user.role.name,
        "isActive": user.isActive,
        "businesses": businesses
    })

# --- New Blueprint for All Users CRUD ---
# user_blueprint = Blueprint("users", __name__, url_prefix="/api/users")
user_blueprint = Blueprint("users", __name__)

# --- Fetch All Users (Admin and Manager) ---
@user_blueprint.route("/", methods=["GET"])
@role_required(["Admin", "Manager"])
def get_all_users():
    """
    Fetch all users with filtering, sorting, and pagination
    ---
    tags:
      - User Management
    security:
      - BearerAuth: []
    parameters:
      - name: query
        in: query
        description: Search query to filter users by username, email, or mobile number
        required: false
        schema:
          type: string
          example: "john"
      - name: sort
        in: query
        description: Field to sort by
        required: false
        schema:
          type: string
          default: id
          enum: [id, username, email, mobileNo, firstName, lastName, created_at, updated_at]
          example: "email"
      - name: order
        in: query
        description: Sort order (asc or desc)
        required: false
        schema:
          type: string
          default: asc
          enum: [asc, desc]
          example: "asc"
      - name: page
        in: query
        description: Page number for pagination
        required: false
        schema:
          type: integer
          default: 1
          minimum: 1
          example: 1
      - name: items_per_page
        in: query
        description: Number of items per page
        required: false
        schema:
          type: integer
          default: 10
          minimum: 1
          maximum: 100
          example: 10
    responses:
      200:
        description: Users retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                pages:
                  type: integer
                  description: Total number of pages
                  example: 5
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                        example: 1
                      first_name:
                        type: string
                        example: "John"
                      last_name:
                        type: string
                        example: "Doe"
                      username:
                        type: string
                        example: "johndoe"
                      email:
                        type: string
                        example: "john.doe@example.com"
                      mobile:
                        type: string
                        example: "1234567890"
                      role:
                        type: string
                        example: "Admin"
                      isActive:
                        type: boolean
                        example: true
                      businesses:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: integer
                            name:
                              type: string
                      created_at:
                        type: string
                        format: date-time
                      updated_at:
                        type: string
                        format: date-time
                      created_by:
                        type: integer
                pagination:
                  type: object
                  properties:
                    total:
                      type: integer
                      description: Total number of users
                      example: 50
      401:
        description: Unauthorized - Invalid or missing token
      403:
        description: Forbidden - Admin role required
      500:
        description: Internal server error
    """
    try:
        query = User.query

        # --- Filtering ---
        if "query" in request.args:
            query_value = request.args.get("query", "").strip()
            if query_value:
                filter_conditions = [
                    User.username.ilike(f"%{query_value}%"),
                    User.email.ilike(f"%{query_value}%"),
                    User.firstName.ilike(f"%{query_value}%"),
                    User.lastName.ilike(f"%{query_value}%"),
                    func.concat(User.firstName, " ", User.lastName).ilike(f"%{query_value}%")
                ]
                # Add mobile number search if the field exists
                if hasattr(User, 'mobileNo'):
                    filter_conditions.append(cast(User.mobileNo, String).ilike(f"%{query_value}%"))
                
                # Combine conditions with OR
                query = query.filter(or_(*filter_conditions))

        # --- Sorting ---
        sort = request.args.get("sort", "uuid")
        order = request.args.get("order", "asc")
        # Validate sort field exists
        valid_sort_fields = ["uuid", "username", "email", "mobileNo", "firstName", "lastName", "created_at", "updated_at"]
        if sort not in valid_sort_fields:
            sort = "uuid"  # Default to uuid if invalid field

        sort_column = getattr(User, sort)
        if order == "desc":
            query = query.order_by(db.desc(sort_column))
        else:
            query = query.order_by(sort_column)

        # Return all users for dropdown if requested
        if request.args.get("dropdown") == "true":
            return jsonify([
                {
                    "uuid": str(user.uuid),
                    "name": f"{user.firstName} {user.lastName}".strip()
                }
                for user in query.all()
            ])

        # --- Pagination ---
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("items_per_page", 5))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        users = pagination.items

        # --- Build Response ---
        result = []
        for user in users:
            businesses = [{"id": business.id, "name": business.name} for business in user.businesses]
            result.append({

                "id": str(user.uuid),
                "first_name": user.firstName,
                "last_name": user.lastName,
                "username": user.username,
                "email": user.email,
                "mobile": user.mobileNo if hasattr(user, 'mobileNo') else None,
                "role": user.role.name if user.role else None,
                "isActive": user.isActive,
                "businesses": businesses,
                "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') and user.created_at else None,
                "updated_at": user.updated_at.isoformat() if hasattr(user, 'updated_at') and user.updated_at else None,
                "created_by": str(user.created_by) if hasattr(user, 'created_by') and user.created_by else None,
                "updated_by": str(user.updated_by) if hasattr(user, 'updated_by') and user.updated_by else None
            })

        return jsonify({
            "pages": pagination.pages,
            "data": result,
            "pagination": {"total": pagination.total}
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in get_all_users: {str(e)}")
        print(error_details)
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

# --- Fetch Single User (Admin/User) ---
@user_blueprint.route("/<string:user_uuid>", methods=["GET"])
@role_required(["Admin", "User", "Manager"])
def get_user_by_id(user_uuid):
    """
    Fetch a single user by UUID
    ---
    tags:
      - User Management
    security:
      - BearerAuth: []
    parameters:
      - name: user_uuid
        in: path
        description: UUID of the user to retrieve
        required: true
        schema:
          type: string
          example: "550e8400-e29b-41d4-a716-446655440000"
    responses:
      200:
        description: User retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  example: 1
                first_name:
                  type: string
                  example: "John"
                last_name:
                  type: string
                  example: "Doe"
                username:
                  type: string
                  example: "johndoe"
                email:
                  type: string
                  example: "john.doe@example.com"
                mobile:
                  type: string
                  example: "1234567890"
                role:
                  type: string
                  example: "Admin"
                isActive:
                  type: boolean
                  example: true
                businesses:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
                created_at:
                  type: string
                  format: date-time
                updated_at:
                  type: string
                  format: date-time
                created_by:
                  type: integer
      401:
        description: Unauthorized - Invalid or missing token
      403:
        description: Forbidden - Insufficient permissions
      404:
        description: User not found
    """
    user = User.query.filter_by(uuid=user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    businesses = [{"id": business.id, "name": business.name} for business in user.businesses]
    return jsonify({
        "id": str(user.uuid),
        "first_name": user.firstName,
        "last_name": user.lastName,
        "username": user.username,
        "email": user.email,
        "mobile": user.mobileNo if hasattr(user, 'mobileNo') else None,
        "role": user.role.name if user.role else None,
        "isActive": user.isActive,
        "businesses": businesses,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "created_by": user.created_by
    })

# --- Create User (Admin only) ---
@user_blueprint.route("/", methods=["POST"])
@role_required(["Admin"])
def create_user():
    """
    Create a new user
    ---
    tags:
      - User Management
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - email
              - password
              - role
            properties:
              first_name:
                type: string
                description: User's first name
                example: "John"
              last_name:
                type: string
                description: User's last name
                example: "Doe"
              username:
                type: string
                description: Username (auto-generated from email if not provided)
                example: "johndoe"
              email:
                type: string
                format: email
                description: User's email address
                example: "john.doe@example.com"
              mobile:
                type: string
                description: Mobile number
                example: "1234567890"
              password:
                type: string
                format: password
                description: User's password
                example: "SecureP@ssw0rd"
              role:
                type: string
                description: User's role
                example: "User"
                enum: [Admin, User, Manager]
              isActive:
                type: boolean
                description: Whether the user account is active
                default: true
                example: true
    responses:
      201:
        description: User created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "User created successfully"
                id:
                  type: integer
                  example: 1
      400:
        description: Bad request - Validation error or duplicate email
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
            examples:
              missingFields:
                value:
                  error: "Username and email are required"
              missingPassword:
                value:
                  error: "Password is required"
              duplicateEmail:
                value:
                  error: "Email already exists"
              invalidRole:
                value:
                  error: "Invalid role"
      401:
        description: Unauthorized - Invalid or missing token
      403:
        description: Forbidden - Admin role required
      500:
        description: Internal server error
    """
    try:
        data = request.get_json()
        
        # Support both snake_case (frontend) and camelCase (other sources)
        first_name = data.get("first_name") or data.get("firstName")
        last_name = data.get("last_name") or data.get("lastName")
        username = data.get("username")
        email = data.get("email")
        if email:
            email = email.lower().strip()
            if not username:
                username = email.split("@")[0]

        mobile = data.get("mobile") or data.get("mobileNo")
        role_name = data.get("role")
        password = data.get("password")

        if not username or not email:
            return jsonify({"error": "Username and email are required"}), 400
            
        if not password:
             return jsonify({"error": "Password is required"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 400

        role = Role.query.filter_by(name=role_name).first()
        if not role:
            return jsonify({"error": "Invalid role"}), 400

        user = User(
            firstName=first_name,
            lastName=last_name,
            username=username,
            email=email,
            mobileNo=mobile,
            role_id=role.id,
            isActive=data.get("isActive", True)
        )
        user.set_password(password)
        
        set_created_fields(user)
        set_business(user)
        db.session.add(user)
        db.session.commit()

        return jsonify({"message": "User created successfully", "id": str(user.uuid)}), 201

    except IntegrityError as e:
        db.session.rollback()
        # Handle database integrity errors (e.g., duplicate entries)
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'unique' in error_msg.lower() or 'duplicate' in error_msg.lower():
            if 'email' in error_msg.lower():
                return jsonify({"error": "Email address already exists"}), 400
            elif 'username' in error_msg.lower():
                return jsonify({"error": "Username already exists"}), 400
            else:
                return jsonify({"error": "A user with this information already exists"}), 400
        return jsonify({"error": "Unable to create user. Please check your input and try again."}), 400
    except Exception as e:
        db.session.rollback()
        # Log the actual error for debugging
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in create_user: {str(e)}")
        print(error_details)
        # Return user-friendly message
        return jsonify({"error": "Unable to create user. Please try again or contact support."}), 500

# --- Update User (Admin only) ---
@user_blueprint.route("/<string:user_uuid>", methods=["PUT", "OPTIONS"])
@role_required(["Admin"])
def update_user(user_uuid):
    """
    Update an existing user
    ---
    tags:
      - User Management
    security:
      - BearerAuth: []
    parameters:
      - name: user_uuid
        in: path
        description: UUID of the user to update
        required: true
        schema:
          type: string
          example: "550e8400-e29b-41d4-a716-446655440000"
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              first_name:
                type: string
                description: User's first name
                example: "John"
              last_name:
                type: string
                description: User's last name
                example: "Doe"
              username:
                type: string
                description: Username
                example: "johndoe"
              email:
                type: string
                format: email
                description: User's email address
                example: "john.doe@example.com"
              mobile:
                type: string
                description: Mobile number
                example: "1234567890"
              role:
                type: string
                description: User's role
                example: "User"
                enum: [Admin, User, Manager]
              isActive:
                type: boolean
                description: Whether the user account is active
                example: true
    responses:
      200:
        description: User updated successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "User updated successfully"
                user:
                  type: object
                  properties:
                    id:
                      type: integer
                    firstName:
                      type: string
                    lastName:
                      type: string
                    username:
                      type: string
                    email:
                      type: string
                    mobile:
                      type: string
                    role:
                      type: string
                    isActive:
                      type: boolean
                    businesses:
                      type: array
                      items:
                        type: object
      400:
        description: Bad request - Validation error or duplicate email
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
            examples:
              noData:
                value:
                  error: "No data provided"
              duplicateEmail:
                value:
                  error: "Email already exists"
              invalidRole:
                value:
                  error: "Invalid role"
      401:
        description: Unauthorized - Invalid or missing token
      403:
        description: Forbidden - Admin role required
      404:
        description: User not found
      500:
        description: Internal server error
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        user = User.query.filter_by(uuid=user_uuid).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Update fields if provided
        if "first_name" in data or "firstName" in data:
            user.firstName = data.get("first_name") or data.get("firstName")
            
        if "last_name" in data or "lastName" in data:
            user.lastName = data.get("last_name") or data.get("lastName")

        if "username" in data:
            existing_user = User.query.filter_by(username=data["username"]).first()
            if existing_user and str(existing_user.uuid) != user_uuid:
                return jsonify({"error": "Username already exists"}), 400
            user.username = data["username"]
        
        # Update email if provided
        if "email" in data:
            # Check if email already exists for another user
            existing_user = User.query.filter_by(email=data["email"]).first()
            if existing_user and str(existing_user.uuid) != user_uuid:
                return jsonify({"error": "Email already exists"}), 400
            user.email = data["email"]
        
        # Update mobile if provided
        if "mobile" in data or "mobileNo" in data:
            mobileValue = data.get("mobile") or data.get("mobileNo")
            existing_user = User.query.filter_by(mobileNo=mobileValue).first()
            if existing_user and str(existing_user.uuid) != user_uuid:
                return jsonify({"error": "Mobile number already exists"}), 400
            user.mobileNo = mobileValue

        # Update role if provided
        if "role" in data and data["role"]:
            role = Role.query.filter_by(name=data["role"]).first()
            if not role:
                return jsonify({"error": "Invalid role"}), 400
            user.role_id = role.id

        if "isActive" in data:
            user.isActive = data["isActive"]

        set_updated_fields(user)
        db.session.commit()
        
        # Return updated user data
        businesses = [{"id": business.id, "name": business.name} for business in user.businesses]
        return jsonify({
            "message": "User updated successfully",
            "user": {
                "id": str(user.uuid),
                "firstName": user.firstName,
                "lastName": user.lastName,
                "username": user.username,
                "email": user.email,
                "mobile": user.mobileNo if hasattr(user, 'mobileNo') else None,
                "role": user.role.name if user.role else None,
                "isActive": user.isActive,
                "businesses": businesses
            }
        }), 200

    except IntegrityError as e:
        db.session.rollback()
        # Handle database integrity errors
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        if 'unique' in error_msg.lower() or 'duplicate' in error_msg.lower():
            if 'email' in error_msg.lower():
                return jsonify({"error": "Email address already exists"}), 400
            elif 'username' in error_msg.lower():
                return jsonify({"error": "Username already exists"}), 400
            else:
                return jsonify({"error": "A user with this information already exists"}), 400
        return jsonify({"error": "Unable to update user. Please check your input and try again."}), 400
    except Exception as e:
        db.session.rollback()
        # Log the actual error for debugging
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in update_user: {str(e)}")
        print(error_details)
        # Return user-friendly message
        return jsonify({"error": "Unable to update user. Please try again or contact support."}), 500

# --- Delete User (Admin only) ---
@user_blueprint.route("/<string:user_uuid>", methods=["DELETE"])
@role_required(["Admin"])
def delete_user(user_uuid):
    """
    Delete a user
    ---
    tags:
      - User Management
    security:
      - BearerAuth: []
    parameters:
      - name: user_uuid
        in: path
        description: UUID of the user to delete
        required: true
        schema:
          type: string
          example: "550e8400-e29b-41d4-a716-446655440000"
    responses:
      200:
        description: User deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "User deleted successfully"
      401:
        description: Unauthorized - Invalid or missing token
      403:
        description: Forbidden - Admin role required
      404:
        description: User not found
      409:
        description: Conflict - Cannot delete user due to foreign key constraints
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "Cannot delete user. It is referenced in other records."
      500:
        description: Internal server error
    """
    try:
        user = User.query.filter_by(uuid=user_uuid).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted successfully"}), 200

    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Cannot delete user. This user is referenced in other records."}), 409
    except Exception as e:
        db.session.rollback()
        # Log the actual error for debugging
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in delete_user: {str(e)}")
        print(error_details)
        # Return user-friendly message
        return jsonify({"error": "Unable to delete user. Please try again or contact support."}), 500
