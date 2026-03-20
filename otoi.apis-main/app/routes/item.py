import base64
import random
from sys import prefix
import time
from uuid import UUID
import uuid
from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_
from app.extensions import db
from app.models import Item, ItemCategory, MeasuringUnit, ItemType
from app.utils.stamping import set_created_fields, set_updated_fields

item_blueprint = Blueprint("item", __name__, url_prefix="/items")

@item_blueprint.route("/", methods=["GET"])
def get_items():
    """
    Get all items with pagination, search, sorting, and item type filtering.
    ---
    tags:
      - Items
    parameters:
      - name: item_type
        in: query
        required: false
        schema:
          type: string
        description: Filter by item type name ('Product' or 'Service', case-insensitive)
      - name: item_type_id
        in: query
        required: false
        schema:
          type: integer
        description: Filter by item type ID (1 for Product, 2 for Service)
      - name: query
        in: query
        required: false
        schema:
          type: string
        description: Search term for item name, code, description, or HSN code
      - name: page
        in: query
        required: false
        schema:
          type: integer
        description: Page number (default: 1)
      - name: items_per_page
        in: query
        required: false
        schema:
          type: integer
        description: Items per page (default: 5)
      - name: sort
        in: query
        required: false
        schema:
          type: string
        description: Sort field (default: created_at)
      - name: order
        in: query
        required: false
        schema:
          type: string
        description: Sort order: asc or desc (default: desc)
      - name: low_stock
        in: query
        required: false
        schema:
          type: boolean
        description: Filter products with opening stock less than or equal to 5
      - name: dropdown
        in: query
        required: false
        schema:
          type: boolean
        description: Return simplified format for dropdowns
    responses:
      200:
        description: A paginated list of items.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                properties:
                  id:
                    type: integer
                    description: Item ID
                  item_name:
                    type: string
                    description: Name of the item
                  item_type:
                    type: string
                    description: Item type name
                  item_type_id:
                    type: integer
                    description: Item type ID
                  category:
                    type: string
                    description: Category name
                  category_id:
                    type: integer
                    description: Category ID
                  sales_price:
                    type: number
                    format: float
                    description: Sales price
                  purchase_price:
                    type: number
                    format: float
                    description: Purchase price
                  gst_tax_rate:
                    type: number
                    format: float
                    description: GST tax rate
                  opening_stock:
                    type: number
                    format: float
                    description: Opening stock
                  item_code:
                    type: string
                    description: Item code
                  description:
                    type: string
                    description: Item description
                  measuring_unit:
                    type: string
                    description: Measuring unit name
                  measuring_unit_id:
                    type: integer
                    description: Measuring unit ID
                  business_id:
                    type: integer
                    description: Business ID
    """
    try:
           
        query = Item.query.filter_by(is_deleted=False)

        # Filter by item_type_id first (for frontend compatibility)
        # if "item_type_id" in request.args:
        #     item_type_id_value = request.args.get("item_type_id", "").strip()
        #     if item_type_id_value:
        #         try:
        #             item_type_id = int(item_type_id_value)
        #             query = query.filter(Item.item_type_id == item_type_id)
        #         except ValueError:
        #             pass
        
        # # Filter by item_type if provided (alternative by name)
        # elif "item_type" in request.args:
        #     item_type_value = request.args.get("item_type", "").strip().lower()
        #     if item_type_value:
        #         # Use subquery approach to filter by item type name
        #         matching_type = ItemType.query.filter(ItemType.name.ilike(item_type_value)).first()
        #         if matching_type:
        #             query = query.filter(Item.item_type_id == matching_type.id)
        #         else:
        #             # If no matching type found, return empty result
        #             query = query.filter(Item.item_type_id == -1) 

        # Search query filter
        if "query" in request.args:
            query_value = request.args.get("query", "").strip()
            if query_value:
                query = query.filter(
                    or_(
                        Item.item_name.ilike(f"%{query_value}%"),
                        Item.item_code.ilike(f"%{query_value}%"),
                        Item.description.ilike(f"%{query_value}%"),
                        Item.hsn_code.ilike(f"%{query_value}%")
                    )
                )

        # Handle low_stock filter - only applies to Products (Services have no stock)
        low_stock = request.args.get("low_stock")
        if low_stock == 'true':
            query = query.filter(
                Item.item_type_id == 1,          # Products only (not Services)
                Item.opening_stock <= 5           # with low stock quantity
            )

        sort = request.args.get("sort", "created_at")  # Default sort by created_at
        order = request.args.get("order", "desc").upper()  # Default order is 'desc'

        for field in sort.split(","):
            if field == "item_name":
                if order == "desc":
                    query = query.order_by(db.desc(Item.item_name))
                else:
                    query = query.order_by(Item.item_name)
            elif field == "item_code":
                if order == "desc":
                    query = query.order_by(db.desc(Item.item_code))
                else:
                    query = query.order_by(Item.item_code)
            elif field == "sales_price":
                if order == "desc":
                    query = query.order_by(db.desc(Item.sales_price))
                else:
                    query = query.order_by(Item.sales_price)
            else:
                # Handle other fields
                if field.startswith("-"):
                    query = query.order_by(db.desc(getattr(Item, field[1:], "id")))
                else:
                    query = query.order_by(getattr(Item, field, "id"))

        # Return all items for dropdown if requested
        if request.args.get("dropdown") == "true":
            items = query.all()
            return jsonify([
                {
                    "id": str(item.id),
                    "item_name": item.item_name or "",
                    "item_code": item.item_code or ""
                }
                for item in items
            ])

        # Paginated results for the main grid
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("items_per_page", 5))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        items = pagination.items

        # Shape response to match frontend expectations: { data: [...], pagination: { total, ... } }
        result = []
        for item in items:
            category = item.category
            item_type = item.item_type
            measuring_unit = item.measuring_unit

            # Get the feature image, or the first image if no main is set
            main_image_obj = next((img for img in (item.images or []) if img.is_main), None)
            if not main_image_obj and item.images:
                main_image_obj = item.images[0]
                
            image_url = None
            if main_image_obj:
                image_url = f"/static/itemImages/{item.id}/{main_image_obj.image}"

            result.append({
                "id": str(item.id),  # Convert to string for consistency
                "uuid": str(item.id),  # Add uuid field for frontend compatibility
                "item_name": item.item_name or "",
                "item_type": item_type.name if item_type else None,
                "item_type_id": item.item_type_id,
                "category": category.name if category else None,
                "category_id": str(item.category_id) if item.category_id else None,
                "sales_price": float(item.sales_price or 0),
                "purchase_price": float(item.purchase_price or 0),
                "gst_tax_rate": float(item.gst_tax_rate or 0),
                "opening_stock": float(item.opening_stock or 0),
                "item_code": item.item_code or "",
                "hsn_code": item.hsn_code or "",
                "description": item.description or "",
                "measuring_unit": measuring_unit.name if measuring_unit else None,
                "measuring_unit_id": item.measuring_unit_id,
                "image": image_url
            })

        response_data = {
            "data": result,
            "pagination": {
                "total": pagination.total,
                "items_per_page": per_page,
                "current_page": page,
                "last_page": pagination.pages,
                "from": (
                    (pagination.page - 1) * per_page + 1 if pagination.total > 0 else 0
                ),
                "to": min(pagination.page * per_page, pagination.total),
                "prev_page_url": None,
                "next_page_url": None,
                "first_page_url": None,
            },
        }
        return jsonify(response_data)

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch items",
            "details": str(e)
        }), 500


