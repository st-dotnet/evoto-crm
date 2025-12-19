from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models import Item, ItemCategory, MeasuringUnit
from app.utils.stamping import set_created_fields, set_updated_fields

item_blueprint = Blueprint("item", __name__, url_prefix="/items")

@item_blueprint.route("/", methods=["GET"])
def get_items():
    """
    Get all items.
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
        items = Item.query.all()
        result = []
        for item in items:
            try:
                # Safely get related objects
                category = getattr(item, 'category', None)
                item_type = getattr(item, 'item_type', None)
                measuring_unit = getattr(item, 'measuring_unit', None)                
                
                result.append({
                    "id": item.id,
                    "item_name": getattr(item, 'item_name', ''),
                    "item_type": getattr(item_type, 'name', None) if item_type else None,
                    "item_type_id": getattr(item, 'item_type_id', None),
                    "category": getattr(category, 'name', None) if category else None,
                    "category_id": getattr(item, 'category_id', None),
                    "sales_price": float(getattr(item, 'sales_price', 0.0)),
                    "purchase_price": float(getattr(item, 'purchase_price', 0.0)),
                    "gst_tax_rate": float(getattr(item, 'gst_tax_rate', 0.0)),
                    "opening_stock": float(getattr(item, 'opening_stock', 0.0)),
                    "item_code": getattr(item, 'item_code', ''),
                    "description": getattr(item, 'description', ''),
                    "measuring_unit": getattr(measuring_unit, 'name', None) if measuring_unit else None,
                    "measuring_unit_id": getattr(item, 'measuring_unit_id', None),
                    "business_id": getattr(item, 'business_id', None),
                   
                })
            except Exception as e:
                print(f"Error processing item {getattr(item, 'id', 'unknown')}: {str(e)}")
                continue
                
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in get_items: {str(e)}")
        return jsonify({"error": "Failed to fetch items", "details": str(e)}), 500


@item_blueprint.route("/", methods=["POST"])
def create_item():
    """
    Create a new item.
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
              item_code:
                type: string
                description: Unique item code
    responses:
      201:
        description: Item created successfully.
    """
    data = request.json or {}

    # Ensure a category exists for the provided category_id.
    # If it does not exist, create it automatically so that the
    # request does not fail with a 400 error.
    category_id = data.get("category_id")
    category = None
    if category_id is not None:
        category = ItemCategory.query.get(category_id)
        if not category:
            # Auto-create a category for this id with a default name.
            category = ItemCategory(id=category_id, name=str(category_id))
            set_created_fields(category)
            db.session.add(category)
            db.session.flush()
    if not category:
        return jsonify({"message": "Invalid category_id"}), 400

    # Ensure a measuring unit exists for the provided measuring_unit/measuring_unit_id.
    # We normalize names to match existing units in DB: PCS, KG, LITER.
    measuring_unit = None

    # 1) If client sends measuring_unit_id directly, trust and validate it.
    measuring_unit_id = data.get("measuring_unit_id")
    if measuring_unit_id is not None:
        measuring_unit = MeasuringUnit.query.get(measuring_unit_id)

    # 2) Otherwise, resolve from measuring_unit name.
    if measuring_unit is None:
        raw_unit = (data.get("measuring_unit") or "").strip().upper()

        UNIT_ALIASES = {
            "PCS": "PCS",
            "PIECE": "PCS",
            "UNIT": "PCS",
            "KG": "KG",
            "KILOGRAM": "KG",
            "KGS": "KG",
            "L": "LITER",
            "LTR": "LITER",
            "LITRE": "LITER",
            "LITER": "LITER",
        }

        unit_name = UNIT_ALIASES.get(raw_unit, raw_unit)

        if not unit_name:
            # No usable unit information
            return jsonify({"message": "measuring_unit or measuring_unit_id is required"}), 400

        measuring_unit = MeasuringUnit.query.filter_by(name=unit_name).first()

    # 3) If still not found, fail clearly instead of inserting NULL.
    if measuring_unit is None:
        return jsonify({"message": "Invalid measuring_unit or measuring_unit_id"}), 400

    item = Item(
        item_type_id=data["item_type_id"],
        category_id=category.id,
        measuring_unit_id=measuring_unit.id,
        item_name=data["item_name"],
        sales_price=data["sales_price"],
        purchase_price=data.get("purchase_price", 0),  # Default to 0 if not provided
        gst_tax_rate=data.get("gst_tax_rate", 0),    # Default to 0 if not provided
        opening_stock=data.get("opening_stock", 0),  # Default to 0 if not provided
        item_code=data.get("item_code", ""),         # Default to empty string if not provided
        description=data.get("description", ""),    # Default to empty string if not provided
    )
    set_created_fields(item)
    db.session.add(item)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        # Likely duplicate item_name or other constraint violation
        return jsonify({"message": "Item creation failed due to constraint violation", "detail": str(e.orig)}), 400

    return jsonify({"message": "Item created successfully"}), 201


@item_blueprint.route("/<int:id>", methods=["PUT"])
def update_item(id):
    """
    Update an existing item.
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
                description: Updated name of the item
              sales_price:
                type: number
                description: Updated sales price of the item
    responses:
      200:
        description: Item updated successfully.
    """
    data = request.json
    item = Item.query.get_or_404(id)
    item.item_name = data.get("item_name", item.item_name)
    item.sales_price = data.get("sales_price", item.sales_price)
    set_updated_fields(item)
    db.session.commit()
    return jsonify({"message": "Item updated successfully"})


@item_blueprint.route("/<int:id>", methods=["DELETE"])
def delete_item(id):
    """
    Delete an item.
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
        description: Item deleted successfully.
    """
    item = Item.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Item deleted successfully"})



