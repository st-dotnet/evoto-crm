from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import ItemImage

item_image_blueprint = Blueprint("item_image", __name__, url_prefix="/item-images")

@item_image_blueprint.route("/", methods=["POST"])
def upload_item_image():
    """
    Upload an item image.
    ---
    tags:
      - Item Images
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              item_id:
                type: integer
                description: ID of the item
              image:
                type: string
                format: binary
                description: Base64 encoded image data
    responses:
      201:
        description: Image uploaded successfully.
    """
    data = request.json
    image = ItemImage(
        item_id=data["item_id"],
        image=data["image"]
    )
    db.session.add(image)
    db.session.commit()
    return jsonify({"message": "Image uploaded successfully"}), 201


@item_image_blueprint.route("/<int:id>", methods=["DELETE"])
def delete_item_image(id):
    """
    Delete an item image.
    ---
    tags:
      - Item Images
    parameters:
      - name: id
        in: path
        description: ID of the item image to delete
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Image deleted successfully.
    """
    image = ItemImage.query.get_or_404(id)
    db.session.delete(image)
    db.session.commit()
    return jsonify({"message": "Image deleted successfully"})