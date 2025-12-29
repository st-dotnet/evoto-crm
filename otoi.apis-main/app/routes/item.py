import random
import time
from click import UUID
from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models import Item, ItemCategory, MeasuringUnit
from app.utils.stamping import set_created_fields, set_updated_fields

item_blueprint = Blueprint("item", __name__, url_prefix="/items")
@item_blueprint.route("/", methods=["GET"])
def get_items():
    """
    Get all items (excluding soft-deleted items).
    ---
    tags:
      - Items
    responses:
      200:
        description: A list of items.
        content:
          application/json:
            schema:
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
        items = Item.query.filter_by(is_deleted=False).all()
        result = []

        for item in items:
            category = item.category
            item_type = item.item_type
            measuring_unit = item.measuring_unit

            result.append({
                "id": item.id,
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
                "description": item.description or "",

                "measuring_unit": measuring_unit.name if measuring_unit else None,
                "measuring_unit_id": item.measuring_unit_id,
            })

        return jsonify(result)

    except Exception as e:
        print(f"Error in get_items: {str(e)}")
        return jsonify({
            "error": "Failed to fetch items",
            "details": str(e)
        }), 500


@item_blueprint.route("/", methods=["POST"])
def create_item():
    """
    Create a new item with auto-generated item code.
    ---
    tags:
      - Items
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              item_name:
                type: string
                description: Name of the item
              item_type_id:
                type: integer
              category_id:
                type: string
                format: uuid
              sales_price:
                type: number
              purchase_price:
                type: number
              gst_tax_rate:
                type: number
              description:
                type: string
              measuring_unit_id:
                type: integer
    responses:
      201:
        description: Item created successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                item:
                  type: object
                  properties:
                    id:
                      type: integer
                    item_name:
                      type: string
                    item_code:
                      type: string
                    description:
                      type: string
    """
    data = request.json or {}
    print(f"Received create item request with data: {data}")

    # Check for duplicate name
    if Item.query.filter_by(item_name=data.get('item_name'), is_deleted=False).first():
        return jsonify({
            "message": "An item with this name already exists",
            "suggestion": "Please choose a different name"
        }), 400

    try:
        # Handle category
        category_id = data.get("category_id")
        category = None
        if category_id:
            try:
                category_uuid = UUID(category_id)
                # category = ItemCategory.query.filter_by(uuid=category_uuid).first()
                category = ItemCategory.query.filter(ItemCategory.uuid == category_uuid).first()

            except (ValueError):
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
        if item_type_id == 2:  # Service
            purchase_price = None
            opening_stock = None
        else:
            purchase_price = data.get('purchase_price')
            opening_stock = data.get('opening_stock')

        # Generate unique item code
        def generate_item_code():
            prefix = "ITM"
            timestamp = int(time.time() * 1000) % 1000000
            random_suffix = ''.join(random.choices('0123456789', k=4))
            return f"{prefix}{timestamp}{random_suffix}"

        # Ensure item code is unique
        max_attempts = 5
        for _ in range(max_attempts):
            item_code = generate_item_code()
            if not Item.query.filter_by(item_code=item_code).first():
                break
        else:
            return jsonify({"message": "Failed to generate unique item code"}), 500

        # Create item
        item = Item(
            item_type_id=item_type_id,
            category_id=category.uuid if category else None,
            measuring_unit_id=measuring_unit.id,
            item_name=data["item_name"],
            sales_price=data.get("sales_price", 0),
            gst_tax_rate=data.get("gst_tax_rate", 0),
            purchase_price=purchase_price,
            opening_stock=opening_stock,
            item_code=item_code,
            hsn_code=data.get("hsn_code") or None,
            description=data.get("description") or ""
        )
        
        set_created_fields(item)
        db.session.add(item)
        db.session.commit()
        
        return jsonify({
            "message": "Item created successfully",
            "item": {
                "id": item.id,
                "item_name": item.item_name,
                "item_code": item.item_code,
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


@item_blueprint.route("/<int:id>", methods=["GET", "HEAD"])
def get_item(id):
    """
    Get a specific item by ID (excluding soft-deleted items).
    ---
    tags:
      - Items
    parameters:
      - name: id
        in: path
        description: ID of the item to retrieve
        required: true
        schema:
          type: integer
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
        if not isinstance(id, int) or id <= 0:
            return jsonify({"error": "Invalid item ID"}), 400
            
        # Get item with related data in a single query using joins
        item = db.session.query(Item).options(
            db.joinedload(Item.category),
            db.joinedload(Item.item_type),
            db.joinedload(Item.measuring_unit)
        ).filter(
            Item.id == id,
            Item.is_deleted.is_(False)
        ).first()
        
        if not item:
            return jsonify({"error": f"Item with ID {id} not found"}), 404
        
        # Format the response
        item_data = {
            "id": item.id,
            "item_name": item.item_name or "",
            "item_type": item.item_type.name if item.item_type else None,
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
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None
        }
        
        return jsonify(item_data)
        
    except Exception as e:
        db.session.rollback()
        print(f"Error in get_item: {str(e)}")
        return jsonify({
            "error": "Failed to fetch item",
            "details": str(e)
        }), 500


