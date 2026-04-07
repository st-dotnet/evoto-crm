from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, func, desc, asc, and_
from app.extensions import db
from app.models import CreditNote, CreditNoteItem, CreditNotePayment, Invoice, Item, Customer
from app.utils.stamping import set_created_fields, set_updated_fields
from app.utils.decorators import login_required
import uuid
import sys
from datetime import datetime, timedelta

credit_note_blueprint = Blueprint("credit_note", __name__)


def generate_credit_note_number(max_retries=3):
    """Generate a unique credit note number like CN-1834 with 4 digits"""
    import time
    
    for attempt in range(max_retries):
        try:
            # Get the maximum number from existing credit notes
            result = db.session.execute(
                db.text("""
                    SELECT MAX(CAST(SUBSTRING(credit_note_number FROM 5) AS INTEGER)) as max_num 
                    FROM credit_notes 
                    WHERE credit_note_number LIKE 'CN-%' 
                    AND credit_note_number ~ 'CN-[0-9]{4}$'
                    AND is_deleted = FALSE
                """)
            )
            max_num = result.scalar()
            
            if max_num and max_num >= 1000:
                # Start from max_num + 1, but keep it 4 digits
                new_num = max_num + 1
                # Ensure it doesn't exceed 9999
                if new_num > 9999:
                    new_num = 1000  # Reset to 1000 if we exceed 9999
            else:
                new_num = 1000  # Start from CN-1000
            
            # Format as 4-digit number
            new_credit_note_number = f"CN-{new_num:04d}"
            
            # Quick check to see if this number exists
            existing = CreditNote.query.filter_by(
                credit_note_number=new_credit_note_number,
                is_deleted=False
            ).first()
            
            if existing:
                # If it exists, try the next number
                new_num += 1
                if new_num > 9999:
                    new_num = 1000  # Reset if we exceed 9999
                new_credit_note_number = f"CN-{new_num:04d}"
                
                # Check one more time
                existing = CreditNote.query.filter_by(
                    credit_note_number=new_credit_note_number,
                    is_deleted=False
                ).first()
                
                if existing:
                    continue
                
            return new_credit_note_number
            
        except Exception as e:
            # Log error for debugging
            current_app.logger.error(f"Error generating credit note number (attempt {attempt + 1}): {str(e)}")
            
            # Rollback any partial transaction to clean up state
            try:
                db.session.rollback()
            except:
                pass  # Ignore rollback errors
            
            if attempt == max_retries - 1:
                # Last attempt, use a simple 4-digit fallback
                timestamp = int(time.time())
                fallback_num = timestamp % 9000 + 1000  # Ensure 4-digit number between 1000-9999
                return f"CN-{fallback_num:04d}"
            
            # Brief delay before retry
            time.sleep(0.1)
            continue
    
    # Ultimate fallback - 4-digit number
    timestamp = int(time.time())
    fallback_num = timestamp % 9000 + 1000
    return f"CN-{fallback_num:04d}"


def update_invoice_payment_status(invoice_id):
    """
    Update invoice payment_status based on credit notes and payments
    This function calculates the effective payment status considering:
    - Original payments made to the invoice
    - Credit notes issued against the invoice
    """
    try:
        invoice = Invoice.query.filter_by(uuid=invoice_id).first()
        if not invoice:
            return False
        
        # Get all credit notes for this invoice
        credit_notes = CreditNote.query.filter_by(
            invoice_id=invoice_id, 
            is_deleted=False
        ).all()
        
        # Calculate total credit amount
        total_credit_amount = sum(float(cn.total_amount) for cn in credit_notes)
        
        # Calculate effective balance (original balance - credit amount)
        original_balance = float(invoice.balance_due) + float(invoice.amount_paid)
        adjusted_balance = float(invoice.total_amount) - float(invoice.amount_paid) - total_credit_amount
        
        # Update payment status based on effective balance and credit notes
        if adjusted_balance <= 0:
            if total_credit_amount >= float(invoice.total_amount):
                invoice.payment_status = "refunded"
            else:
                invoice.payment_status = "paid"
        elif float(invoice.amount_paid) > 0 or total_credit_amount > 0:
            invoice.payment_status = "partial"
        else:
            invoice.payment_status = "unpaid"
        
        # Update invoice status if there are credit notes
        if credit_notes:
            total_credit = sum(float(cn.total_amount) for cn in credit_notes)
            if total_credit >= float(invoice.total_amount):
                invoice.status = "refunded"
            else:
                invoice.status = "refunded"  # Still marked as refunded if any credit exists
        
        set_updated_fields(invoice)
        db.session.commit()
        return True
        
    except Exception as e:
        db.session.rollback()
        return False


