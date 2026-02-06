from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models import Quotation, QuotationItem, Item
from app.utils.stamping import set_created_fields, set_updated_fields
import uuid as uuid_lib

quotation_blueprint = Blueprint("quotation", __name__)


def generate_quotation_number():
    """Generate a unique quotation number like QT-1001"""
    last_quotation = Quotation.query.order_by(Quotation.created_at.desc()).first()
    if last_quotation and last_quotation.quotation_number:
        try:
            last_num = int(last_quotation.quotation_number.split('-')[1])
            return f"QT-{last_num + 1}"
        except (IndexError, ValueError):
            pass
    return "QT-1001"


@quotation_blueprint.route("/next-number", methods=["GET"])
def get_next_quotation_number():
    """
    Get the next available quotation number
    ---
    tags:
      - Quotations
    responses:
      200:
        description: Next quotation number
    """
    try:
        next_number = generate_quotation_number()
        return jsonify({"next_quotation_number": next_number}), 200
    except Exception as e:
        return jsonify({"error": "Failed to generate quotation number", "details": str(e)}), 500


@quotation_blueprint.route("/", methods=["POST"])
def create_quotation():
    """
    Create a new quotation
    ---
    tags:
      - Quotations
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - business_id
              - customer_id
              - quotation_date
              - total_amount
            properties:
              business_id:
                type: integer
              customer_id:
                type: string
                format: uuid
              quotation_date:
                type: string
                format: date
              valid_till:
                type: string
                format: date
              total_amount:
                type: number
              charges:
                type: object
              additional_notes:
                type: object
              items:
                type: array
    responses:
      201:
        description: Quotation created successfully
      400:
        description: Validation error
      500:
        description: Server error
    """

    data = request.get_json()
    print("data===>:", data)
    try:
        # Generate quotation number
        quotation_number = data.get("quotation_number") or generate_quotation_number()
        
        # Build charges JSON
        charges = {
            "subtotal": data.get("subtotal", 0),
            "tax_total": data.get("total_tax", 0),
            "discount_total": data.get("total_discount", 0),
            "additional_charges_total": data.get("additional_charges_total", 0),
            "round_off": data.get("round_off", 0),
        }
        
        # Build additional_notes JSON
        additional_notes = {
            "notes": data.get("notes", ""),
            "terms_and_conditions": data.get("terms_and_conditions", ""),
            "version": 1,
        }
        
        quotation = Quotation(
            quotation_number=quotation_number,
            business_id=data["business_id"],
            customer_id=data["customer_id"],
            quotation_date=data["quotation_date"],
            valid_till=data.get("valid_till") or data.get("validity_date"),
            total_amount=data["total_amount"],
            charges=charges,
            status=data.get("status", "open"),
            additional_notes=additional_notes,
        )
        # set_created_fields(quotation, user_id=data.get("uuid"))
        db.session.add(quotation)
        db.session.flush()  # Get the UUID before committing

        # Process items
        for item_data in data.get("items", []):
            # Build discount JSON
            discount = {
                "discount_percentage": item_data.get("discount", 0),
                "discount_amount": item_data.get("discount_amount", 0),
            }
            
            # Build tax JSON
            tax = {
                "tax_percentage": item_data.get("tax", 0),
                "tax_amount": item_data.get("tax_amount", 0),
            }
            
            item = QuotationItem(
                quotation_id=quotation.uuid,
                item_id=item_data.get("item_id"),
                description=item_data.get("description"),
                quantity=item_data["quantity"],
                unit_price=item_data.get("unit_price") or item_data.get("price_per_item"),
                discount=discount,
                tax=tax,
                total_price=item_data.get("total_price") or item_data.get("amount"),
            )
            # set_created_fields(item, user_id=data.get("uuid"))
            db.session.add(item)

        db.session.commit()

        return jsonify({
            "message": "Quotation created successfully",
            "quotation_uuid": str(quotation.uuid),
            "quotation_number": quotation.quotation_number
        }), 201
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
    except KeyError as e:
        db.session.rollback()
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


@quotation_blueprint.route("/", methods=["GET"])
def get_quotations():
    """
    Get all quotations
    ---
    tags:
      - Quotations
    responses:
      200:
        description: A list of quotations
    """
    quotations = Quotation.query.order_by(Quotation.created_at.desc()).all()
    
    return jsonify({
        "data": [
            {
                "uuid": str(q.uuid),
                "quotation_number": q.quotation_number,
                "quotation_date": q.quotation_date.isoformat() if q.quotation_date else None,
                "valid_till": q.valid_till.isoformat() if q.valid_till else None,
                "customer_id": str(q.customer_id),
                "customer_name": f"{q.customer.first_name} {q.customer.last_name}" if q.customer else None,
                "total_amount": float(q.total_amount) if q.total_amount else 0,
                "status": q.status,
                "charges": q.charges,
                "created_at": q.created_at.isoformat() if q.created_at else None,
            }
            for q in quotations
        ]
    }), 200


