from flask import Blueprint, request, jsonify, send_file
from app.extensions import db
from app.models import ProfileImage
from app.models.person import Person
import io

profile_image_blueprint = Blueprint("profile_image", __name__)

@profile_image_blueprint.route("/", methods=["POST"])
def upload_profile_image():
    """
    Upload a profile image (multipart/form-data).
    ---
    tags:
      - Profile Images
    requestBody:
      required: true
      content:
        multipart/form-data:
          schema:
            type: object
            properties:
              person_id:
                type: string
                description: UUID of the person
              image:
                type: string
                format: binary
                description: Image file
    responses:
      201:
        description: Image uploaded successfully.
    """
    try:
        person_id = request.form.get("person_id")
        file = request.files.get("image")

        if not person_id or not file:
            return jsonify({"error": "person_id and image file are required"}), 400

        # Validate person exists
        person = Person.query.filter_by(uuid=person_id).first()
        if not person:
            return jsonify({"error": "Person not found"}), 404

        content = file.read()
        if not content:
            return jsonify({"error": "Empty file"}), 400

        image = ProfileImage(
            person_id=person.uuid,
            image=content,
            filename=file.filename,
            mime_type=file.mimetype,
        )
        db.session.add(image)
        db.session.commit()
        return jsonify({
            "message": "Image uploaded successfully",
            "id": image.id,
            "person_id": str(person.uuid)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@profile_image_blueprint.route("/<int:id>", methods=["DELETE"])
def delete_profile_image(id):
    """
    Delete an profile image.
    ---
    tags:
      - Profile Images
    parameters:
      - name: id
        in: path
        description: ID of the profile image to delete
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Image deleted successfully.
    """
    image = ProfileImage.query.get_or_404(id)
    db.session.delete(image)
    db.session.commit()
    return jsonify({"message": "Image deleted successfully"})


@profile_image_blueprint.route("/person/<uuid:person_id>/latest", methods=["GET"]) 
def get_latest_profile_image(person_id):
    """
    Fetch the latest profile image for a person.
    """
    image = (
        ProfileImage.query
        .filter_by(person_id=person_id)
        .order_by(ProfileImage.created_at.desc())
        .first()
    )
    if not image:
        return jsonify({"error": "Image not found"}), 404
    return send_file(
        io.BytesIO(image.image),
        mimetype=image.mime_type or "application/octet-stream",
        as_attachment=False,
        download_name=image.filename or "avatar"
    )