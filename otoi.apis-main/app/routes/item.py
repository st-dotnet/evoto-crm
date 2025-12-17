# from flask import Blueprint, request, jsonify
# from app.extensions import db
# from app.models import Item
# from app.utils.stamping import set_created_fields, set_updated_fields

# item_blueprint = Blueprint("item", __name__, url_prefix="/items")

# @item_blueprint.route("/", methods=["GET"])
# def get_items():
#     """
#     Get all items.
#     ---
#     tags:
#       - Items
#     responses:
#       200:
#         description: A list of items.
#         content:
#           application/json:
#             schema:
#               type: array
#               items:
#                 type: object
#                 properties:
#                   id:
#                     type: integer
#                     description: Item ID
#                   name:
#                     type: string
#                     description: Name of the item
#                   type:
#                     type: string
#                     description: Item type
#                   category:
#                     type: string
#                     description: Item category
#                   sales_price:
#                     type: number
#                     format: float
#                     description: Sales price of the item
#     """
#     items = Item.query.all()
#     return jsonify([
#         {
#             "id": item.id,
#             "name": item.item_name,
#             "type": item.item_type.name,
#             "category": item.item_category.name,
#             "sales_price": item.sales_price,
#             "business_id": item.business_id,
#         } for item in items
#     ])


# @item_blueprint.route("/", methods=["POST"])
# def create_item():
#     """
#     Create a new item.
#     ---
#     tags:
#       - Items
#     requestBody:
#       required: true
#       content:
#         application/json:
#           schema:
#             type: object
#             properties:
#               item_name:
#                 type: string
#                 description: Name of the item
#               item_type_id:
#                 type: integer
#                 description: ID of the item type
#               category_id:
#                 type: integer
#                 description: ID of the category
#               sales_price:
#                 type: number
#                 description: Sales price of the item
#               purchase_price:
#                 type: number
#                 description: Purchase price of the item
#               gst_tax_rate:
#                 type: number
#                 description: GST tax rate
#               opening_stock:
#                 type: number
#                 description: Opening stock of the item
#               item_code:
#                 type: string
#                 description: Unique item code
#     responses:
#       201:
#         description: Item created successfully.
#     """
#     data = request.json
#     item = Item(
#         item_type_id=data["item_type_id"],
#         category_id=data["category_id"],
#         item_name=data["item_name"],
#         sales_price=data["sales_price"],
#         purchase_price=data["purchase_price"],
#         gst_tax_rate=data["gst_tax_rate"],
#         opening_stock=data["opening_stock"],
#         item_code=data["item_code"],
#         description=data.get("description"),
#     )
#     set_created_fields(item)
#     db.session.add(item)
#     db.session.commit()
#     return jsonify({"message": "Item created successfully"}), 201


# @item_blueprint.route("/<int:id>", methods=["PUT"])
# def update_item(id):
#     """
#     Update an existing item.
#     ---
#     tags:
#       - Items
#     parameters:
#       - name: id
#         in: path
#         description: ID of the item to update
#         required: true
#         schema:
#           type: integer
#     requestBody:
#       required: true
#       content:
#         application/json:
#           schema:
#             type: object
#             properties:
#               item_name:
#                 type: string
#                 description: Updated name of the item
#               sales_price:
#                 type: number
#                 description: Updated sales price of the item
#     responses:
#       200:
#         description: Item updated successfully.
#     """
#     data = request.json
#     item = Item.query.get_or_404(id)
#     item.item_name = data.get("item_name", item.item_name)
#     item.sales_price = data.get("sales_price", item.sales_price)
#     set_updated_fields(item)
#     db.session.commit()
#     return jsonify({"message": "Item updated successfully"})


# @item_blueprint.route("/<int:id>", methods=["DELETE"])
# def delete_item(id):
#     """
#     Delete an item.
#     ---
#     tags:
#       - Items
#     parameters:
#       - name: id
#         in: path
#         description: ID of the item to delete
#         required: true
#         schema:
#           type: integer
#     responses:
#       200:
#         description: Item deleted successfully.
#     """
#     item = Item.query.get_or_404(id)
#     db.session.delete(item)
#     db.session.commit()
#     return jsonify({"message": "Item deleted successfully"})

from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.inventory import Item, MeasuringUnit

# =========================
# Blueprint (TOP OF FILE)
# =========================
items_bp = Blueprint("items", __name__, url_prefix="/api/items")


@items_bp.route("/", methods=["POST"])
def create_item():
    data = request.get_json() or {}

    required_fields = [
        "item_name",
        "item_type_id",
        "category_id",
        "sales_price",
        "gst_tax_rate",
        "measuring_unit",
        "opening_stock"
    ]

    for field in required_fields:
        if field not in data:
            return jsonify({"message": f"{field} is required"}), 400

    # ---------------------------------
    # Normalize measuring unit input
    # ---------------------------------
    unit_input = data["measuring_unit"].strip().upper()

    UNIT_ALIASES = {
        "L": "LITER",
        "LTR": "LITER",
        "LITRE": "LITER"
    }

    unit_name = UNIT_ALIASES.get(unit_input, unit_input)

    measuring_unit = MeasuringUnit.query.filter_by(name=unit_name).first()

    if not measuring_unit:
        return jsonify({"message": "Invalid measuring unit"}), 400

    item = Item(
        item_name=data["item_name"].strip(),
        item_type_id=data["item_type_id"],
        category_id=data["category_id"],
        measuring_unit_id=measuring_unit.id,
        sales_price=data["sales_price"],
        gst_tax_rate=data["gst_tax_rate"],
        opening_stock=data["opening_stock"],
    )

    db.session.add(item)
    db.session.commit()

    # Return frontend-friendly response
    response_data = {
        "item_name": data["item_name"].strip(),
        "item_type_id": data["item_type_id"],
        "category_id": data["category_id"],
        "measuring_unit": measuring_unit.name,
        "sales_price": data["sales_price"],
        "gst_tax_rate": data["gst_tax_rate"],
        "opening_stock": data["opening_stock"],
    }

    return jsonify({
        "message": "Item saved successfully",
        "item_id": item.id,
        "data": response_data
    }), 201


