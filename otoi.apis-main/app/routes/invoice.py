from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models import Invoice, InvoiceItem, Quotation, Item
from app.utils.stamping import set_created_fields, set_updated_fields
from datetime import datetime, timedelta

invoice_blueprint = Blueprint("invoice", __name__)


def generate_invoice_number():
    """Generate a unique invoice number like INV-1001"""
    last_invoice = Invoice.query.order_by(Invoice.created_at.desc()).first()
    if last_invoice and last_invoice.invoice_number:
        try:
            last_num = int(last_invoice.invoice_number.split('-')[1])
            return f"INV-{last_num + 1}"
        except (IndexError, ValueError):
            pass
    return "INV-1001"

def _build_invoice_item(item_data):
    discount = {
        "discount_percentage": item_data.get("discount_percentage", item_data.get("discount", 0)),
        "discount_amount": item_data.get("discount_amount", 0),
    }

    tax = {
        "tax_percentage": item_data.get("tax_percentage", item_data.get("tax", 0)),
        "tax_amount": item_data.get("tax_amount", 0),
    }

    return InvoiceItem(
        item_id=item_data.get("item_id"),
        description=item_data.get("description"),
        quantity=item_data["quantity"],
        unit_price=item_data.get("unit_price") or item_data.get("price_per_item"),
        discount=discount,
        tax=tax,
        total_price=item_data.get("total_price") or item_data.get("amount"),
    )


def _calculate_total_amount(charges):
    subtotal = float(charges.get("subtotal", 0) or 0)
    tax_total = float(charges.get("tax_total", 0) or 0)
    discount_total = float(charges.get("discount_total", 0) or 0)
    additional_charges_total = float(charges.get("additional_charges_total", 0) or 0)
    round_off = float(charges.get("round_off", 0) or 0)
    return subtotal + tax_total - discount_total + additional_charges_total + round_off


