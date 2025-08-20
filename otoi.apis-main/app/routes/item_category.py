from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import ItemCategory
from app.utils.stamping import set_created_fields, set_updated_fields, set_business

item_category_blueprint = Blueprint("item_category", __name__, url_prefix="/item-categories")

@item_category_blueprint.route("/", methods=["GET"])
def get_item_categories():
    """
    Get all item categories.
    ---
    tags:
      - Item Categories
    responses:
      200:
        description: A list of item categories.
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: Item category ID
                  name:
                    type: string
                    description: Name of the item category
    """
    categories = ItemCategory.query.all()
    return jsonify([{'id': cat.id, 'name': cat.name} for cat in categories])


@item_category_blueprint.route("/", methods=["POST"])
def create_item_category():
    """
    Create a new item category.
    ---
    tags:
      - Item Categories
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                description: Name of the item category
    responses:
      201:
        description: Item category created successfully.
    """
    data = request.json
    category = ItemCategory(name=data['name'])
    set_created_fields(category)
    set_business(category)
    db.session.add(category)
    db.session.commit()
    return jsonify({'message': 'Item category created successfully'}), 201


@item_category_blueprint.route("/<int:id>", methods=["PUT"])
def update_item_category(id):
    """
    Update an existing item category.
    ---
    tags:
      - Item Categories
    parameters:
      - name: id
        in: path
        description: ID of the item category to update
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
              name:
                type: string
                description: Updated name of the item category
    responses:
      200:
        description: Item category updated successfully.
    """
    data = request.json
    category = ItemCategory.query.get_or_404(id)
    category.name = data['name']
    set_updated_fields(category)
    db.session.commit()
    return jsonify({'message': 'Item category updated successfully'})


@item_category_blueprint.route("/<int:id>", methods=["DELETE"])
def delete_item_category(id):
    """
    Delete an item category.
    ---
    tags:
      - Item Categories
    parameters:
      - name: id
        in: path
        description: ID of the item category to delete
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Item category deleted successfully.
    """
    category = ItemCategory.query.get_or_404(id)
    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': 'Item category deleted successfully'})