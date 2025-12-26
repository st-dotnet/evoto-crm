from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import ItemCategory
from app.utils.stamping import set_created_fields, set_updated_fields, set_business
from uuid import UUID

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
                  uuid:
                    type: string
                    format: uuid
                    description: Item category UUID
                  name:
                    type: string
                    description: Name of the item category
    """
    categories = ItemCategory.query.all()
    return jsonify([{'uuid': str(cat.uuid), 'name': cat.name} for cat in categories])


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
            required:
              - name
            properties:
              name:
                type: string
                description: Name of the item category
    responses:
      201:
        description: Item category created successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                uuid:
                  type: string
                  format: uuid
                name:
                  type: string
      400:
        description: Missing required field 'name'.
    """
    data = request.json or {}
    if not data.get("name"):
        return jsonify({"error": "Name is required"}), 400

    try:
        category = ItemCategory(name=data["name"].strip())
        set_created_fields(category)
        set_business(category)

        db.session.add(category)
        db.session.commit()

        return jsonify({
            "message": "Item category created successfully",
            "uuid": str(category.uuid),
            "name": category.name
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@item_category_blueprint.route("/<uuid:category_id>", methods=["PUT"])
def update_item_category(category_id):
    """
    Update an existing item category.
    ---
    tags:
      - Item Categories
    parameters:
      - name: category_id
        in: path
        description: UUID of the item category to update
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - name
            properties:
              name:
                type: string
                description: Updated name of the item category
    responses:
      200:
        description: Item category updated successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                uuid:
                  type: string
                  format: uuid
                name:
                  type: string
      400:
        description: Missing required field 'name'.
      404:
        description: Category not found.
    """
    data = request.json or {}
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    try:
        category = ItemCategory.query.get_or_404(category_id)
        category.name = data['name'].strip()
        set_updated_fields(category)
        db.session.commit()

        return jsonify({
            'message': 'Item category updated successfully',
            'uuid': str(category.uuid),
            'name': category.name
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@item_category_blueprint.route("/<uuid:category_id>", methods=["DELETE"])
def delete_item_category(category_id):
    """
    Delete an item category.
    ---
    tags:
      - Item Categories
    parameters:
      - name: category_id
        in: path
        description: UUID of the item category to delete
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Item category deleted successfully.
      404:
        description: Category not found.
    """
    try:
        category = ItemCategory.query.get_or_404(category_id)
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Item category deleted successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