@invoice_blueprint.route("/", methods=["POST"])
def create_invoice():
    """
    Create a new invoice
    ---
    tags:
      - Invoices
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - business_id
              - customer_id
              - invoice_date
              - due_date
              - total_amount
            properties:
              quotation_id:
                type: string
                format: uuid
              business_id:
                type: integer
              customer_id:
                type: string
                format: uuid
              invoice_date:
                type: string
                format: date
              due_date:
                type: string
                format: date
              total_amount:
                type: number
              amount_paid:
                type: number
              status:
                type: string
              subtotal:
                type: number
              total_tax:
                type: number
              total_discount:
                type: number
              additional_charges_total:
                type: number
              round_off:
                type: number
              notes:
                type: string
              terms_and_conditions:
                type: string
              payment_terms:
                type: string
              items:
                type: array
                items:
                  type: object
                  properties:
                    item_id:
                      type: string
                      format: uuid
                    description:
                      type: string
                    quantity:
                      type: number
                    unit_price:
                      type: number
                    price_per_item:
                      type: number
                    discount_percentage:
                      type: number
                    discount_amount:
                      type: number
                    tax_percentage:
                      type: number
                    tax_amount:
                      type: number
                    total_price:
                      type: number
                    amount:
                      type: number
    responses:
      201:
        description: Invoice created successfully
      400:
        description: Validation error
      500:
        description: Server error
    """
    data = request.get_json()
    
    try:
        # Generate invoice number
        invoice_number = data.get("invoice_number") or generate_invoice_number()
        
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
            "payment_terms": data.get("payment_terms", ""),
        }
        
        # Calculate balance due
        total_amount = float(data.get("total_amount", 0))
        amount_paid = float(data.get("amount_paid", 0))
        balance_due = total_amount - amount_paid
        
        invoice = Invoice(
            invoice_number=invoice_number,
            quotation_id=data.get("quotation_id"),
            business_id=data["business_id"],
            customer_id=data["customer_id"],
            invoice_date=data["invoice_date"],
            due_date=data.get("due_date") or (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            total_amount=total_amount,
            amount_paid=amount_paid,
            balance_due=balance_due,
            charges=charges,
            status=data.get("status", "draft"),
            payment_status="paid" if balance_due <= 0 else ("partial" if amount_paid > 0 else "unpaid"),
            additional_notes=additional_notes,
        )
        db.session.add(invoice)
        db.session.flush()

        # Process items
        for item_data in data.get("items", []):
            item = _build_invoice_item(item_data)
            item.invoice_id = invoice.uuid
            db.session.add(item)

        # If created from quotation, update quotation status
        if data.get("quotation_id"):
            quotation = Quotation.query.get(data["quotation_id"])
            if quotation:
                quotation.status = "invoiced"

        db.session.commit()

        return jsonify({
            "message": "Invoice created successfully",
            "invoice_uuid": str(invoice.uuid),
            "invoice_number": invoice.invoice_number
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


@invoice_blueprint.route("/", methods=["GET"])
def get_invoices():
    """
    Get all invoices
    ---
    tags:
      - Invoices
    responses:
      200:
        description: A list of invoices
    """
    invoices = Invoice.query.order_by(Invoice.created_at.desc()).all()
    
    return jsonify({
        "data": [
            {
                "uuid": str(inv.uuid),
                "invoice_number": inv.invoice_number,
                "quotation_id": str(inv.quotation_id) if inv.quotation_id else None,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
                "customer_id": str(inv.customer_id),
                "customer_name": f"{inv.customer.first_name} {inv.customer.last_name}" if inv.customer else None,
                "total_amount": float(inv.total_amount) if inv.total_amount else 0,
                "amount_paid": float(inv.amount_paid) if inv.amount_paid else 0,
                "balance_due": float(inv.balance_due) if inv.balance_due else 0,
                "status": inv.status,
                "payment_status": inv.payment_status,
                "charges": inv.charges,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in invoices
        ]
    }), 200


@invoice_blueprint.route("/<uuid:invoice_id>", methods=["GET"])
def get_invoice(invoice_id):
    """
    Get a single invoice by UUID
    ---
    tags:
      - Invoices
    parameters:
      - name: invoice_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Detailed invoice information
      404:
        description: Invoice not found
    """
    invoice = Invoice.query.get_or_404(invoice_id)
    
    # Get item details
    items_data = []
    for item in invoice.items:
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

    invoice_data = {
        "uuid": str(invoice.uuid),
        "invoice_number": invoice.invoice_number,
        "quotation_id": str(invoice.quotation_id) if invoice.quotation_id else None,
        "business_id": invoice.business_id,
        "customer_id": str(invoice.customer_id),
        "customer": {
            "uuid": str(invoice.customer.uuid),
            "first_name": invoice.customer.first_name,
            "last_name": invoice.customer.last_name,
            "mobile": invoice.customer.mobile,
            "email": invoice.customer.email,
        } if invoice.customer else None,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        "total_amount": float(invoice.total_amount) if invoice.total_amount else 0,
        "amount_paid": float(invoice.amount_paid) if invoice.amount_paid else 0,
        "balance_due": float(invoice.balance_due) if invoice.balance_due else 0,
        "charges": invoice.charges or {},
        "status": invoice.status,
        "payment_status": invoice.payment_status,
        "additional_notes": invoice.additional_notes or {},
        "items": items_data,
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
    }

    return jsonify(invoice_data), 200


@invoice_blueprint.route("/<uuid:invoice_id>", methods=["PUT"])
def update_invoice(invoice_id):
    """
    Update an invoice
    ---
    tags:
      - Invoices
    parameters:
      - name: invoice_id
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
              invoice_date:
                type: string
                format: date
              due_date:
                type: string
                format: date
              total_amount:
                type: number
              amount_paid:
                type: number
              status:
                type: string
              subtotal:
                type: number
              total_tax:
                type: number
              total_discount:
                type: number
              additional_charges_total:
                type: number
              round_off:
                type: number
              notes:
                type: string
              terms_and_conditions:
                type: string
              payment_terms:
                type: string
              items:
                type: array
                items:
                  type: object
                  properties:
                    item_id:
                      type: string
                      format: uuid
                    description:
                      type: string
                    quantity:
                      type: number
                    unit_price:
                      type: number
                    price_per_item:
                      type: number
                    discount_percentage:
                      type: number
                    discount_amount:
                      type: number
                    tax_percentage:
                      type: number
                    tax_amount:
                      type: number
                    total_price:
                      type: number
                    amount:
                      type: number
    responses:
      200:
        description: Invoice updated successfully
      404:
        description: Invoice not found
    """
    data = request.get_json()
    invoice = Invoice.query.get_or_404(invoice_id)

    try:
        items_changed = False

        if "items" in data:
            if not isinstance(data["items"], list):
                return jsonify({"error": "Items must be an array"}), 400
            items_changed = True
            for existing_item in list(invoice.items):
                db.session.delete(existing_item)
            for item_data in data["items"]:
                item = _build_invoice_item(item_data)
                item.invoice_id = invoice.uuid
                db.session.add(item)

        # Update basic fields
        if "invoice_date" in data:
            invoice.invoice_date = data["invoice_date"]
        if "due_date" in data:
            invoice.due_date = data["due_date"]
        if "status" in data:
            invoice.status = data["status"]
        
        # Handle payment update
        amount_paid_updated = False
        if "amount_paid" in data:
            invoice.amount_paid = float(data["amount_paid"])
            amount_paid_updated = True
        
        # Update charges JSON
        charges = invoice.charges or {}
        charges_updated = False
        if items_changed:
            subtotal = sum(
                float((item_data.get("total_price") or item_data.get("amount") or 0) or 0)
                for item_data in data.get("items", [])
            )
            charges["subtotal"] = subtotal
            charges_updated = True
        if any(key in data for key in ["subtotal", "total_tax", "total_discount", "additional_charges_total", "round_off"]):
            if "subtotal" in data:
                charges["subtotal"] = data["subtotal"]
            if "total_tax" in data:
                charges["tax_total"] = data["total_tax"]
            if "total_discount" in data:
                charges["discount_total"] = data["total_discount"]
            if "additional_charges_total" in data:
                charges["additional_charges_total"] = data["additional_charges_total"]
            if "round_off" in data:
                charges["round_off"] = data["round_off"]
            charges_updated = True
        if charges_updated:
            invoice.charges = charges
        
        # Update additional_notes JSON
        if any(key in data for key in ["notes", "terms_and_conditions", "payment_terms"]):
            additional_notes = invoice.additional_notes or {}
            if "notes" in data:
                additional_notes["notes"] = data["notes"]
            if "terms_and_conditions" in data:
                additional_notes["terms_and_conditions"] = data["terms_and_conditions"]
            if "payment_terms" in data:
                additional_notes["payment_terms"] = data["payment_terms"]
            invoice.additional_notes = additional_notes

        # Recalculate total/balance if needed
        total_amount_updated = False
        if "total_amount" in data:
            invoice.total_amount = data["total_amount"]
            total_amount_updated = True
        elif items_changed or charges_updated:
            invoice.total_amount = _calculate_total_amount(invoice.charges or {})
            total_amount_updated = True

        if total_amount_updated or amount_paid_updated:
            total_amount_value = float(invoice.total_amount or 0)
            amount_paid_value = float(invoice.amount_paid or 0)
            invoice.balance_due = total_amount_value - amount_paid_value
            if invoice.balance_due <= 0:
                invoice.payment_status = "paid"
            elif amount_paid_value > 0:
                invoice.payment_status = "partial"
            else:
                invoice.payment_status = "unpaid"

        db.session.commit()

        return jsonify({"message": "Invoice updated successfully"}), 200
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
    except KeyError as e:
        db.session.rollback()
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


@invoice_blueprint.route("/<uuid:invoice_id>", methods=["DELETE"])
def delete_invoice(invoice_id):
    """
    Delete an invoice
    ---
    tags:
      - Invoices
    parameters:
      - name: invoice_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Invoice deleted successfully
      404:
        description: Invoice not found
    """
    invoice = Invoice.query.get_or_404(invoice_id)
    try:
        db.session.delete(invoice)
        db.session.commit()
        return jsonify({"message": "Invoice deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


@invoice_blueprint.route("/from-quotation/<uuid:quotation_id>", methods=["POST"])
def create_invoice_from_quotation(quotation_id):
    """
    Create an invoice from an existing quotation
    ---
    tags:
      - Invoices
    parameters:
      - name: quotation_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      201:
        description: Invoice created from quotation
      404:
        description: Quotation not found
    """
    quotation = Quotation.query.get_or_404(quotation_id)
    
    try:
        invoice_number = generate_invoice_number()
        
        invoice = Invoice(
            invoice_number=invoice_number,
            quotation_id=quotation.uuid,
            business_id=quotation.business_id,
            customer_id=quotation.customer_id,
            invoice_date=datetime.now().strftime("%Y-%m-%d"),
            due_date=(datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            total_amount=quotation.total_amount,
            amount_paid=0,
            balance_due=quotation.total_amount,
            charges=quotation.charges,
            status="sent",
            payment_status="unpaid",
            additional_notes=quotation.additional_notes,
        )
        db.session.add(invoice)
        db.session.flush()

        # Copy items from quotation
        for q_item in quotation.items:
            item = InvoiceItem(
                invoice_id=invoice.uuid,
                item_id=q_item.item_id,
                description=q_item.description,
                quantity=q_item.quantity,
                unit_price=q_item.unit_price,
                discount=q_item.discount,
                tax=q_item.tax,
                total_price=q_item.total_price,
            )
            db.session.add(item)

        # Update quotation status
        quotation.status = "invoiced"

        db.session.commit()

        return jsonify({
            "message": "Invoice created from quotation successfully",
            "invoice_uuid": str(invoice.uuid),
            "invoice_number": invoice.invoice_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


@invoice_blueprint.route("/<uuid:invoice_id>/record-payment", methods=["POST"])
def record_payment(invoice_id):
    """
    Record a payment for an invoice
    ---
    tags:
      - Invoices
    parameters:
      - name: invoice_id
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
            required:
              - amount
            properties:
              amount:
                type: number
              payment_method:
                type: string
              reference:
                type: string
    responses:
      200:
        description: Payment recorded successfully
      404:
        description: Invoice not found
    """
    data = request.get_json()
    invoice = Invoice.query.get_or_404(invoice_id)
    
    try:
        payment_amount = float(data.get("amount", 0))
        
        if payment_amount <= 0:
            return jsonify({"error": "Payment amount must be greater than 0"}), 400
        
        invoice.amount_paid = float(invoice.amount_paid or 0) + payment_amount
        invoice.balance_due = float(invoice.total_amount) - invoice.amount_paid
        
        # Update payment status
        if invoice.balance_due <= 0:
            invoice.payment_status = "paid"
            invoice.status = "paid"
        else:
            invoice.payment_status = "partial"
        
        db.session.commit()
        
        return jsonify({
            "message": "Payment recorded successfully",
            "amount_paid": float(invoice.amount_paid),
            "balance_due": float(invoice.balance_due),
            "payment_status": invoice.payment_status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500