@item_blueprint.route("/", methods=["POST"])
def create_item():
    try:
        # Support both JSON and multipart/form-data for unified creation
        if request.content_type and 'multipart/form-data' in request.content_type:
            item_data_str = request.form.get('item_data')
            if not item_data_str:
                return jsonify({"error": "item_data field is required in multipart request"}), 400
            
            import json
            try:
                data = json.loads(item_data_str)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON in item_data field"}), 400
                
            new_files = request.files.getlist('images')
        else:
            data = request.json or {}
            new_files = []

        # Validate required fields
        item_name = data.get("item_name", "").strip()
        item_code = data.get("item_code", "").strip()
     
        if not item_name:
            return jsonify({"message": "Item Name is required"}), 400
        if not item_code:
            return jsonify({"message": "Item Code is required"}), 400
     
        # Check for duplicate item_code (only among active items)
        if Item.query.filter_by(item_code=item_code, is_deleted=False).first():
            return jsonify({
                "message": "An Item code already exists",
                "suggestion": "Please choose a different item code"
            }), 400
     
        # Handle category
        category_id = data.get("category_id")
        category = None
        if category_id:
            try:
                category_uuid = UUID(category_id)
                category = ItemCategory.query.filter(ItemCategory.uuid == category_uuid).first()
            except ValueError:
                return jsonify({"message": "Invalid category_id format"}), 400
        if not category:
            return jsonify({"message": "Invalid category_id"}), 400
     
        # Handle measuring unit
        measuring_unit = None
        if 'measuring_unit_id' in data and data['measuring_unit_id']:
            measuring_unit = MeasuringUnit.query.get(data['measuring_unit_id'])
     
        if not measuring_unit and 'measuring_unit' in data:
            raw_unit = str(data.get('measuring_unit', '')).strip().upper()
            if raw_unit:
                UNIT_ALIASES = {
                    "PCS": "PCS", "PIECE": "PCS", "UNIT": "PCS",
                    "KG": "KG", "KILOGRAM": "KG", "KGS": "KG",
                    "L": "LITER", "LTR": "LITER", "LITRE": "LITER", "LITER": "LITER",
                }
                unit_name = UNIT_ALIASES.get(raw_unit, raw_unit)
                measuring_unit = MeasuringUnit.query.filter_by(name=unit_name).first()
     
        if not measuring_unit:
            measuring_unit = MeasuringUnit.query.filter_by(name="PCS").first()
     
        if not measuring_unit:
            return jsonify({
                "message": "No valid measuring unit provided",
                "suggestion": "Please provide a valid measuring_unit_id or measuring_unit"
            }), 400
     
        # Handle Product vs Service
        item_type_id = data.get('item_type_id', 1)  # Default to Product
        item_type = "Service" if item_type_id == 2 else "Product"
     
        if item_type_id == 2:  # Service
            purchase_price = None
            opening_stock = None
        else:  # Product
            purchase_price = data.get('purchase_price')
            opening_stock = data.get('opening_stock')
     
        # Create item
        item = Item(
            item_type_id=item_type_id,
            category_id=category.uuid if category else None,
            measuring_unit_id=measuring_unit.id,
            item_name=item_name,
            sales_price=data.get("sales_price", 0),
            gst_tax_rate=data.get("gst_tax_rate", 0),
            purchase_price=purchase_price,
            opening_stock=opening_stock,
            item_code=item_code,
            hsn_code=data.get("hsn_code") if item_type == "Product" else None,
            description=data.get("description") or ""
        )
     
        set_created_fields(item)
        db.session.add(item)
        db.session.flush() # Get item.id for folder creation

        # Handle Image Uploads (Atomic)
        if new_files:
            import os
            from app.config import Config
            from app.models import ItemImage
            from werkzeug.utils import secure_filename
            
            item_dir = os.path.join(Config.ITEM_IMAGES_FOLDER, str(item.id))
            if not os.path.exists(item_dir):
                os.makedirs(item_dir)

            for i, file in enumerate(new_files[:4]): # Max 4
                if file and file.filename:
                    original_filename = file.filename
                    filename = secure_filename(f"{uuid.uuid4()}_{original_filename}")
                    file_path = os.path.join(item_dir, filename)
                    file.save(file_path)
                    
                    # Determine if this should be the main image
                    is_main = False
                    if "images" in data:
                        # Find matching entry in data["images"] by name
                        # We use original_filename to match with the name property from frontend
                        match = next((img for img in data["images"] if img.get("name") == original_filename), None)
                        if match:
                            is_main = match.get("is_main", False)
                    elif i == 0:
                        # Fallback: if no metadata provided, first image is main
                        is_main = True

                    # If this one is being set to main, ensure others of this item (if any yet) are not main
                    if is_main:
                        from app.models import ItemImage
                        ItemImage.query.filter_by(item_id=item.id).update({"is_main": False})

                    new_img = ItemImage(
                        item_id=item.id,
                        image=filename,
                        name=original_filename,
                        is_main=is_main
                    )
                    db.session.add(new_img)

        db.session.commit()
     
        return jsonify({
            "message": "Item created successfully",
            "item": {
                "id": str(item.id),
                "item_name": item.item_name,
                "item_code": item.item_code,
                "hsn_code": item.hsn_code or "",
                "description": item.description or ""
            }
        }), 201
 
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({
            "message": "Item creation failed due to constraint violation",
            "detail": str(e.orig)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "message": "Failed to create item",
            "detail": str(e)
        }), 400