@quotation_blueprint.route("/<uuid:quotation_id>", methods=["GET"])
def get_quotation(quotation_id):
    """
    Get a single quotation by UUID
    ---
    tags:
      - Quotations
    parameters:
      - name: quotation_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Detailed quotation information
      404:
        description: Quotation not found
    """
    quotation = Quotation.query.get_or_404(quotation_id)
    
    # Get item details with inventory info
    items_data = []
    for item in quotation.items:
        item_info = {
            "uuid": str(item.uuid),
            "item_id": str(item.item_id) if item.item_id else None,
            "description": item.description,
            "quantity": float(item.quantity) if item.quantity else 0,
            "unit_price": float(item.unit_price) if item.unit_price else 0,
            "discount": item.discount or {},
            "tax": item.tax or {},
            "total_price": float(item.total_price) if item.total_price else 0,
        }
        
        # Fetch product details from linked inventory item
        if item.item_id:
            inventory_item = Item.query.get(item.item_id)
            if inventory_item:
                item_info["product_name"] = inventory_item.item_name
                item_info["hsn_sac_code"] = inventory_item.hsn_code
                item_info["measuring_unit_id"] = inventory_item.measuring_unit_id
        
        items_data.append(item_info)

    quotation_data = {
        "uuid": str(quotation.uuid),
        "quotation_number": quotation.quotation_number,
        "business_id": quotation.business_id,
        "customer_id": str(quotation.customer_id),
        "customer": {
            "uuid": str(quotation.customer.uuid),
            "first_name": quotation.customer.first_name,
            "last_name": quotation.customer.last_name,
            "mobile": quotation.customer.mobile,
            "email": quotation.customer.email,
        } if quotation.customer else None,
        "quotation_date": quotation.quotation_date.isoformat() if quotation.quotation_date else None,
        "valid_till": quotation.valid_till.isoformat() if quotation.valid_till else None,
        "total_amount": float(quotation.total_amount) if quotation.total_amount else 0,
        "charges": quotation.charges or {},
        "status": quotation.status,
        "additional_notes": quotation.additional_notes or {},
        "items": items_data,
        "created_at": quotation.created_at.isoformat() if quotation.created_at else None,
        "updated_at": quotation.updated_at.isoformat() if quotation.updated_at else None,
    }

    return jsonify(quotation_data), 200


@quotation_blueprint.route("/<uuid:quotation_id>", methods=["PUT"])
def update_quotation(quotation_id):
    """
    Update a quotation with items
    ---
    tags:
      - Quotations
    parameters: 
      - name: quotation_id
        in: path
        required: true
        type: string
        format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              quotation_date:
                type: string
                format: date
              valid_till:
                type: string
                format: date
              total_amount:
                type: number
              status:
                type: string
              charges:
                type: object
              additional_notes:
                type: object
              items:
                type: array
    responses:
      200:
        description: Quotation updated successfully
      400:  
        description: Validation error
      404:
        description: Quotation not found
      500:  
        description: Server error

    """
    data = request.get_json()
    quotation = Quotation.query.get_or_404(quotation_id)

    try:
        # -----------------------------
        # Update quotation basic fields
        # -----------------------------
        quotation.quotation_date = data.get("quotation_date", quotation.quotation_date)
        quotation.valid_till = data.get("valid_till") or data.get("validity_date") or quotation.valid_till
        quotation.total_amount = data.get("total_amount", quotation.total_amount)
        quotation.status = data.get("status", quotation.status)

        # -----------------------------
        # Update charges JSON
        # -----------------------------
        quotation.charges = {
            "subtotal": data.get("subtotal", quotation.charges.get("subtotal", 0)),
            "tax_total": data.get("total_tax", quotation.charges.get("tax_total", 0)),
            "discount_total": data.get("total_discount", quotation.charges.get("discount_total", 0)),
            "additional_charges_total": data.get(
                "additional_charges_total",
                quotation.charges.get("additional_charges_total", 0),
            ),
            "round_off": data.get("round_off", quotation.charges.get("round_off", 0)),
        }

        # -----------------------------
        # Update additional_notes JSON
        # -----------------------------
        additional_notes = quotation.additional_notes or {}
        additional_notes["notes"] = data.get("notes", additional_notes.get("notes", ""))
        additional_notes["terms_and_conditions"] = data.get(
            "terms_and_conditions",
            additional_notes.get("terms_and_conditions", ""),
        )
        additional_notes["version"] = additional_notes.get("version", 0) + 1
        quotation.additional_notes = additional_notes

        # -----------------------------
        # Update quotation items
        # Strategy: delete + reinsert
        # -----------------------------
        QuotationItem.query.filter_by(quotation_id=quotation.uuid).delete()

        for item_data in data.get("items", []):
            discount = {
                "discount_percentage": item_data.get("discount", 0),
                "discount_amount": item_data.get("discount_amount", 0),
            }

            tax = {
                "tax_percentage": item_data.get("tax", 0),
                "tax_amount": item_data.get("tax_amount", 0),
            }

            item = QuotationItem(
                quotation_id=quotation.uuid,
                item_id=item_data.get("item_id"),
                description=item_data.get("description"),
                quantity=item_data["quantity"],
                unit_price=item_data.get("unit_price") or item_data.get("price_per_item"),
                discount=discount,
                tax=tax,
                total_price=item_data.get("total_price") or item_data.get("amount"),
            )
            db.session.add(item)

        db.session.commit()

        return jsonify({
            "message": "Quotation updated successfully",
            "quotation_uuid": str(quotation.uuid),
            "quotation_number": quotation.quotation_number
        }), 200

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500
    

    

@quotation_blueprint.route("/<uuid:quotation_id>", methods=["DELETE"])
def delete_quotation(quotation_id):
    """
    Delete a quotation
    ---
    tags:
      - Quotations
    parameters:
      - name: quotation_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Quotation deleted successfully
      404:
        description: Quotation not found
    """
    quotation = Quotation.query.get_or_404(quotation_id)
    try:
        db.session.delete(quotation)
        db.session.commit()
        return jsonify({"message": "Quotation deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500