@item_blueprint.route("/<int:id>", methods=["PUT"])
def update_item(id):
    try:
        # 1️⃣ Basic validation
        if not isinstance(id, int) or id <= 0:
            return jsonify({"error": "Invalid item ID"}), 400

        data = request.get_json() or {}
        if not data:
            return jsonify({"error": "No data provided for update"}), 400

        # Never allow item_code to be updated
        data.pop("item_code", None)

        print(f"Updating item {id} with data: {data}")

        # 2️⃣ Fetch item with lock
        item = db.session.query(Item).with_for_update().get(id)
        if not item or item.is_deleted:
            return jsonify({"error": "Item not found or has been deleted"}), 404

        errors = {}

        # 3️⃣ Validate item name (duplicate check)
        if "item_name" in data:
            new_name = data["item_name"].strip()
            if not new_name:
                errors.setdefault("item_name", []).append("Item name cannot be empty")
            elif new_name != item.item_name:
                existing = db.session.query(Item).filter(
                    Item.item_name == new_name,
                    Item.id != id,
                    Item.is_deleted.is_(False)
                ).first()
                if existing:
                    errors.setdefault("item_name", []).append(
                        "An item with this name already exists"
                    )

        # 4️⃣ Validate category (UUID FIX ✅)
        if "category_id" in data:
            if not data["category_id"]:
                item.category_id = None
            else:
                category = ItemCategory.query.filter_by(
                    uuid=data["category_id"]
                ).first()
                if not category:
                    errors.setdefault("category_id", []).append("Invalid category")
                else:
                    item.category_id = category.uuid

        # 5️⃣ Validate measuring unit
        if "measuring_unit_id" in data:
            if not data["measuring_unit_id"]:
                errors.setdefault("measuring_unit_id", []).append(
                    "Measuring unit is required"
                )
            else:
                measuring_unit = MeasuringUnit.query.get(data["measuring_unit_id"])
                if not measuring_unit:
                    errors.setdefault("measuring_unit_id", []).append(
                        "Invalid measuring unit"
                    )
                else:
                    item.measuring_unit_id = measuring_unit.id

        # 6️⃣ Validate numeric fields
        numeric_fields = {
            "sales_price": (0, None),
            "purchase_price": (0, None),
            "gst_tax_rate": (0, 100),
            "opening_stock": (0, None),
        }

        for field, (min_val, max_val) in numeric_fields.items():
            if field in data and data[field] is not None:
                try:
                    value = float(data[field])
                    if value < min_val or (max_val is not None and value > max_val):
                        errors.setdefault(field, []).append(
                            f"Must be between {min_val} and {max_val}"
                        )
                except (ValueError, TypeError):
                    errors.setdefault(field, []).append("Must be a valid number")

        # 7️⃣ Return validation errors
        if errors:
            return jsonify({
                "error": "Validation error",
                "details": errors
            }), 400

        # 8️⃣ Update allowed fields only
        update_fields = [
            "item_name",
            "item_type_id",
            "sales_price",
            "purchase_price",
            "gst_tax_rate",
            "opening_stock",
            "description",
            "hsn_code",
        ]

        for field in update_fields:
            if field in data:
                setattr(item, field, data[field])

        # 9️⃣ Service vs Product logic
        if data.get("item_type_id") == 2:  # Service
            item.purchase_price = None
            item.opening_stock = None

        # 🔟 Update timestamps
        set_updated_fields(item)

        db.session.commit()

        return jsonify({
            "message": "Item updated successfully",
            "item": {
                "id": item.id,
                "item_name": item.item_name,
                "item_code": item.item_code,
                "category_id": str(item.category_id) if item.category_id else None
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error in update_item: {str(e)}")
        return jsonify({
            "error": "Failed to update item",
            "details": str(e)
        }), 500

 
@item_blueprint.route("/<int:id>", methods=["GET"])
def get_item_by_id(id):
    """
    Get single item by ID.
    ---
    tags:
      - Items
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Item details
    """
    item = Item.query.get_or_404(id)
 
    return jsonify({
       "id": item.id,
 
        "item_name": item.item_name,
        "item_type_id": item.item_type_id,
 
        # UUID stays UUID
        "category_id": str(item.category_id),
 
        "measuring_unit_id": item.measuring_unit_id,
 
        "sales_price": float(item.sales_price or 0),
        "purchase_price": (
            float(item.purchase_price)
            if item.purchase_price is not None else None
        ),
        "gst_tax_rate": float(item.gst_tax_rate or 0),
        "opening_stock": (
            float(item.opening_stock)
            if item.opening_stock is not None else None
        ),
 
        "item_code": item.item_code,
        "hsn_code": item.hsn_code,
        "description": item.description,
    })
 

@item_blueprint.route("/<int:id>", methods=["DELETE"])
def delete_item(id):
    """
    Soft delete an item by setting is_deleted = True.
    ---
    tags:
      - Items
    parameters:
      - name: id
        in: path
        description: ID of the item to delete
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Item soft-deleted successfully.
    """
    item = Item.query.get_or_404(id)
    item.is_deleted = True
    set_updated_fields(item)
    db.session.commit()
    return jsonify({"message": "Item soft-deleted successfully"})
