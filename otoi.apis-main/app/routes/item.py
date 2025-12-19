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
                  name:
                    type: string
                    description: Name of the item
                  type:
                    type: string
                    description: Item type
                  category:
                    type: string
                    description: Item category
                  sales_price:
                    type: number
                    format: float
                    description: Sales price of the item
    """
    items = Item.query.all()
    return jsonify([
        {
            "id": item.id,
            "name": item.item_name,
            "type": item.item_type.name,
            "category": item.item_category.name,
            "sales_price": item.sales_price,
            "business_id": item.business_id,
        } for item in items
    ])


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