@item_blueprint.route("/<uuid:item_id>", methods=["GET", "HEAD"])
def get_item(item_id):
    """
    Get a specific item by UUID (excluding soft-deleted items).
    ---
    tags:
      - Items
    parameters:
      - name: item_id
        in: path
        description: UUID of the item to retrieve
        required: true
        schema:
          type: uuid
    responses:
      200:
        description: Item details
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  description: Item ID
                item_name:
                  type: string
                  description: Name of the item
                item_type:
                  type: string
                  description: Item type name
                item_type_id:
                  type: integer
                  description: Item type ID
                category:
                  type: string
                  description: Category name
                category_id:
                  type: string
                  format: uuid
                  description: Category UUID
                sales_price:
                  type: number
                  format: float
                  description: Sales price
                purchase_price:
                  type: number
                  format: float
                  description: Purchase price
                gst_tax_rate:
                  type: number
                  format: float
                  description: GST tax rate
                opening_stock:
                  type: number
                  format: float
                  description: Opening stock
                item_code:
                  type: string
                  description: Item code
                description:
                  type: string
                  description: Item description
                measuring_unit:
                  type: string
                  description: Measuring unit name
                measuring_unit_id:
                  type: integer
                  description: Measuring unit ID
                created_at:
                  type: string
                  format: date-time
                  description: Creation timestamp
                updated_at:
                  type: string
                  format: date-time
                  description: Last update timestamp
      404:
        description: Item not found
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "Item not found"
      500:
        description: Internal server error
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "Failed to fetch item"
                details:
                  type: string
                  example: "Error message details"
    """
    try:
        # Input validation
        if not item_id:
            return jsonify({"error": "Invalid item ID"}), 400
            
        # Get item with related data
        item = db.session.query(Item).options(
            db.joinedload(Item.category),
            db.joinedload(Item.item_type),
            db.joinedload(Item.measuring_unit),
            db.joinedload(Item.images)
        ).filter(
            Item.id == item_id,
            Item.is_deleted.is_(False)
        ).first()
        
        if not item:
            return jsonify({"error": f"Item with ID {item_id} not found"}), 404
        
        # Format the response
        item_data = {
            "id": item.id,
            "item_name": item.item_name or "",
            "item_type": item.item_type.name if item.item_type else None,
            "hsn_code": item.hsn_code or "",
            "item_type_id": item.item_type_id,
            "category": item.category.name if item.category else None,
            "category_id": str(item.category_id) if item.category_id else None,
            "sales_price": float(item.sales_price or 0),
            "purchase_price": float(item.purchase_price or 0) if item.purchase_price is not None else None,
            "gst_tax_rate": float(item.gst_tax_rate or 0),
            "opening_stock": float(item.opening_stock or 0) if item.opening_stock is not None else None,
            "item_code": item.item_code or "",
            "description": item.description or "",
            "measuring_unit": item.measuring_unit.name if item.measuring_unit else None,
            "measuring_unit_id": item.measuring_unit_id,
            "images": [
                {
                    "id": img.id,
                    "url": f"/static/itemImages/{item.id}/{img.image}",
                    "name": img.name if img.name else f"Image {img.id}",
                    "is_main": img.is_main
                } for img in item.images
            ] if item.images else [],
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None
        }
        
        return jsonify(item_data)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to fetch item",
            "details": str(e)
        }), 500