def _build_credit_note_item(item_data):
    """Build a CreditNoteItem object from request data (backend calculates total_price)"""
    # Get and validate quantity
    quantity = item_data.get("quantity")
    if quantity is None or quantity == "":
        raise ValueError("Quantity is required")
    
    try:
        quantity_val = float(quantity)
        if quantity_val < 0:
            raise ValueError("Quantity cannot be negative")
    except (ValueError, TypeError):
        raise ValueError("Quantity must be a valid number")
    
    # Get unit price for backend calculation
    unit_price = item_data.get("unit_price") or item_data.get("price_per_item")
    if not unit_price:
        raise ValueError("Unit price is required for backend calculation")
    
    # Calculate total_price on backend
    unit_price_val = float(unit_price)
    discount_percentage = float(item_data.get("discount", 0))
    tax_percentage = float(item_data.get("tax", 0))
    
    # Calculate item totals
    item_subtotal = quantity_val * unit_price_val
    item_discount = item_subtotal * (discount_percentage / 100)
    item_taxable_amount = item_subtotal - item_discount
    item_tax = item_taxable_amount * (tax_percentage / 100)
    total_price = item_subtotal - item_discount + item_tax
    
    discount = {
        "discount_percentage": discount_percentage,
        "discount_amount": item_discount,
    }

    tax = {
        "tax_percentage": tax_percentage,
        "tax_amount": item_tax,
    }

    return CreditNoteItem(
        item_id=item_data.get("item_id"),
        description=item_data.get("description"),
        quantity=quantity_val,
        unit_price=unit_price_val,
        discount=discount,
        tax=tax,
        total_price=total_price,  # Backend calculated
        hsn_sac_code=item_data.get("hsn_sac_code")
    )


def _calculate_credit_note_totals_from_items(items_data, auto_round_off=False):
    """Calculate totals for credit note from individual item data (backend calculation)"""
    
    subtotal = 0.0
    total_discount = 0.0
    total_tax = 0.0
    
    for item in items_data:
        # Get item values - handle both field names from frontend
        quantity = float(item.get("quantity", 0))
        unit_price = float(item.get("unit_price", item.get("price_per_item", 0)))  # 🎯 FIX: Handle both field names
        discount_percentage = float(item.get("discount", 0))
        tax_percentage = float(item.get("tax", 0))
        
        # Calculate item subtotal
        item_subtotal = quantity * unit_price
        
        # Calculate discount
        item_discount = item_subtotal * (discount_percentage / 100)
        
        # Calculate taxable amount
        item_taxable_amount = item_subtotal - item_discount
        
        # Calculate tax
        item_tax = item_taxable_amount * (tax_percentage / 100)
        total_tax += item_tax
        
        # Update totals
        subtotal += item_subtotal
        total_discount += item_discount
    
    # Calculate total amount
    total_amount = subtotal - total_discount + total_tax
    
    # Calculate round off amount
    if auto_round_off:
        # Round to nearest integer and calculate difference
        rounded_total = round(total_amount)
        round_off_amount = rounded_total - total_amount
        total_amount = rounded_total
    else:
        round_off_amount = 0.0
    
    # Calculate taxable amount
    taxable_amount = subtotal - total_discount
    
    return {
        "subtotal": subtotal,
        "total_discount": total_discount,
        "total_tax": total_tax,
        "total_amount": total_amount,
        "taxable_amount": taxable_amount,
        "round_off_amount": round_off_amount
    }


def _calculate_credit_note_totals(items_data, charges_data=None):
    """Calculate totals for credit note from items and charges (legacy function for compatibility)"""
    charges = charges_data or {}
    
    # Calculate subtotal from items
    subtotal = sum(float(item.get("total_price") or item.get("amount", 0)) for item in items_data)
    
    # Extract other charges
    total_discount = float(charges.get("total_discount", 0) or 0)
    total_tax = float(charges.get("total_tax", 0) or 0)
    taxable_amount = float(charges.get("taxable_amount", subtotal) or subtotal)
    round_off_amount = float(charges.get("round_off_amount", 0) or 0)
    
    # Calculate total amount
    total_amount = subtotal - total_discount + total_tax + round_off_amount
    
    return {
        "subtotal": subtotal,
        "total_discount": total_discount,
        "total_tax": total_tax,
        "taxable_amount": taxable_amount,
        "round_off_amount": round_off_amount,
        "total_amount": total_amount
    }


