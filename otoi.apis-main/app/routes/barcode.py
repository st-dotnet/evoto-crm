from flask import Blueprint, send_file, request, jsonify
from app.services.barcode_service import generate_barcode
from app.extensions import db
from app.models.inventory import Item

barcode_blueprint = Blueprint("barcode", __name__)

# --------------------------------------------------
# PREVIEW BARCODE (UI ONLY - NO ITEM CODE GENERATED)
# --------------------------------------------------
@barcode_blueprint.route("/preview", methods=["GET"])
def preview_barcode():
    """
    UI-only preview.
    DOES NOT generate or return item_code.
    """
    item_name = request.args.get("item_name", "Sample Item")

    try:
        barcode_image = generate_barcode(
            item_code="PREVIEW-ONLY",
            item_name=item_name,
        )
        return send_file(
            barcode_image,
            mimetype="image/png",
            as_attachment=False,
        )
    except Exception as e:
        return jsonify({
            "error": "Failed to generate preview barcode",
            "details": str(e)
        }), 500


# --------------------------------------------------
# REAL BARCODE (FROM EXISTING ITEM ONLY)
# --------------------------------------------------
@barcode_blueprint.route("/<int:item_id>", methods=["GET"])
def get_item_barcode(item_id):
    """
    Generate barcode for an EXISTING item.
    Uses stored item_code ONLY.
    """
    item = db.session.get(Item, item_id)

    if not item:
        return jsonify({"error": "Item not found"}), 404

    if not item.item_code:
        return jsonify({
            "error": "Item code not generated for this item",
            "item_id": item_id
        }), 400

    try:
        barcode_image = generate_barcode(
            item_code=item.item_code,
            item_name=item.item_name,
        )
        return send_file(
            barcode_image,
            mimetype="image/png",
            as_attachment=False,
        )
    except Exception as e:
        return jsonify({
            "error": "Failed to generate barcode",
            "details": str(e)
        }), 500


@barcode_blueprint.route("/test", methods=["GET"])
def test_route():
    return "Barcode service is working!"
