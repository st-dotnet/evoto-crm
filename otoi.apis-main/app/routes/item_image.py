from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import ItemImage
from app.utils.stamping import set_created_fields, set_updated_fields
from app.utils.validators import is_allowed_image_file

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
                type: string
                format: uuid
                description: ID of the item
              name:
                type: string
                description: Original filename of the image
              image:
                type: string
                description: Base64 encoded image data
              is_main:
                type: boolean
                description: Flag to indicate if this is the feature image
    responses:
      201:
        description: Image uploaded successfully.
    """
    import base64

    data = request.json
    image_data = data["image"]
    name = data.get("name")
    is_main = data.get("is_main", False)
    
    # Validate filename if provided
    if name and not is_allowed_image_file(name):
        return jsonify({"message": "Invalid file type. Only JPG, JPEG, and PNG are allowed."}), 400

    # Strip base64 prefix if exists
    if "," in image_data:
        image_data = image_data.split(",")[1]
    
    decoded_image = base64.b64decode(image_data)
    
    # If this image is set as main, unset all other images for this item as main
    if is_main:
        ItemImage.query.filter_by(item_id=data["item_id"]).update({"is_main": False})
    
    image = ItemImage(
        item_id=data["item_id"],
        name=name,
        image=decoded_image,
        is_main=is_main
    )
    set_created_fields(image)
    # Explicitly set updated_fields so that updated_by correctly reflects the user who recreated this image
    set_updated_fields(image)

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


@item_image_blueprint.route("/item/<uuid:item_id>", methods=["DELETE"])
def delete_all_item_images(item_id):
    """
    Delete all images associated with a specific item.
    ---
    tags:
      - Item Images
    parameters:
      - name: item_id
        in: path
        description: UUID of the item
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: All item images deleted successfully.
    """
    ItemImage.query.filter_by(item_id=item_id).delete()
    db.session.commit()
    return jsonify({"message": "All item images deleted successfully"}), 200