@credit_note_blueprint.route("/", methods=["POST"])
@login_required
def create_credit_note():
    """
    Create a new credit note
    ---
    tags:
      - Credit Notes
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - customer_id
              - business_id
              - items
            properties:
              customer_id:
                type: string
                format: uuid
              business_id:
                type: integer
              invoice_id:
                type: string
                format: uuid
              credit_note_number:
                type: string
                description: Optional custom credit note number. If not provided, will be auto-generated.
              credit_note_date:
                type: string
                format: date
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
                    discount:
                      type: number
                    tax:
                      type: number
                    total_price:
                      type: number
              charges:
                type: object
              mark_as_fully_paid:
                type: boolean
              auto_round_off:
                type: boolean
              status:
                type: string
              additional_notes:
                type: object
    responses:
      201:
        description: Credit note created successfully
      400:
        description: Bad request - includes duplicate credit note number errors
      500:
        description: Server error
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get("customer_id") or not data.get("business_id"):
            return jsonify({"error": "Customer ID and Business ID are required"}), 400
        
        # Handle invoice_id - can be UUID or invoice number
        invoice_id = data.get("invoice_id")
        if invoice_id and not invoice_id.startswith("INV-"):
            # It's already a UUID, use as-is
            pass
        elif invoice_id:
            # It's an invoice number like "INV-1004", look up the UUID
            invoice = Invoice.query.filter_by(invoice_number=invoice_id).first()
            if not invoice:
                return jsonify({"error": f"Invoice {invoice_id} not found"}), 404
            invoice_id = str(invoice.uuid)
        else:
            invoice_id = None
        
        # Process items
        items_data = data.get("items", [])
        if not items_data:
            return jsonify({"error": "At least one item is required"}), 400
        
        # Validate each item (only basic validation, no amount required since backend calculates)
        for i, item in enumerate(items_data):
            quantity = item.get("quantity")
            if quantity is None or quantity == "":
                return jsonify({"error": f"Item {i+1}: Quantity is required"}), 400
            try:
                quantity_val = float(quantity)
                if quantity_val < 0:
                    return jsonify({"error": f"Item {i+1}: Quantity cannot be negative"}), 400
            except (ValueError, TypeError):
                return jsonify({"error": f"Item {i+1}: Quantity must be a valid number"}), 400
                
            # Require unit_price for backend calculation
            if not item.get("unit_price") and not item.get("price_per_item"):
                return jsonify({"error": f"Item {i+1}: Unit price is required for backend calculation"}), 400
        
        # Calculate totals using backend calculation
        auto_round_off = data.get("auto_round_off", False)
        totals = _calculate_credit_note_totals_from_items(items_data, auto_round_off)
        
        # Auto-set status based on invoice linkage
        if invoice_id:
            # When invoice is linked, items are from sales invoice, so set to refunded
            credit_note_status = "refunded"
        else:
            # When no invoice linked, manual credit note, so set to unpaid (ignore any "draft" from payload)
            credit_note_status = "unpaid"
        
        # Handle credit note number - use user-provided or auto-generate
        user_credit_note_number = data.get("credit_note_number", "").strip()
        
        if user_credit_note_number:
            # Validate uniqueness of user-provided credit note number
            existing_credit_note = CreditNote.query.filter_by(
                credit_note_number=user_credit_note_number, 
                is_deleted=False
            ).first()
            
            if existing_credit_note:
                return jsonify({
                    "success": False,
                    "error": f"Credit note number '{user_credit_note_number}' already exists"
                }), 400
            credit_note_number = user_credit_note_number
        else:
            # Generate auto number only when not provided
            # Using 4-digit sequential generation
            try:
                credit_note_number = generate_credit_note_number()
            except Exception as e:
                current_app.logger.error(f"Error in generate_credit_note_number: {str(e)}")
                # Even this should not fail, but if it does, create a manual 4-digit number
                import time
                timestamp = int(time.time())
                fallback_num = timestamp % 9000 + 1000  # Ensure 4-digit number between 1000-9999
                credit_note_number = f"CN-{fallback_num:04d}"
        
        
        # Create credit note with backend-calculated charges
        credit_note = CreditNote(
            credit_note_number=credit_note_number,
            invoice_id=invoice_id,
            business_id=data["business_id"],
            customer_id=data["customer_id"],
            credit_note_date=datetime.strptime(data.get("credit_note_date", datetime.now().strftime("%Y-%m-%d")), "%Y-%m-%d").date(),
            total_amount=totals["total_amount"],
            amount_received=float(data.get("amount_received", 0)),
            balance_amount=totals["total_amount"] - float(data.get("amount_received", 0)),
            charges={
                "total_discount": totals["total_discount"],
                "total_tax": totals["total_tax"],
                "taxable_amount": totals["taxable_amount"],
                "round_off_amount": totals["round_off_amount"]
            },
            mark_as_fully_paid=data.get("mark_as_fully_paid", False),
            auto_round_off=auto_round_off,
            status=credit_note_status,
            additional_notes=data.get("additional_notes", {}),
            original_invoice_payment_status=None  # Will be set below if invoice exists
        )
        
        # Set audit fields
        set_created_fields(credit_note)
        
        # Add items
        for item_data in items_data:
            credit_note.items.append(_build_credit_note_item(item_data))
        
        db.session.add(credit_note)
        db.session.commit()
        
        # Update invoice status using the helper function if credit note is linked to an invoice
        if invoice_id:
            try:
                # Store original payment_status in credit note before updating
                invoice = Invoice.query.filter_by(uuid=invoice_id).first()
                if invoice:
                    credit_note.original_invoice_payment_status = invoice.payment_status
                    
                    # Use the helper function to update invoice payment status
                    update_invoice_payment_status(invoice_id)
            except Exception as e:
                # Log the error but don't fail the credit note creation
                pass
        
        return jsonify({
            "success": True,
            "message": "Credit note created successfully",
            "data": {
                "uuid": str(credit_note.uuid),
                "credit_note_number": credit_note.credit_note_number,
                "total_amount": float(credit_note.total_amount),
                "subtotal": float(totals["subtotal"]),
                "tax_total": float(totals["total_tax"]),
                "discount_total": float(totals["total_discount"]),
                "balance_amount": float(credit_note.balance_amount),
                "amount_received": float(credit_note.amount_received),
                "status": credit_note.status
            }
        }), 201
        
    except IntegrityError as e:
        db.session.rollback()
        # Check if this is a duplicate credit_note_number error
        if "credit_notes_credit_note_number_key" in str(e):
            # Try to generate a new number and retry once
            try:
                # Clear session state before retry
                db.session.rollback()
                import time
                timestamp = int(time.time())
                fallback_num = timestamp % 9000 + 1000  # Ensure 4-digit number between 1000-9999
                new_credit_note_number = f"CN-{fallback_num:04d}"
                credit_note.credit_note_number = new_credit_note_number
                db.session.add(credit_note)
                db.session.commit()
                
                return jsonify({
                    "message": "Credit note created successfully",
                    "data": {
                        "uuid": str(credit_note.uuid),
                        "credit_note_number": credit_note.credit_note_number,
                        "total_amount": float(credit_note.total_amount),
                        "subtotal": float(totals["subtotal"]),
                        "tax_total": float(totals["total_tax"]),
                        "discount_total": float(totals["total_discount"]),
                        "balance_amount": float(credit_note.balance_amount),
                        "amount_received": float(credit_note.amount_received),
                        "status": credit_note.status
                    }
                }), 201
            except Exception as retry_error:
                db.session.rollback()
                return jsonify({
                    "success": False, 
                    "error": "Failed to generate unique credit note number. Please try again."
                }), 500
        else:
            return jsonify({
                "success": False,
                "error": "Database constraint violation",
                "details": str(e)
            }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500


@credit_note_blueprint.route("/credit-note-dropdown", methods=["GET"])
@login_required
def credit_note_dropdown():
    """
    Get credit notes for dropdown (minimal data)
    ---
    tags:
      - Credit Notes
    parameters:
      - name: business_id
        in: query
        type: integer
      - name: customer_id
        in: query
        type: string
        format: uuid
    responses:
      200:
        description: Credit notes for dropdown retrieved successfully
    """
    try:
        # Get query parameters
        business_id = request.args.get("business_id")
        customer_id = request.args.get("customer_id")
        
        # Build query
        query = CreditNote.query.filter_by(is_deleted=False)
        
        if business_id:
            query = query.filter_by(business_id=business_id)
        if customer_id:
            query = query.filter_by(customer_id=customer_id)
        
        # Get minimal data for dropdown
        credit_notes = query.with_entities(
            CreditNote.uuid,
            CreditNote.credit_note_number,
            CreditNote.total_amount
        ).all()
        
        return jsonify({
            "success": True,
            "data": [
                {
                    "uuid": str(cn.uuid),
                    "credit_note_number": cn.credit_note_number,
                    "total_amount": float(cn.total_amount)
                }
                for cn in credit_notes
            ]
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500


@credit_note_blueprint.route("/", methods=["GET"])
@login_required
def list_credit_notes():
    """
    List all credit notes with optional filters
    ---
    tags:
      - Credit Notes
    parameters:
      - name: business_id
        in: query
        type: integer
      - name: customer_id
        in: query
        type: string
        format: uuid
      - name: party_name
        in: query
        type: string
        required: false
        description: Filter by customer/party name
      - name: credit_note_number
        in: query
        type: string
        required: false
        description: Filter by credit note number
      - name: status
        in: query
        type: string
      - name: page
        in: query
        type: integer
        default: 1
      - name: per_page
        in: query
        type: integer
        default: 20
    responses:
      200:
        description: Credit notes retrieved successfully
    """
    try:
        # Get query parameters
        business_id = request.args.get("business_id")
        customer_id = request.args.get("customer_id")
        status = request.args.get("status")
        party_name = request.args.get("party_name", "").strip()
        credit_note_number = request.args.get("credit_note_number", "").strip()
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 20))
        order = request.args.get("order", "desc")
        customer_dropdown = request.args.get("customer_dropdown") == "true"
        
        # Build query
        query = CreditNote.query.filter_by(is_deleted=False)
        
        # Apply credit_note_number filter if provided
        if credit_note_number:
            query = query.filter(CreditNote.credit_note_number.ilike(f'%{credit_note_number}%'))
        
        # Apply party_name filter if provided (similar to invoice.py)
        if party_name:
            # Handle multiple spaces by normalizing them
            normalized_party_name = ' '.join(party_name.split())
            query = query.outerjoin(Customer, CreditNote.customer_id == Customer.uuid).filter(
                or_(
                    Customer.first_name.ilike(f'%{party_name}%'),
                    Customer.last_name.ilike(f'%{party_name}%'),
                    func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{party_name}%'),
                    func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{normalized_party_name}%')
                )
            )
        else:
            # If no party_name filter, ensure we still have the customer join for consistent behavior
            query = query.outerjoin(Customer, CreditNote.customer_id == Customer.uuid)
        
        if business_id:
            query = query.filter_by(business_id=business_id)
        if customer_id:
            query = query.filter_by(customer_id=customer_id)
        if status:
            query = query.filter(CreditNote.status == status)
        
        # Handle customer dropdown (return minimal data with customer info)
        if customer_dropdown:
            # Create fresh query for customer dropdown to avoid join conflicts
            dropdown_query = CreditNote.query.filter_by(is_deleted=False)
            
            # Apply the same filters as main query
            if business_id:
                dropdown_query = dropdown_query.filter_by(business_id=business_id)
            if customer_id:
                dropdown_query = dropdown_query.filter_by(customer_id=customer_id)
            if status:
                dropdown_query = dropdown_query.filter(CreditNote.status == status)
            if credit_note_number:
                dropdown_query = dropdown_query.filter(CreditNote.credit_note_number.ilike(f'%{credit_note_number}%'))
            if party_name:
                normalized_party_name = ' '.join(party_name.split())
                dropdown_query = dropdown_query.outerjoin(Customer, CreditNote.customer_id == Customer.uuid).filter(
                    or_(
                        Customer.first_name.ilike(f'%{party_name}%'),
                        Customer.last_name.ilike(f'%{party_name}%'),
                        func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{party_name}%'),
                        func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{normalized_party_name}%')
                    )
                )
            else:
                dropdown_query = dropdown_query.outerjoin(Customer, CreditNote.customer_id == Customer.uuid)
            
            credit_notes = dropdown_query.with_entities(
                CreditNote.uuid,
                CreditNote.credit_note_number,
                CreditNote.total_amount,
                CreditNote.customer_id,
                Customer.first_name,
                Customer.last_name
            ).all()
            
            return jsonify({
                "success": True,
                "data": [
                    {
                        "uuid": str(cn.uuid),
                        "credit_note_number": cn.credit_note_number,
                        "total_amount": float(cn.total_amount),
                        "customer_id": str(cn.customer_id) if cn.customer_id else None,
                        "party_name": f"{cn.first_name or ''} {cn.last_name or ''}".strip() if cn.first_name or cn.last_name else None
                    }
                    for cn in credit_notes
                ]
            })
        
        # Apply ordering
        if order.lower() == "asc":
            query = query.order_by(asc(CreditNote.created_at))
        else:
            query = query.order_by(desc(CreditNote.created_at))
        
        # Apply pagination
        credit_notes = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # Format response
        result = {
            "success": True,
            "data": {
                "credit_notes": [],
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": credit_notes.total,
                    "pages": credit_notes.pages
                }
            }
        }
        
        for cn in credit_notes.items:
            result["data"]["credit_notes"].append({
                "uuid": str(cn.uuid),
                "credit_note_number": cn.credit_note_number,
                "customer_id": str(cn.customer_id),
                "customer_name": f"{cn.customer.first_name} {cn.customer.last_name}" if cn.customer else None,
                "invoice_id": str(cn.invoice_id) if cn.invoice_id else None,
                "invoice_number": cn.invoice.invoice_number if cn.invoice else None,
                "credit_note_date": cn.credit_note_date.strftime("%Y-%m-%d"),
                "total_amount": float(cn.total_amount),
                "amount_received": float(cn.amount_received),
                "balance_amount": float(cn.balance_amount),
                "status": cn.status,
                "created_at": cn.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500


@credit_note_blueprint.route("/<uuid:credit_note_id>", methods=["GET"])
@login_required
def get_credit_note(credit_note_id):
    """
    Get a single credit note by ID
    ---
    tags:
      - Credit Notes
    parameters:
      - name: credit_note_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Credit note retrieved successfully
      404:
        description: Credit note not found
    """
    try:
        credit_note = CreditNote.query.filter_by(uuid=credit_note_id, is_deleted=False).first()
        
        if not credit_note:
            return jsonify({"success": False, "error": "Credit note not found"}), 404
        
        # Get items
        items = []
        for item in credit_note.items:
            items.append({
                "uuid": str(item.uuid),
                "item_id": str(item.item_id) if item.item_id else None,
                "item_name": item.item.item_name if item.item else None,
                "description": item.description,
                "hsn_sac_code": item.hsn_sac_code,
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "discount": item.discount,
                "tax": item.tax,
                "total_price": float(item.total_price)
            })
        
        # Get payments
        payments = []
        for payment in credit_note.payments:
            payments.append({
                "uuid": str(payment.uuid),
                "payment_amount": float(payment.payment_amount),
                "payment_date": payment.payment_date.strftime("%Y-%m-%d"),
                "payment_method": payment.payment_method,
                "payment_reference": payment.payment_reference,
                "status": payment.status
            })
        
        return jsonify({
            "success": True,
            "data": {
                "uuid": str(credit_note.uuid),
                "credit_note_number": credit_note.credit_note_number,
                "invoice_id": str(credit_note.invoice_id) if credit_note.invoice_id else None,
                "invoice_number": credit_note.invoice.invoice_number if credit_note.invoice else None,
                "business_id": credit_note.business_id,
                "customer_id": str(credit_note.customer_id),
                "customer_name": f"{credit_note.customer.first_name} {credit_note.customer.last_name}" if credit_note.customer else None,
                "credit_note_date": credit_note.credit_note_date.strftime("%Y-%m-%d"),
                "total_amount": float(credit_note.total_amount),
                "amount_received": float(credit_note.amount_received),
                "balance_amount": float(credit_note.balance_amount),
                "charges": credit_note.charges,
                "mark_as_fully_paid": credit_note.mark_as_fully_paid,
                "auto_round_off": credit_note.auto_round_off,
                "status": credit_note.status,
                "additional_notes": credit_note.additional_notes,
                "items": items,
                "payments": payments,
                "created_at": credit_note.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": credit_note.updated_at.strftime("%Y-%m-%d %H:%M:%S")
            }
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500


@credit_note_blueprint.route("/<uuid:credit_note_id>", methods=["PUT"])
@login_required
def update_credit_note(credit_note_id):
    """
    Update an existing credit note
    ---
    tags:
      - Credit Notes
    parameters:
      - name: credit_note_id
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
              customer_id:
                type: string
                format: uuid
              invoice_id:
                type: string
                format: uuid
              credit_note_date:
                type: string
                format: date
              items:
                type: array
              charges:
                type: object
              mark_as_fully_paid:
                type: boolean
              auto_round_off:
                type: boolean
              status:
                type: string
              additional_notes:
                type: object
    responses:
      200:
        description: Credit note updated successfully
      404:
        description: Credit note not found
      400:
        description: Cannot update credit note
    """
    try:
        credit_note = CreditNote.query.filter_by(uuid=credit_note_id, is_deleted=False).first()
        
        if not credit_note:
            return jsonify({"success": False, "error": "Credit note not found"}), 404
        
        # Prevent updates if credit note is paid or cancelled
        if credit_note.status in ["paid", "cancelled"]:
            return jsonify({"success": False, "error": f"Cannot update credit note with status: {credit_note.status}"}), 400
        
        data = request.get_json()
        
        # Update basic fields
        if "customer_id" in data:
            credit_note.customer_id = data["customer_id"]
        if "business_id" in data:
            credit_note.business_id = data["business_id"]
        if "credit_note_date" in data:
            credit_note.credit_note_date = datetime.strptime(data["credit_note_date"], "%Y-%m-%d").date()
        if "additional_notes" in data:
            credit_note.additional_notes = data["additional_notes"]
        if "charges" in data:
            credit_note.charges = data["charges"]
        
        # Update items if provided
        if "items" in data:
            # Remove existing items
            old_items = CreditNoteItem.query.filter_by(credit_note_id=credit_note.uuid).all()
            
            for old_item in old_items:
                db.session.delete(old_item)
            
            # Add new items
            items_data = data["items"]
            for item_data in items_data:
                credit_note.items.append(_build_credit_note_item(item_data))
        elif "creditNoteItems" in data:
            # Remove existing items
            old_items = CreditNoteItem.query.filter_by(credit_note_id=credit_note.uuid).all()
            
            for old_item in old_items:
                db.session.delete(old_item)
            
            # Add new items
            items_data = data["creditNoteItems"]
            for item_data in items_data:
                credit_note.items.append(_build_credit_note_item(item_data))
            
            # Recalculate totals using backend calculation
            auto_round_off = data.get("auto_round_off", credit_note.auto_round_off)
            try:
                totals = _calculate_credit_note_totals_from_items(items_data, auto_round_off)
            except Exception as e:
                raise
            
            # Update credit note with calculated values
            credit_note.subtotal = totals["subtotal"]
            credit_note.total_discount = totals["total_discount"]
            credit_note.total_tax = totals["total_tax"]
            credit_note.total_amount = totals["total_amount"]
            credit_note.taxable_amount = totals["taxable_amount"]
            credit_note.round_off_amount = totals["round_off_amount"]
            credit_note.auto_round_off = auto_round_off
        
        # Update charges if provided (without items)
        elif "charges" in data:
            charges_data = data["charges"]
            credit_note.charges = charges_data
            
            # Recalculate totals with existing items
            items_data = [{"total_price": float(item.total_price)} for item in credit_note.items]
            totals = _calculate_credit_note_totals(items_data, charges_data)
            
            credit_note.total_amount = totals["total_amount"]
            credit_note.balance_amount = credit_note.total_amount - float(credit_note.amount_received)
        
        # Set audit fields
        set_updated_fields(credit_note)
        
        db.session.commit()
        
        # Update invoice status using helper function if credit note is linked to an invoice and items were updated
        if credit_note.invoice_id and ("items" in data or "charges" in data):
            try:
                # Use the helper function to update invoice payment status
                update_invoice_payment_status(credit_note.invoice_id)
            except Exception as e:
                # Log error but don't fail the credit note update
                pass
        
        return jsonify({
            "success": True,
            "message": "Credit note updated successfully",
            "data": {
                "uuid": str(credit_note.uuid),
                "credit_note_number": credit_note.credit_note_number,
                "total_amount": float(credit_note.total_amount),
                "subtotal": float(credit_note.subtotal),
                "tax_total": float(credit_note.total_tax),
                "discount_total": float(credit_note.total_discount),
                "balance_amount": float(credit_note.balance_amount),
                "amount_received": float(credit_note.amount_received),
                "status": credit_note.status
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500

@credit_note_blueprint.route("/<uuid:credit_note_id>", methods=["DELETE"])
@login_required
def delete_credit_note(credit_note_id):
    """
    Soft delete a credit note
    ---
    tags:
      - Credit Notes
    parameters:
      - name: credit_note_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Credit note deleted successfully
      404:
        description: Credit note not found
      400:
        description: Cannot delete paid credit note
    """
    try:
        credit_note = CreditNote.query.filter_by(uuid=credit_note_id, is_deleted=False).first()
        
        if not credit_note:
            return jsonify({"success": False, "error": "Credit note not found"}), 404
        
        # Prevent deletion if credit note is paid
        if credit_note.status == "paid":
            return jsonify({"success": False, "error": "Cannot delete paid credit note"}), 400
        
        # Soft delete
        credit_note.is_deleted = True
        credit_note.status = "cancelled"
        set_updated_fields(credit_note)
        
        # Update invoice status using helper function if credit note was linked to an invoice
        if credit_note.invoice_id:
            try:
                # Use the helper function to recalculate invoice payment status
                # This will automatically handle the case where no credit notes remain
                update_invoice_payment_status(credit_note.invoice_id)
            except Exception as e:
                # Log error but don't fail the credit note deletion
                pass
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Credit note deleted successfully",
            "data": {
                "uuid": str(credit_note.uuid),
                "credit_note_number": credit_note.credit_note_number,
                "is_deleted": True
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": "An error occurred while deleting the credit note", "details": str(e)}), 500


@credit_note_blueprint.route("/<uuid:credit_note_id>/record-payment", methods=["POST"])
@login_required
def record_payment(credit_note_id):
    """
    Record a payment for a credit note
    ---
    tags:
      - Credit Notes
    parameters:
      - name: credit_note_id
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
              - payment_amount
            properties:
              payment_amount:
                type: number
              payment_method:
                type: string
              payment_reference:
                type: string
              payment_notes:
                type: string
              payment_date:
                type: string
                format: date
    responses:
      200:
        description: Payment recorded successfully
      404:
        description: Credit note not found
    """
    data = request.get_json()
    credit_note = CreditNote.query.filter_by(uuid=credit_note_id, is_deleted=False).first()
    
    if not credit_note:
        return jsonify({"success": False, "error": "Credit note not found"}), 404
    
    if credit_note.status == "cancelled":
        return jsonify({"success": False, "error": "Cannot add payment to cancelled credit note"}), 400
    
    try:
        payment_amount = float(data.get("payment_amount", 0))
        
        if payment_amount <= 0:
            return jsonify({"success": False, "error": "Payment amount must be greater than 0"}), 400
        
        # Calculate maximum allowed payment to prevent overpayment
        current_amount_received = float(credit_note.amount_received or 0)
        max_allowed_payment = float(credit_note.total_amount) - current_amount_received
        
        # Add small epsilon tolerance for floating-point precision
        epsilon = 0.01  # 1 paisa tolerance
        
        # Check for overpayment with tolerance
        if payment_amount > max_allowed_payment + epsilon:
            return jsonify({
                "success": False,
                "error": "Overpayment not allowed",
                "details": f"Maximum allowed payment is ₹{max_allowed_payment:.2f}, but you attempted to pay ₹{payment_amount:.2f}",
                "max_allowed": max_allowed_payment,
                "attempted_amount": payment_amount,
                "current_amount_received": current_amount_received,
                "total_amount": float(credit_note.total_amount)
            }), 400
        
        # Create payment record
        payment = CreditNotePayment(
            credit_note_id=credit_note.uuid,
            invoice_id=credit_note.invoice_id,  # Set invoice_id if credit note is linked to an invoice
            payment_amount=payment_amount,
            payment_date=datetime.strptime(data.get("payment_date", datetime.now().strftime("%Y-%m-%d")), "%Y-%m-%d").date(),
            payment_method=data.get("payment_method", "cash"),
            payment_reference=data.get("payment_reference"),
            payment_notes=data.get("payment_notes"),
            status=data.get("status", "completed")
        )
        
        # Set audit fields
        set_created_fields(payment)
        
        # Update credit note amounts
        credit_note.amount_received = current_amount_received + payment_amount
        calculated_balance = float(credit_note.total_amount) - credit_note.amount_received
        credit_note.balance_amount = max(0, calculated_balance)
        
        # Update status - ensure proper status setting
        if credit_note.balance_amount <= 0:
            credit_note.status = "paid"
            credit_note.mark_as_fully_paid = True
            credit_note.balance_amount = 0
        elif credit_note.amount_received > 0:
            credit_note.status = "partially_paid"
        
        # Force refresh the credit note object to ensure latest values
        db.session.flush()  # Ensure changes are written to session
        
        db.session.add(payment)
        db.session.commit()
        
        # Refresh the credit note to get the latest committed values
        db.session.refresh(credit_note)
        
        return jsonify({
            "success": True,
            "message": "Payment recorded successfully",
            "data": {
                "payment_uuid": str(payment.uuid),
                "payment_amount": float(payment.payment_amount),
                "amount_received": float(credit_note.amount_received),
                "balance_amount": float(credit_note.balance_amount),
                "status": credit_note.status
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500


@credit_note_blueprint.route("/<uuid:credit_note_id>/payments", methods=["GET"])
@login_required
def get_payments(credit_note_id):
    """
    Get all payments for a credit note
    ---
    tags:
      - Credit Notes
    parameters:
      - name: credit_note_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Payments retrieved successfully
      404:
        description: Credit note not found
    """
    try:
        credit_note = CreditNote.query.filter_by(uuid=credit_note_id, is_deleted=False).first()
        
        if not credit_note:
            return jsonify({"success": False, "error": "Credit note not found"}), 404
        
        # Get payments
        payments = CreditNotePayment.query.filter_by(credit_note_id=credit_note.uuid, is_deleted=False).order_by(desc(CreditNotePayment.payment_date)).all()
        
        result = {
            "success": True,
            "data": {
                "credit_note_id": str(credit_note.uuid),
                "credit_note_number": credit_note.credit_note_number,
                "total_amount": float(credit_note.total_amount),
                "amount_received": float(credit_note.amount_received),
                "balance_amount": float(credit_note.balance_amount),
                "payments": []
            }
        }
        
        for payment in payments:
            result["data"]["payments"].append({
                "uuid": str(payment.uuid),
                "payment_amount": float(payment.payment_amount),
                "payment_date": payment.payment_date.strftime("%Y-%m-%d"),
                "payment_method": payment.payment_method,
                "payment_reference": payment.payment_reference,
                "payment_notes": payment.payment_notes,
                "status": payment.status,
                "created_at": payment.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500


@credit_note_blueprint.route("/<uuid:credit_note_id>/status", methods=["PUT"])
@login_required
def update_status(credit_note_id):
    """
    Update credit note status
    ---
    tags:
      - Credit Notes
    parameters:
      - name: credit_note_id
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
              - status
            properties:
              status:
                type: string
                enum: [draft, sent, partially_paid, paid, cancelled]
    responses:
      200:
        description: Status updated successfully
      404:
        description: Credit note not found
      400:
        description: Invalid status or business logic violation
    """
    try:
        credit_note = CreditNote.query.filter_by(uuid=credit_note_id, is_deleted=False).first()
        
        if not credit_note:
            return jsonify({"success": False, "error": "Credit note not found"}), 404
        
        data = request.get_json()
        new_status = data.get("status")
        
        if not new_status:
            return jsonify({"success": False, "error": "Status is required"}), 400
        
        valid_statuses = ["unpaid", "refunded", "partially_paid", "paid", "cancelled"]
        if new_status not in valid_statuses:
            return jsonify({"success": False, "error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400
        
        # Business logic validations
        if new_status == "paid" and float(credit_note.balance_amount) > 0:
            return jsonify({"success": False, "error": "Cannot mark as paid when balance amount is greater than 0"}), 400
        
        if new_status == "cancelled" and credit_note.status == "paid":
            return jsonify({"success": False, "error": "Cannot cancel paid credit note"}), 400
         
        credit_note.status = new_status
        set_updated_fields(credit_note)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Status updated successfully",
            "data": {
                "uuid": str(credit_note.uuid),
                "credit_note_number": credit_note.credit_note_number,
                "status": credit_note.status
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": "An error occurred", "details": str(e)}), 500
