from flask import Blueprint, request, jsonify, send_file
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func, desc, asc, and_
from sqlalchemy.orm import selectinload
import base64
import os
import os
from app.extensions import db
from app.models.invoice import Invoice, InvoiceItem
from app.models.customer import Customer
from app.models.creditIn import CreditNote
from app.models.inventory import Item
from app.services.pdf_service import generate_invoice_pdf
from app.utils.stamping import set_updated_fields
from app.routes.creditIn import update_invoice_payment_status
from app.utils.decorators import login_required
import uuid
from datetime import datetime, timedelta
from app.config import Config


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
              payment_discount:
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
        payment_discount = float(data.get("payment_discount", 0))
        balance_due = total_amount - amount_paid - payment_discount
        
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
            payment_discount=payment_discount,
            charges=charges,
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
    Get all invoices with pagination, search, and sorting.
    ---
    tags:
      - Invoices
    parameters:
      - name: search
        in: query
        type: string
        required: false
        description: Search term for invoice number or customer name
      - name: party_name
        in: query
        type: string
        required: false
        description: Filter by customer/party name
      - name: invoice_number
        in: query
        type: string
        required: false
        description: Filter by invoice number
      - name: payment_status
        in: query
        type: string
        required: false
        description: Filter by payment status
      - name: page
        in: query
        required: false
        schema:
          type: integer
        description: Page number (default: 1)
      - name: items_per_page
        in: query
        required: false
        schema:
          type: integer
        description: Items per page (default: 5)
      - name: sort
        in: query
        required: false
        schema:
          type: string
        description: Sort field (default: created_at)
      - name: order
        in: query
        required: false
        schema:
          type: string
        description: Sort order: asc or desc (default: desc)
      - name: dropdown
        in: query
        required: false
        schema:
          type: boolean
        description: Return simplified format for dropdowns
      - name: customer_dropdown_all
        in: query
        required: false
        schema:
          type: boolean
        description: Return all unique customers (party names) for dropdown
      - name: exclude_linked_to_credit_notes
        in: query
        required: false
        schema:
          type: boolean
        description: Exclude invoices that are linked to credit notes
    responses:
      200:
        description: A paginated list of invoices.
    """
    try:
        query = Invoice.query.filter(Invoice.is_deleted == False)
        
        # Get search parameters
        search = request.args.get('search', '').strip()
        party_name = request.args.get('party_name', '').strip()
        invoice_number = request.args.get('invoice_number', '').strip()
        payment_status = request.args.get('payment_status', '').strip()
        exclude_linked_to_credit_notes = request.args.get('exclude_linked_to_credit_notes', '').lower() == 'true'
        
        # Apply search filters with priority to search parameter
        if search:
            # If search parameter is provided, use it for both party name and invoice number
            # Also handle multiple spaces by normalizing them
            normalized_search = ' '.join(search.split())
            query = query.outerjoin(Customer, Invoice.customer_id == Customer.uuid).filter(
                or_(
                    Invoice.invoice_number.ilike(f'%{search}%'),
                    Customer.first_name.ilike(f'%{search}%'),
                    Customer.last_name.ilike(f'%{search}%'),
                    func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{search}%'),
                    func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{normalized_search}%')
                )
            )
        else:
            # If no search parameter, check individual filters
            if party_name:
                # Handle multiple spaces by normalizing them
                normalized_party_name = ' '.join(party_name.split())
                query = query.outerjoin(Customer, Invoice.customer_id == Customer.uuid).filter(
                    or_(
                        Customer.first_name.ilike(f'%{party_name}%'),
                        Customer.last_name.ilike(f'%{party_name}%'),
                        func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{party_name}%'),
                        func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{normalized_party_name}%')
                    )
                )
            
            if invoice_number:
                query = query.filter(Invoice.invoice_number.ilike(f'%{invoice_number}%'))
            
            # If no filters are applied, ensure we still have the customer join for consistent behavior
            if not party_name and not invoice_number:
                query = query.outerjoin(Customer, Invoice.customer_id == Customer.uuid)

        # Apply payment_status filter if provided
        if payment_status and payment_status != '':
            query = query.filter(Invoice.payment_status == payment_status)
        
        # Apply exclude_linked_to_credit_notes filter if provided
        if exclude_linked_to_credit_notes:
            # Find all invoices that are NOT linked to any credit notes
            linked_invoice_subquery = db.select(
                CreditNote.invoice_id
            ).where(
                CreditNote.invoice_id.isnot(None),
                CreditNote.is_deleted == False
            ).subquery()
            
            query = query.filter(~Invoice.uuid.in_(linked_invoice_subquery))
        
        # Handle sorting
        sort = request.args.get("sort", "created_at")  # Default sort by created_at
        order = request.args.get("order", "desc").upper()  # Default order is 'desc'

        if sort == "invoice_number":
            if order == "desc":
                query = query.order_by(db.desc(Invoice.invoice_number))
            else:
                query = query.order_by(Invoice.invoice_number)
        elif sort == "invoice_date":
            if order == "desc":
                query = query.order_by(db.desc(Invoice.invoice_date))
            else:
                query = query.order_by(Invoice.invoice_date)
        elif sort == "due_date":
            if order == "desc":
                query = query.order_by(db.desc(Invoice.due_date))
            else:
                query = query.order_by(Invoice.due_date)
        elif sort == "total_amount":
            if order == "desc":
                query = query.order_by(db.desc(Invoice.total_amount))
            else:
                query = query.order_by(Invoice.total_amount)
        elif sort == "payment_status":
            if order == "desc":
                query = query.order_by(db.desc(Invoice.payment_status))
            else:
                query = query.order_by(Invoice.payment_status)
        else:
            # Handle other fields (including created_at)
            if sort.startswith("-"):
                query = query.order_by(db.desc(getattr(Invoice, sort[1:], "id")))
            else:
                query = query.order_by(getattr(Invoice, sort, "id"))

        # Return all invoices for dropdown if requested
        if request.args.get("dropdown") == "true":
            invoices = query.outerjoin(Customer, Invoice.customer_id == Customer.uuid).all()
            return jsonify([
                {
                    "uuid": str(inv.uuid),
                    "invoice_number": inv.invoice_number,
                    "customer_name": f"{inv.customer.first_name} {inv.customer.last_name}" if inv.customer else None
                }
                for inv in invoices
            ]), 200
        
        # Return customer names dropdown if requested
        if request.args.get("customer_dropdown") == "true":
            # Start fresh query for customer dropdown
            customer_query = Invoice.query.outerjoin(Customer, Invoice.customer_id == Customer.uuid)
            customers = customer_query.with_entities(
                Customer.uuid,
                Customer.first_name,
                Customer.last_name,
                func.concat(Customer.first_name, ' ', Customer.last_name).label('full_name')
            ).distinct().all()
            
            result = []
            for customer in customers:
                result.append({
                    "uuid": str(customer.uuid),
                    "name": customer.full_name.strip()
                })
            
            # Sort by name
            result.sort(key=lambda x: x['name'])
            return jsonify(result), 200

        # Return all customers (party names) for dropdown if requested
        if request.args.get("customer_dropdown_all") == "true":
            # Get all unique customers from ALL invoices (not just current page)
            customer_query = Invoice.query.outerjoin(Customer, Invoice.customer_id == Customer.uuid).with_entities(
                Customer.uuid,
                Customer.first_name,
                Customer.last_name
            ).distinct().all()
            
            result = []
            for customer in customer_query:
                if customer.uuid and (customer.first_name or customer.last_name):  # Only include customers with valid UUID and name
                    full_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                    if full_name:  # Only include if name is not empty after stripping
                        result.append({
                            "uuid": str(customer.uuid),
                            "name": full_name
                        })
            
            # Sort by name alphabetically
            result.sort(key=lambda x: x['name'].lower())
            return jsonify(result), 200

        # Return only customers with active (non-deleted) invoices for dropdown
        if request.args.get("customer_dropdown_active") == "true":
            customer_query = Invoice.query.filter(Invoice.is_deleted == False).outerjoin(Customer, Invoice.customer_id == Customer.uuid)
            customers = customer_query.with_entities(
                Customer.uuid,
                Customer.first_name,
                Customer.last_name,
                func.concat(Customer.first_name, ' ', Customer.last_name).label('full_name')
            ).distinct().all()
            
            result = []
            for customer in customers:
                if customer.uuid and (customer.first_name or customer.last_name):
                    full_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                    if full_name:
                        result.append({
                            "uuid": str(customer.uuid),
                            "name": full_name
                        })
            
            result.sort(key=lambda x: x['name'].lower())
            return jsonify(result), 200

        # Return only invoice numbers with customer IDs for optimized dropdown
        if request.args.get("invoice_numbers_only") == "true":
            invoice_query = Invoice.query.filter(Invoice.is_deleted == False)
            invoices = invoice_query.with_entities(
                Invoice.uuid,
                Invoice.invoice_number,
                Invoice.customer_id
            ).all()
            
            result = []
            for invoice in invoices:
                if invoice.uuid and invoice.invoice_number:
                    result.append({
                        "uuid": str(invoice.uuid),
                        "invoice_number": invoice.invoice_number,
                        "customer_id": str(invoice.customer_id) if invoice.customer_id else None
                    })
            
            result.sort(key=lambda x: x['invoice_number'])
            return jsonify(result), 200

        # Paginated results for main grid (same pattern as quotation.py)
        page = int(request.args.get("page", 1))
        # Accept both 'per_page' and 'items_per_page' for frontend compatibility
        per_page = int(request.args.get("per_page") or request.args.get("items_per_page") or 5)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        invoices = pagination.items

        # Get customer data separately to avoid relationship issues
        customer_ids = [inv.customer_id for inv in invoices]
        customers = {c.uuid: c for c in Customer.query.filter(Customer.uuid.in_(customer_ids)).all()} if customer_ids else {}

        # Get credit notes data for all invoices to calculate effective balance
        invoice_ids = [str(inv.uuid) for inv in invoices]  # Convert to strings
        credit_notes_by_invoice = {}
        if invoice_ids:
            credit_notes = CreditNote.query.filter(
                CreditNote.invoice_id.in_(invoice_ids),
                CreditNote.is_deleted == False
            ).all()
            for cn in credit_notes:
                # Use string as key to match our lookup
                invoice_key = str(cn.invoice_id)
                if invoice_key not in credit_notes_by_invoice:
                    credit_notes_by_invoice[invoice_key] = 0
                credit_notes_by_invoice[invoice_key] += float(cn.total_amount)
        
        # Debug: Print final credit_notes_by_invoice

        # Shape response to match frontend expectations: { data: [...], pagination: { total, ... } }
        result = []
        for inv in invoices:
            # Calculate effective balance due considering credit notes
            credit_notes_total = credit_notes_by_invoice.get(str(inv.uuid), 0)
            effective_balance_due = max(0, float(inv.total_amount) - float(inv.amount_paid) - float(inv.payment_discount or 0) - credit_notes_total)
            
            # Debug: Print calculation for this invoice
            
            # Calculate effective payment status based on effective balance
            if effective_balance_due <= 0:
                effective_payment_status = "paid"
            elif float(inv.amount_paid) > 0 or credit_notes_total > 0:
                effective_payment_status = "partial"
            else:
                effective_payment_status = "unpaid"
                        
            result.append({
                "uuid": str(inv.uuid),
                "invoice_number": inv.invoice_number,
                "quotation_id": str(inv.quotation_id) if inv.quotation_id else None,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
                "customer_id": str(inv.customer_id),
                "customer_name": f"{customers[inv.customer_id].first_name} {customers[inv.customer_id].last_name}" if inv.customer_id in customers else None,
                "total_amount": float(inv.total_amount) if inv.total_amount else 0,
                "amount_paid": float(inv.amount_paid) if inv.amount_paid else 0,
                "balance_due": effective_balance_due,  
                "payment_discount": float(inv.payment_discount) if inv.payment_discount else 0,
                "credit_notes_total": credit_notes_total,  
                "payment_status": effective_payment_status,  
                "charges": inv.charges,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            })

        response_data = {
            "data": result,
            "pagination": {
                "total": pagination.total,
                "items_per_page": per_page,
                "current_page": page,
                "last_page": pagination.pages,
                "from": (
                    (pagination.page - 1) * per_page + 1 if pagination.total > 0 else 0
                ),
                "to": min(pagination.page * per_page, pagination.total),
                "prev_page_url": None,
                "next_page_url": None,
                "first_page_url": None,
            },
        }
        
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch invoices",
            "details": str(e)
        }), 500


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
    
    # Get credit notes linked to this invoice
    credit_notes_data = []
    credit_notes = CreditNote.query.filter_by(invoice_id=invoice_id, is_deleted=False).all()
    for credit_note in credit_notes:
        credit_notes_data.append({
            "uuid": str(credit_note.uuid),
            "credit_note_number": credit_note.credit_note_number,
            "total_amount": float(credit_note.total_amount) if credit_note.total_amount else 0,
            "status": credit_note.status,
            "credit_note_date": credit_note.credit_note_date.isoformat() if credit_note.credit_note_date else None,
        })
    
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
            inventory_item = Item.query.options(
                selectinload(Item.images)
            ).get(item.item_id)
            if inventory_item:
                item_info["product_name"] = inventory_item.item_name
                item_info["hsn_sac_code"] = inventory_item.hsn_code
                item_info["measuring_unit_id"] = inventory_item.measuring_unit_id
                # Get the feature image for the item
                main_image_obj = next((img for img in (inventory_item.images or []) if img.is_main), None)
                if not main_image_obj and inventory_item.images:
                    main_image_obj = inventory_item.images[0]
                if main_image_obj:
                    # Return the path for the frontend (handled by resolveImageUrl)
                    item_info["image"] = f"/static/itemImages/{main_image_obj.item_id}/{main_image_obj.image}"
        
        items_data.append(item_info)

    # Calculate credit notes total (include all non-deleted credit notes, same as helper function)
    credit_notes_total = sum(float(cn.total_amount) for cn in credit_notes)
    
    # Calculate effective balance due considering credit notes
    effective_balance_due = max(0, float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount or 0) - credit_notes_total)
    
    # Calculate effective payment status based on effective balance
    if effective_balance_due <= 0:
        effective_payment_status = "paid"
    elif float(invoice.amount_paid) > 0 or credit_notes_total > 0:
        effective_payment_status = "partial"
    else:
        effective_payment_status = "unpaid"

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
        "balance_due": effective_balance_due, 
        "payment_discount": float(invoice.payment_discount) if invoice.payment_discount else 0,
        "charges": invoice.charges or {},
        "payment_status": effective_payment_status, 
        "additional_notes": invoice.additional_notes or {},
        "items": items_data,
        "credit_notes": credit_notes_data,
        "credit_notes_total": credit_notes_total, 
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
              payment_discount:
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
        if "payment_status" in data:
            invoice.payment_status = data["payment_status"]
        
        # Handle payment update
        amount_paid_updated = False
        payment_discount_updated = False
        if "amount_paid" in data:
            invoice.amount_paid = float(data["amount_paid"])
            amount_paid_updated = True
        
        # Handle payment discount update
        if "payment_discount" in data:
            # Accumulate discount instead of overwriting
            current_discount = float(invoice.payment_discount or 0)
            new_discount = float(data["payment_discount"])
            invoice.payment_discount = current_discount + new_discount
            payment_discount_updated = True
        
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
        # Accept flat keys (notes, terms_and_conditions, payment_terms) OR nested additional_notes object
        nested = data.get("additional_notes", {}) or {}
        if any(key in data for key in ["notes", "terms_and_conditions", "payment_terms"]) or nested:
            additional_notes = invoice.additional_notes or {}
            notes_val = data.get("notes", nested.get("notes"))
            terms_val = data.get("terms_and_conditions", nested.get("terms_and_conditions"))
            payment_terms_val = data.get("payment_terms", nested.get("payment_terms"))
            if notes_val is not None:
                additional_notes["notes"] = notes_val
            if terms_val is not None:
                additional_notes["terms_and_conditions"] = terms_val
            if payment_terms_val is not None:
                additional_notes["payment_terms"] = payment_terms_val
            invoice.additional_notes = additional_notes

        # Recalculate total/balance if needed
        total_amount_updated = False
        if "total_amount" in data:
            invoice.total_amount = data["total_amount"]
            total_amount_updated = True
        elif items_changed or charges_updated:
            invoice.total_amount = _calculate_total_amount(invoice.charges or {})
            total_amount_updated = True

        if total_amount_updated or amount_paid_updated or payment_discount_updated:
            total_amount_value = float(invoice.total_amount or 0)
            amount_paid_value = float(invoice.amount_paid or 0)
            payment_discount_value = float(invoice.payment_discount or 0)
            invoice.balance_due = total_amount_value - amount_paid_value - payment_discount_value
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
              payment_discount:
                type: number
                description: Payment discount amount (alternative parameter name: discount)
              discount:
                type: number
                description: Payment discount amount (alternative parameter name: payment_discount)
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
        # Accept both 'discount' and 'payment_discount' for frontend compatibility
        payment_discount = float(data.get("payment_discount") or data.get("discount", 0))
        
        if payment_amount <= 0:
            return jsonify({"error": "Payment amount must be greater than 0"}), 400
        
        # Calculate maximum allowed payment to prevent overpayment
        current_total_paid = float(invoice.amount_paid or 0)
        current_discount = float(invoice.payment_discount or 0)
        
        # Get credit notes for this invoice
        credit_notes = CreditNote.query.filter_by(invoice_id=str(invoice.uuid), is_deleted=False).all()
        total_credit_amount = sum(float(cn.total_amount) for cn in credit_notes)
        
        # Calculate maximum allowed payment considering credit notes
        max_allowed_payment = float(invoice.total_amount) - current_total_paid - current_discount - total_credit_amount
        
        # Add small epsilon tolerance for floating-point precision
        epsilon = 0.01  # 1 paisa tolerance
        
        # Check for overpayment with tolerance
        if payment_amount > max_allowed_payment + epsilon:
            return jsonify({
                "error": "Overpayment not allowed",
                "details": f"Maximum allowed payment is ₹{max_allowed_payment:.2f}, but you attempted to pay ₹{payment_amount:.2f}",
                "max_allowed": max_allowed_payment,
                "attempted_amount": payment_amount,
                "current_amount_paid": current_total_paid,
                "current_discount": current_discount,
                "total_amount": float(invoice.total_amount)
            }), 400
        
        # Update payment discount if provided (overwrite, not cumulative)
        # If a discount is explicitly provided in input (even if 0), it replaces the existing discount
        if "payment_discount" in data or "discount" in data:
            invoice.payment_discount = payment_discount
        
        invoice.amount_paid = float(invoice.amount_paid or 0) + payment_amount
        # Calculate balance due considering both amount paid and total payment discount
        calculated_balance = float(invoice.total_amount)- invoice.amount_paid - (float(invoice.payment_discount) or 0)
        # Cap balance at 0 to prevent negative values
        invoice.balance_due = max(0, calculated_balance)
        
        # Use the helper function to update payment status (considers credit notes)
        update_invoice_payment_status(str(invoice.uuid))
        
        # Force refresh the invoice object to ensure latest values
        db.session.flush()  # Ensure changes are written to session
        
        db.session.commit()
        
        # Refresh the invoice to get the latest committed values
        db.session.refresh(invoice)
        
        # Calculate effective balance due considering credit notes for response
        credit_notes = CreditNote.query.filter_by(invoice_id=str(invoice.uuid), is_deleted=False).all()
        credit_notes_total = sum(float(cn.total_amount) for cn in credit_notes)
        effective_balance_due = max(0, float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount or 0) - credit_notes_total)
        
        return jsonify({
            "message": "Payment recorded successfully",
            "amount_paid": float(invoice.amount_paid),
            "balance_due": effective_balance_due, 
            "payment_status": invoice.payment_status,
            "payment_discount": float(invoice.payment_discount) if invoice.payment_discount else 0,
            "credit_notes_total": credit_notes_total  
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


@invoice_blueprint.route("/<uuid:invoice_id>/delete", methods=["PUT"])
@login_required
def soft_delete_invoice(invoice_id):
    """
    Soft delete an invoice by setting is_deleted = true
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
      401:
        description: Unauthorized
      500:
        description: Server error
    """
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        
        # Check if invoice is already deleted
        if invoice.is_deleted:
            return jsonify({
                "success": False,
                "message": "Invoice is already deleted"
            }), 400
        
        # Perform soft delete
        invoice.is_deleted = True
        set_updated_fields(invoice)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "data": {
                "invoice_uuid": str(invoice.uuid),
                "invoice_number": invoice.invoice_number,
                "is_deleted": True
            },
            "message": "Invoice deleted successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "An error occurred while deleting the invoice",
            "details": str(e)
        }), 500


@invoice_blueprint.route("/<uuid:invoice_id>/pdf", methods=["GET"])
def download_invoice_pdf(invoice_id):
    """
    Download invoice as a PDF
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
        description: PDF file download
        content:
          application/pdf:
            schema:
              type: string
              format: binary
      404:
        description: Invoice not found
      500:
        description: PDF generation failed
    """
    try:
        invoice = Invoice.query.get_or_404(invoice_id)

        # Build items data (same logic as get_invoice, with images)
        items_data = []
        for item in invoice.items:
            item_info = {
                "description": item.description,
                "quantity": float(item.quantity) if item.quantity else 0,
                "unit_price": float(item.unit_price) if item.unit_price else 0,
                "discount": item.discount or {},
                "tax": item.tax or {},
                "total_price": float(item.total_price) if item.total_price else 0,
            }
            if item.item_id:
                inventory_item = Item.query.options(
                    selectinload(Item.images)
                ).get(item.item_id)
                if inventory_item:
                    item_info["product_name"] = inventory_item.item_name
                    item_info["hsn_sac_code"] = inventory_item.hsn_code
                    # Get the feature image for the item
                    main_image_obj = next((img for img in (inventory_item.images or []) if img.is_main), None)
                    if not main_image_obj and inventory_item.images:
                        main_image_obj = inventory_item.images[0]
                    if main_image_obj:
                        # Resolve absolute path for PDF generation
                        image_path = os.path.join(Config.ITEM_IMAGES_FOLDER, str(main_image_obj.item_id), main_image_obj.image)
                        if os.path.exists(image_path):
                            try:
                                with open(image_path, "rb") as img_file:
                                    encoded_string = base64.b64encode(img_file.read()).decode('utf-8')
                                    extension = os.path.splitext(image_path)[1].lower()
                                    mime_type = "image/png" if extension == ".png" else "image/jpeg"
                                    item_info["image"] = f"data:{mime_type};base64,{encoded_string}"
                            except Exception as e:
                                print(f"Error encoding image for PDF: {e}")
                                item_info["image"] = None
            items_data.append(item_info)

        pdf_buffer = generate_invoice_pdf(invoice, items_data)

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{invoice.invoice_number}.pdf",
        )

    except Exception as e:
        return jsonify({"error": "PDF generation failed", "details": str(e)}), 500


@invoice_blueprint.route("/<invoice_id>/status", methods=["PUT"])
@login_required
def update_invoice_status(invoice_id):
    """
    Update invoice status
    ---
    tags:
      - Invoices
    parameters:
      - name: invoice_id
        in: path
        required: true
        type: string
        description: Invoice UUID or invoice number (e.g., INV-1010)
      - name: status
        in: body
        required: true
        schema:
          type: object
          properties:
            status:
              type: string
              enum: ["unpaid", "partially_paid", "paid", "refunded", "cancelled"]
    responses:
      200:
        description: Invoice status updated successfully
      404:
        description: Invoice not found
      400:
        description: Invalid status
      401:
        description: Unauthorized
      500:
        description: Server error
    """
    try:
        # Handle both UUID and invoice number
        if invoice_id.startswith("INV-"):
            # It's an invoice number, look up by invoice_number
            invoice = Invoice.query.filter_by(invoice_number=invoice_id, is_deleted=False).first()
            if not invoice:
                return jsonify({
                    "success": False,
                    "error": f"Invoice with number {invoice_id} not found"
                }), 404
        else:
            # It's a UUID, look up by UUID
            try:
                from uuid import UUID as uuid_convert
                uuid_obj = uuid_convert(invoice_id)
                invoice = Invoice.query.filter_by(uuid=uuid_obj, is_deleted=False).first()
                if not invoice:
                    return jsonify({
                        "success": False,
                        "error": f"Invoice with UUID {invoice_id} not found"
                    }), 404
            except ValueError:
                return jsonify({
                    "success": False,
                    "error": f"Invalid invoice ID format: {invoice_id}"
                }), 400
        
        data = request.get_json()
        new_status = data.get("status")
        
        if not new_status:
            return jsonify({
                "success": False,
                "error": "Status is required"
            }), 400
        
        valid_statuses = ["unpaid", "partially_paid", "paid", "refunded", "cancelled"]
        if new_status not in valid_statuses:
            return jsonify({
                "success": False,
                "error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            }), 400
        
        # Business logic validations
        if new_status == "refunded":
            # Allow refunding invoices that are paid, partially_paid, or unpaid
            if invoice.status not in ["paid", "partially_paid", "unpaid"]:
                return jsonify({
                    "success": False,
                    "error": f"Cannot refund invoice with status: {invoice.status}"
                }), 400
        
        if new_status == "cancelled" and invoice.status == "refunded":
            return jsonify({
                "success": False,
                "error": "Cannot cancel refunded invoice"
            }), 400
        
        # Update status
        old_status = invoice.status
        invoice.status = new_status
        set_updated_fields(invoice)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Invoice status updated successfully",
            "data": {
                "invoice_uuid": str(invoice.uuid),
                "invoice_number": invoice.invoice_number,
                "old_status": old_status,
                "new_status": new_status
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "An error occurred while updating invoice status",
            "details": str(e)
        }), 500
