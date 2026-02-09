from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.purchase import PurchaseEntry
from app.utils.stamping import set_created_fields, set_updated_fields, set_business
from sqlalchemy import or_
from datetime import datetime

purchase_blueprint = Blueprint("purchase", __name__, url_prefix="/purchase")

@purchase_blueprint.route("/", methods=["GET"])
def get_purchase_entries():
    """
    Fetch a list of purchase entries with filtering and pagination.
    ---
    parameters:
      - name: query
        in: query
        description: Search by invoice number
        required: false
        schema:
          type: string
      - name: page
        in: query
        description: "Page number (default: 1)"
        required: false
        schema:
          type: integer
          default: 1
      - name: items_per_page
        in: query
        description: "Number of records per page (default: 10)"
        required: false
        schema:
          type: integer
          default: 10
    responses:
      200:
        description: A list of purchase entries
      500:
        description: Internal server error
    """
    try:
        query = PurchaseEntry.query
        
        # Search functionality
        search_query = request.args.get("query", "").strip()
        if search_query:
            query = query.filter(
                or_(
                    PurchaseEntry.invoice_number.ilike(f"%{search_query}%"),
                    # Add other searchable fields if needed
                )
            )
        # Return all purchase for dropdown if requested
        if request.args.get("dropdown") == "true":
            return jsonify([
                {
                    "uuid": str(c.uuid),
                    "name": f"{c.invoice_number}".strip()
                }
                for c in query.all()
            ])

        # Sorting
        sort = request.args.get("sort", "created_at")
        order = request.args.get("order", "desc")
        
        valid_sort_fields = ["invoice_number", "date", "amount", "entered_bill", "created_at"]
        if sort not in valid_sort_fields:
            sort = "created_at"

        sort_column = getattr(PurchaseEntry, sort)
        if order == "desc":
            query = query.order_by(db.desc(sort_column))
        else:
            query = query.order_by(sort_column)

        # Pagination
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("items_per_page", 5))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        entries = pagination.items

        result = []
        for entry in entries:
            result.append({
                "uuid": str(entry.uuid),
                "invoice_number": entry.invoice_number,
                "date": entry.date.isoformat() if entry.date else None,
                "amount": entry.amount,
                "entered_bill": entry.entered_bill
            })

        return jsonify({
            "pages": pagination.pages,
            "data": result,
            "pagination": {"total": pagination.total}
        })
    except Exception as e:
        import traceback; print("ERROR in get_purchase_entries:", traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@purchase_blueprint.route("/", methods=["POST"])
def create_purchase_entry():
    """
    Create a new purchase entry.
    ---
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            invoice_number:
              type: string
              example: "INV-001"
            date:
              type: string
              format: date
              example: "2023-10-27"
            amount:
              type: number
              example: 1500.50
            entered_bill:
              type: boolean
              example: true
    responses:
      201:
        description: Purchase entry created successfully
      400:
        description: Invalid input or missing required fields
      500:
        description: Internal server error
    """
    try:
        data = request.get_json() or {}
        
        invoice_number = data.get("invoice_number")
        entry_date_str = data.get("date")
        amount = data.get("amount")
        entered_bill = data.get("entered_bill", False)

        if not all([invoice_number, entry_date_str, amount is not None]):
            return jsonify({"error": "Invoice number, date, and amount are required"}), 400

        try:
            entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        entry = PurchaseEntry(
            invoice_number=invoice_number,
            date=entry_date,
            amount=float(amount),
            entered_bill=bool(entered_bill)
        )

        set_created_fields(entry)
        set_business(entry)
        db.session.add(entry)
        db.session.commit()

        return jsonify({
            "message": "Purchase entry created successfully",
            "uuid": str(entry.uuid)
        }), 201
    except Exception as e:
        db.session.rollback()
        import traceback; print("ERROR in create_purchase_entry:", traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@purchase_blueprint.route("/<uuid:entry_id>", methods=["GET"])
def get_purchase_entry(entry_id):
    """
    Get a single purchase entry by UUID.
    ---
    parameters:
      - name: entry_id
        in: path
        description: Unique ID of the purchase entry
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Purchase entry details
      404:
        description: Purchase entry not found
    """
    entry = PurchaseEntry.query.get_or_404(entry_id)
    return jsonify({
        "uuid": str(entry.uuid),
        "invoice_number": entry.invoice_number,
        "date": entry.date.isoformat() if entry.date else None,
        "amount": entry.amount,
        "entered_bill": entry.entered_bill
    })

@purchase_blueprint.route("/<uuid:entry_id>", methods=["PUT"])
def update_purchase_entry(entry_id):
    """
    Update an existing purchase entry.
    ---
    parameters:
      - name: entry_id
        in: path
        description: Unique ID of the purchase entry
        required: true
        schema:
          type: string
          format: uuid
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            invoice_number:
              type: string
            date:
              type: string
              format: date
            amount:
              type: number
            entered_bill:
              type: boolean
    responses:
      200:
        description: Purchase entry updated successfully
      400:
        description: Invalid input
      404:
        description: Purchase entry not found
      500:
        description: Internal server error
    """
    try:
        data = request.get_json() or {}
        entry = PurchaseEntry.query.get_or_404(entry_id)

        if "invoice_number" in data:
            entry.invoice_number = data["invoice_number"]
        if "date" in data:
            try:
                entry.date = datetime.strptime(data["date"], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
        if "amount" in data:
            entry.amount = float(data["amount"])
        if "entered_bill" in data:
            entry.entered_bill = bool(data["entered_bill"])

        set_updated_fields(entry)
        db.session.commit()
        return jsonify({"message": "Purchase entry updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        import traceback; print("ERROR in update_purchase_entry:", traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@purchase_blueprint.route("/<uuid:entry_id>", methods=["DELETE"])
def delete_purchase_entry(entry_id):
    """
    Delete a purchase entry.
    ---
    parameters:
      - name: entry_id
        in: path
        description: Unique ID of the purchase entry
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Purchase entry deleted successfully
      404:
        description: Purchase entry not found
      500:
        description: Internal server error
    """
    try:
        entry = PurchaseEntry.query.get_or_404(entry_id)
        db.session.delete(entry)
        db.session.commit()
        return jsonify({"message": "Purchase entry deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        import traceback; print("ERROR in delete_purchase_entry:", traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500