@item_blueprint.route("/<uuid:item_id>", methods=["PUT", "PATCH"])
def update_item(item_id):
    try:
        if not isinstance(item_id, uuid.UUID):
            return jsonify({"error": "Invalid item UUID"}), 400
            
        # Support both JSON and multipart/form-data for unified update
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle multipart/form-data
            item_data_str = request.form.get('item_data')
            if not item_data_str:
                return jsonify({"error": "item_data field is required in multipart request"}), 400
            
            import json
            try:
                data = json.loads(item_data_str)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON in item_data field"}), 400
                
            new_files = request.files.getlist('images')
            images_to_delete = data.get('images_to_delete', [])
        else:
            # Traditional JSON request
            data = request.get_json() or {}
            new_files = []
            images_to_delete = []

        if not data and not new_files and not images_to_delete:
            return jsonify({"error": "No data provided for update"}), 400

        item = db.session.query(Item).with_for_update().get(item_id)
        if not item or item.is_deleted:
            return jsonify({"error": "Item not found or has been deleted"}), 404

        errors = {}

        # 1. Validation for text fields
        if "item_name" in data:
            new_name = data["item_name"].strip()
            if not new_name:
                errors.setdefault("item_name", []).append("Item name cannot be empty")
        
        if "item_code" in data:
            new_code = str(data["item_code"]).strip()
            if not new_code:
                errors.setdefault("item_code", []).append("Item code cannot be empty")
            elif new_code != item.item_code:
                existing = db.session.query(Item).filter(
                    Item.item_code == new_code,
                    Item.id != item_id,
                    Item.is_deleted.is_(False)
                ).first()
                if existing:
                    errors.setdefault("item_code", []).append("Item code already exists")
                    
        if errors:
            return jsonify({"error": "Validation error", "details": errors}), 400

        # Start Item Update
        # 2. Handle Image Deletions (Atomic)
        if images_to_delete:
            import os
            from app.config import Config
            from app.models import ItemImage
            
            for img_id in images_to_delete:
                img_obj = ItemImage.query.get(img_id)
                if img_obj and img_obj.item_id == item_id:
                    # Remove file from disk
                    full_path = os.path.join(Config.ITEM_IMAGES_FOLDER, str(item_id), img_obj.image)
                    if os.path.exists(full_path):
                        try:
                            os.remove(full_path)
                        except Exception as e:
                            print(f"Failed to remove file {full_path}: {e}")
                    
                    # Remove from DB
                    db.session.delete(img_obj)

        # 3. Handle Text Updates
        update_fields = [
            "item_name", "item_type_id", "sales_price", "purchase_price",
            "gst_tax_rate", "opening_stock", "description", "hsn_code"
        ]
        
        for field in update_fields:
            if field in data:
                setattr(item, field, data[field])
        
        if "category_id" in data:
            if not data["category_id"]:
                item.category_id = None
            else:
                category = ItemCategory.query.filter_by(uuid=data["category_id"]).first()
                if category:
                    item.category_id = category.uuid
                    
        if "measuring_unit_id" in data:
            if data["measuring_unit_id"]:
                measuring_unit = MeasuringUnit.query.get(data["measuring_unit_id"])
                if measuring_unit:
                    item.measuring_unit_id = measuring_unit.id

        if data.get("item_type_id") == 2:  # Service
            item.purchase_price = None
            item.opening_stock = None

        # 4. Handle sync of "is_main" flag
        has_main_selection = False
        if "images" in data:
            has_main_selection = any(img.get("is_main") for img in data["images"])

        # If we have a clear selection for main image, unset any current main image
        if has_main_selection:
            from app.models import ItemImage
            ItemImage.query.filter_by(item_id=item_id).update({"is_main": False})

        # 5. Handle New Image Uploads (Atomic)
        if new_files:
            import os
            from app.config import Config
            from app.models import ItemImage
            from werkzeug.utils import secure_filename
            
            # Count existing images to enforce limit
            current_count = ItemImage.query.filter_by(item_id=item_id).count()
            
            item_dir = os.path.join(Config.ITEM_IMAGES_FOLDER, str(item_id))
            if not os.path.exists(item_dir):
                os.makedirs(item_dir)

            for file in new_files:
                if current_count >= 4:
                    break
                    
                if file and file.filename:
                    original_filename = file.filename
                    filename = secure_filename(f"{uuid.uuid4()}_{original_filename}")
                    file_path = os.path.join(item_dir, filename)
                    file.save(file_path)
                    
                    # Determine is_main for this new file
                    is_main = False
                    if "images" in data:
                        match = next((img for img in data["images"] if img.get("name") == original_filename), None)
                        if match:
                            is_main = match.get("is_main", False)
                    
                    new_img = ItemImage(
                        item_id=item_id,
                        image=filename,
                        name=original_filename,
                        is_main=is_main
                    )
                    db.session.add(new_img)
                    current_count += 1

        # 6. Final Sync of is_main flag for existing images (that are still in DB)
        if "images" in data:
            from app.models import ItemImage
            for img_info in data["images"]:
                img_id = img_info.get("id")
                # Only process images that already had an ID
                if img_id:
                    db_img = ItemImage.query.get(img_id)
                    if db_img and db_img.item_id == item_id:
                        db_img.is_main = img_info.get("is_main", False)

        set_updated_fields(item)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Item updated successfully",
            "item": {
                "id": str(item.id),
                "item_name": item.item_name,
                "item_code": item.item_code
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Failed to update item",
            "details": str(e)
        }), 500

 
@item_blueprint.route("/<uuid:item_id>", methods=["DELETE"])
def delete_item(item_id):
    """
    Soft delete an item by setting is_deleted = True.
    ---
    tags:
      - Items
    parameters:
      - name: uuid
        in: path
        description: UUID of the item to delete
        required: true
        schema:
          type: uuid
    responses:
      200:
        description: Item soft-deleted successfully.
    """
    item = Item.query.get_or_404(item_id)
    item.is_deleted = True
    set_updated_fields(item)
    db.session.commit()
    return jsonify({"message": "Item soft-deleted successfully"})
