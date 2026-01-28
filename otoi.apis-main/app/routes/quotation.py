from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models import Quotation, QuotationItem
from app.utils.stamping import set_created_fields, set_updated_fields

quotation_blueprint = Blueprint("quotation", __name__)

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
                type: string
                format: uuid
              customer_id:
                type: string
                format: uuid
              quotation_date:
                type: string
                format: date
              total_amount:
                type: number
              items:
                type: array
                items:
                  type: object
                  required:
                    - product_name
                    - quantity
                    - unit_price
                    - total_price
                  properties:
                    product_name:
                      type: string
                    quantity:
                      type: number
                    unit_price:
                      type: number
                    tax_rate:
                      type: number
                    discount:
                      type: number
                    total_price:
                      type: number
    responses:
      201:
        description: Quotation created successfully
      400:
        description: Validation error
      500:
        description: Server error
    """

    data = request.get_json()
    try:
        quotation = Quotation(
            business_id=data["business_id"],
            customer_id=data["customer_id"],
            billing_address_id=data["billing_address_id"],
            shipping_address_id=data["shipping_address_id"],
            quotation_date=data["quotation_date"],
            valid_till=data.get("valid_till"),
            subtotal=data.get("subtotal", 0),
            tax_total=data.get("tax_total", 0),
            discount_total=data.get("discount_total", 0),
            additional_charges_total=data.get("additional_charges_total", 0),
            round_off=data.get("round_off", 0),
            total_amount=data["total_amount"],
            status=data.get("status", "open"),
        )
        set_created_fields(quotation, user_id=data.get("user_id"))
        db.session.add(quotation)
        db.session.commit()

        for item_data in data.get("items", []):
            item = QuotationItem(
                quotation_id=quotation.uuid,
                product_name=item_data["product_name"],
                description=item_data.get("description"),
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                tax_rate=item_data.get("tax_rate", 0),
                discount=item_data.get("discount", 0),
                total_price=item_data["total_price"],
            )
            set_created_fields(item, user_id=data.get("user_id"))
            db.session.add(item)

        db.session.commit()

        return jsonify({"message": "Quotation created successfully", "quotation_uuid": str(quotation.uuid)}), 201
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
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
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      uuid:
                        type: string
                        format: uuid
                      quotation_date:
                        type: string
                        format: date
                      customer_id:
                        type: string
                        format: uuid
                      total_amount:
                        type: number
                        format: float
                      status:
                        type: string
    """
    quotations = Quotation.query.all()
    return jsonify({
        "data": [
            {
                "uuid": str(q.uuid),
                "quotation_date": q.quotation_date.isoformat(),
                "customer_id": str(q.customer_id),
                "total_amount": float(q.total_amount),
                "status": q.status,
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
        description: UUID of the quotation to retrieve
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Detailed quotation information
        content:
          application/json:
            schema:
              type: object
              # Add schema if needed, but keeping it simple for now to match verified routes
      404:
        description: Quotation not found
    """

    quotation = Quotation.query.get_or_404(quotation_id)
    items = QuotationItem.query.filter_by(quotation_id=quotation.uuid).all()

    quotation_data = {
        "uuid": str(quotation.uuid),
        "business_id": quotation.business_id,
        "customer_id": str(quotation.customer_id),
        "billing_address_id": str(quotation.billing_address_id),
        "shipping_address_id": str(quotation.shipping_address_id),
        "quotation_date": quotation.quotation_date.isoformat(),
        "valid_till": quotation.valid_till.isoformat() if quotation.valid_till else None,
        "subtotal": float(quotation.subtotal),
        "tax_total": float(quotation.tax_total),
        "discount_total": float(quotation.discount_total),
        "additional_charges_total": float(quotation.additional_charges_total),
        "round_off": float(quotation.round_off),
        "total_amount": float(quotation.total_amount),
        "status": quotation.status,
        "items": [
            {
                "uuid": str(item.uuid),
                "product_name": item.product_name,
                "description": item.description,
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "tax_rate": float(item.tax_rate),
                "discount": float(item.discount),
                "total_price": float(item.total_price),
            }
            for item in items
        ],
    }

    return jsonify(quotation_data), 200



@quotation_blueprint.route("/<uuid:quotation_id>", methods=["PUT"])
def update_quotation(quotation_id):
    """
    Update a quotation
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
              status:
                type: string
              valid_till:
                type: string
                format: date
              discount_total:
                type: number
                format: float
              total_amount:
                type: number
                format: float
    responses:
      200:
        description: Quotation updated successfully
      404:
        description: Quotation not found
    """

    data = request.get_json()
    quotation = Quotation.query.get_or_404(quotation_id)

    try:
        quotation.billing_address_id = data.get("billing_address_id", quotation.billing_address_id)
        quotation.shipping_address_id = data.get("shipping_address_id", quotation.shipping_address_id)
        quotation.quotation_date = data.get("quotation_date", quotation.quotation_date)
        quotation.valid_till = data.get("valid_till", quotation.valid_till)
        quotation.subtotal = data.get("subtotal", quotation.subtotal)
        quotation.tax_total = data.get("tax_total", quotation.tax_total)
        quotation.discount_total = data.get("discount_total", quotation.discount_total)
        quotation.additional_charges_total = data.get("additional_charges_total", quotation.additional_charges_total)
        quotation.round_off = data.get("round_off", quotation.round_off)
        quotation.total_amount = data.get("total_amount", quotation.total_amount)
        quotation.status = data.get("status", quotation.status)

        set_updated_fields(quotation, user_id=data.get("user_id"))
        db.session.commit()

        return jsonify({"message": "Quotation updated successfully"}), 200
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
    

