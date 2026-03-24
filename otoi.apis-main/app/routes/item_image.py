from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import ItemImage
from app.utils.stamping import set_created_fields, set_updated_fields
from app.utils.validators import is_allowed_image_file

item_image_blueprint = Blueprint("item_image", __name__)

@item_image_blueprint.route("/", methods=["POST"])
def upload_item_image():
    """
    Upload an item image.
    """
    import os
    from flask import current_app
    from werkzeug.utils import secure_filename

    item_id = request.form.get("item_id")
    is_main = request.form.get("is_main", "false").lower() == "true"
    file = request.files.get("image")

    if not item_id:
        return jsonify({"message": "item_id is required"}), 400
    
    if not file:
        return jsonify({"message": "No image file provided"}), 400

    if not is_allowed_image_file(file.filename):
        return jsonify({"message": "Invalid file type. Only JPG, JPEG, and PNG are allowed."}), 400

    # Create folder for item if not exists
    folder_path = os.path.join(current_app.config['ITEM_IMAGES_FOLDER'], str(item_id))
    os.makedirs(folder_path, exist_ok=True)
    
    # Enforce 4-image limit per item
    existing_count = ItemImage.query.filter_by(item_id=item_id).count()
    if existing_count >= 4:
        return jsonify({"message": "Maximum limit of 4 images reached for this product"}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(folder_path, filename)
    file.save(filepath)
    
    # If this image is set as main, unset all other images for this item as main
    if is_main:
        ItemImage.query.filter_by(item_id=item_id).update({"is_main": False})
    
    image = ItemImage(
        item_id=item_id,
        name=filename,
        image=filename, 
        is_main=is_main
    )
    set_created_fields(image)
    set_updated_fields(image)

    db.session.add(image)
    db.session.commit()
    return jsonify({"message": "Image uploaded successfully"}), 201


@item_image_blueprint.route("/<int:id>", methods=["DELETE"])
def delete_item_image(id):
    """
    Delete an item image.
    """
    import os
    from flask import current_app
    
    image = ItemImage.query.get_or_404(id)
    
    # Remove file from filesystem
    folder_path = os.path.join(current_app.config['ITEM_IMAGES_FOLDER'], str(image.item_id))
    filepath = os.path.join(folder_path, image.image)
    
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            current_app.logger.error(f"Failed to delete image file {filepath}: {e}")

    db.session.delete(image)
    db.session.commit()
    return jsonify({"message": "Image deleted successfully"}), 200


@item_image_blueprint.route("/item/<uuid:item_id>", methods=["DELETE"])
def delete_all_item_images(item_id):
    """
    Delete all images associated with a specific item.
    """
    import shutil
    import os
    from flask import current_app

    # Remove the whole directory for this item
    folder_path = os.path.join(current_app.config['ITEM_IMAGES_FOLDER'], str(item_id))
    if os.path.exists(folder_path):
        try:
            shutil.rmtree(folder_path)
        except Exception as e:
            current_app.logger.error(f"Failed to delete folder {folder_path}: {e}")

    ItemImage.query.filter_by(item_id=item_id).delete()
    db.session.commit()
    return jsonify({"message": "All item images deleted successfully"}), 200


@item_image_blueprint.route("/<int:id>", methods=["PATCH"])
def update_item_image_metadata(id):
    """
    Update image metadata (e.g., is_main).
    """
    image = ItemImage.query.get_or_404(id)
    data = request.get_json()
    
    if 'is_main' in data:
        is_main = bool(data['is_main'])
        if is_main:
            # Unset other images as main for this item
            ItemImage.query.filter_by(item_id=image.item_id).update({"is_main": False})
        image.is_main = is_main
        
    set_updated_fields(image)
    db.session.commit()
    
    return jsonify({"message": "Image metadata updated successfully"}), 200