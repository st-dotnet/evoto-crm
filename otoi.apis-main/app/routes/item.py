import random
import time
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
                "category_id": item.category_id,

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
                description: ID of the item type
              category_id:
                type: integer
                description: ID of the category
              sales_price:
                type: number
                description: Sales price of the item
              purchase_price:
                type: number
                description: Purchase price of the item
              gst_tax_rate:
                type: number
                description: GST tax rate
              opening_stock:
                type: number
                description: Opening stock of the item
              description:
                type: string
                description: Item description
              measuring_unit:
                type: string
                description: Measuring unit name
              measuring_unit_id:
                type: integer
                description: Measuring unit ID
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

    # Ensure category exists
    category_id = data.get("category_id")
    print("-----------------------------Processing category_id:", category_id)
    category = None
    if category_id is not None:
        category = ItemCategory.query.get(category_id)
        print("---------------------------Fetched category:", category.uuid if category else None)
        if not category:
            category = ItemCategory(id=category_id, name=str(category_id))
            set_created_fields(category)
            db.session.add(category)
            db.session.flush()
    if not category:
        return jsonify({"message": "Invalid category_id"}), 400
    print("-------------------------------Using category:", category.uuid if category else None)

    # Ensure measuring unit exists
    measuring_unit = None
    measuring_unit_id = data.get("measuring_unit_id")
    if measuring_unit_id:
        measuring_unit = MeasuringUnit.query.get(measuring_unit_id)

    if not measuring_unit:
        raw_unit = (data.get("measuring_unit") or "").strip().upper()
        UNIT_ALIASES = {
            "PCS": "PCS", "PIECE": "PCS", "UNIT": "PCS",
            "KG": "KG", "KILOGRAM": "KG", "KGS": "KG",
            "L": "LITER", "LTR": "LITER", "LITRE": "LITER", "LITER": "LITER",
        }
        unit_name = UNIT_ALIASES.get(raw_unit, raw_unit)
        measuring_unit = MeasuringUnit.query.filter_by(name=unit_name).first()

    if not measuring_unit:
        return jsonify({"message": "Invalid measuring_unit or measuring_unit_id"}), 400
    
    item_type_id = data["item_type_id"]

    # Handle Product vs Service safely
    if item_type_id == 2:  # Service
        purchase_price = None
        opening_stock = None
    else:  # Product
        purchase_price = data.get("purchase_price")
        opening_stock = data.get("opening_stock")


    # Generate unique item code
    def generate_item_code():
        prefix = "ITM"
        timestamp = int(time.time() * 1000) % 1000000  # Last 6 digits of timestamp
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
        category_id=category.uuid,
        measuring_unit_id=measuring_unit.id,

        item_name=data["item_name"],
        sales_price=data["sales_price"],
        gst_tax_rate=data.get("gst_tax_rate"),

        purchase_price=purchase_price,
        opening_stock=opening_stock,

        item_code=data.get("item_code") or None,
        hsn_code=data.get("hsn_code") or None,
        description=data.get("description") or None,    # Default to empty string if not provided
    )
    
    set_created_fields(item)
    db.session.add(item)
    
    try:
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
      404:
        description: Item not found
    """
    try:
        item = Item.query.filter_by(id=id, is_deleted=False).first()
        if not item:
            return jsonify({"error": "Item not found"}), 404
        
        category = item.category
        item_type = item.item_type
        measuring_unit = item.measuring_unit

        item_data = {
            "id": item.id,
            "item_name": item.item_name or "",
            "item_type": item_type.name if item_type else None,
            "item_type_id": item.item_type_id,
            "category": category.name if category else None,
            "category_id": item.category_id,
            "sales_price": float(item.sales_price or 0),
            "purchase_price": float(item.purchase_price or 0),
            "gst_tax_rate": float(item.gst_tax_rate or 0),
            "opening_stock": float(item.opening_stock or 0),
            "item_code": item.item_code or "",
            "description": item.description or "",
            "measuring_unit": measuring_unit.name if measuring_unit else None,
            "measuring_unit_id": item.measuring_unit_id,
        }
        
        # For HEAD requests, we still return the data since frontend needs it
        return jsonify(item_data)
    except Exception as e:
        print(f"Error in get_item: {str(e)}")
        return jsonify({"error": "Failed to fetch item", "details": str(e)}), 500


@item_blueprint.route("/<int:id>", methods=["PUT"])
def update_item(id):
    """
    Update an existing item.
    All fields are editable except item_code, which remains fixed once generated.
    ---
    tags:
      - Items
    parameters:
      - name: id
        in: path
        description: ID of the item to update
        required: true
        schema:
          type: integer
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              item_name:
                type: string
              sales_price:
                type: number
              purchase_price:
                type: number
              gst_tax_rate:
                type: number
              description:
                type: string
              category_id:
                type: integer
              measuring_unit_id:
                type: integer
              item_type_id:
                type: integer
              opening_stock:
                type: number
              show_in_online_store:
                type: boolean
              hsn_code:
                type: string
              alternative_unit:
                type: string
              low_stock_warning:
                type: boolean
              low_stock_quantity:
                type: number
              tax_type:
                type: string
              as_of_date:
                type: string
              measuring_unit:
                type: string
    responses:
      200:
        description: Item updated successfully
      400:
        description: Invalid input or duplicate item name
      404:
        description: Item not found
    """
    print("UPDATE HIT:", id)
    
    data = request.get_json() or {}
    print("Payload received:", data)
    
    # Never allow item_code update
    data.pop("item_code", None)
    
    item = Item.query.get_or_404(id)
    print("Before update:", item.item_name, item.sales_price)
    
    # Prevent update if item is soft-deleted
    if item.is_deleted:
        return jsonify({
            "message": "Cannot update a deleted item",
            "detail": f"Item with ID {id} has been deleted"
        }), 400
    
    try:
        # Duplicate item name check
        if "item_name" in data and data["item_name"] != item.item_name:
            existing_item = Item.query.filter(
                Item.item_name == data["item_name"],
                Item.id != id,
                Item.is_deleted.is_(False)
            ).first()
            
            if existing_item:
                return jsonify({
                    "message": "Item name already exists",
                    "detail": f"An item with name '{data['item_name']}' already exists"
                }), 400
        
        # Fields allowed to be updated
        allowed_fields = [
            "item_name",
            "sales_price",
            "purchase_price",
            "gst_tax_rate",
            "description",
            "category_id",
            "measuring_unit_id",
            "item_type_id",
            "opening_stock",
            "show_in_online_store",
            "hsn_code",
            "alternative_unit",
            "low_stock_warning",
            "low_stock_quantity",
            "tax_type",
            "as_of_date"
        ]
        
        # Safe update logic (skip empty strings)
        for field in allowed_fields:
            if field in data:
                value = data[field]
                
                # Skip empty string values from frontend forms
                if value == "":
                    continue
                
                setattr(item, field, value)
        
        # Update timestamps
        set_updated_fields(item)
        
        db.session.commit()
        
        print("After update:", item.item_name, item.sales_price)
        
        return jsonify({
            "message": "Item updated successfully",
            "item": {
                "id": item.id,
                "item_name": item.item_name,
                "item_code": item.item_code,  # unchanged
                "description": item.description or ""
            }
        }), 200
    
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({
            "message": "Update failed due to database constraint",
            "detail": str(e.orig) if hasattr(e, "orig") else str(e)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "message": "Update failed due to an error",
            "detail": str(e)
        }), 400



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
