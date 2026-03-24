from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.extensions import db
from app.models.debit_note import DebitNote, DebitNoteItem, DebitNotePayment
from app.models.vendor import Vendor
from app.models.inventory import Item
from app.models.invoice import Invoice
from app.models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceItem
from app.models import Customer
from app.utils.decorators import login_required
from sqlalchemy.orm import joinedload
from sqlalchemy import func, and_, or_
from datetime import datetime
import uuid
import os


def calculate_debit_note_balance_due(debit_note):
    """
    Calculate balance due for a debit note based on item quantities.
    Balance due is the amount still owed on the original purchase invoice
    after accounting for the debit note items.
    """
    try:
        
        if not debit_note.invoice_id:
            simple_balance = float(debit_note.total_amount - debit_note.amount_received)
            return simple_balance
        
        invoice = PurchaseInvoice.query.filter_by(uuid=debit_note.invoice_id).first()
        if not invoice:
            no_invoice_balance = float(debit_note.total_amount - debit_note.amount_received)
            return no_invoice_balance
        
        
        # Get original invoice items
        invoice_items = PurchaseInvoiceItem.query.filter_by(purchase_invoice_id=invoice.uuid).all()
        
        # Create a map of original quantities
        original_quantities = {}
        for item in invoice_items:
            if item.item_id:
                original_quantities[str(item.item_id)] = {
                    'quantity': float(item.quantity) if item.quantity else 0,
                    'unit_price': float(item.unit_price) if item.unit_price else 0
                }
        
        # Get debit note items to calculate returned quantities
        returned_quantities = {}
        try:
            # Explicitly query debit note items to ensure they're loaded
            from app.models.debit_note import DebitNoteItem
            debit_note_items = DebitNoteItem.query.filter_by(
                debit_note_id=debit_note.uuid,
                is_deleted=False
            ).all()
            
            
            # Also try querying without is_deleted filter
            all_items = DebitNoteItem.query.filter_by(debit_note_id=debit_note.uuid).all()
            pass
            
            for item in debit_note_items:
                if item.item_id and not item.is_deleted:
                    returned_quantities[str(item.item_id)] = float(item.quantity) if item.quantity else 0
                else:
                    pass
        except Exception as e:
            pass
        
        # Calculate balance due based on remaining quantities
        balance_due = 0.0
        
        for item_id, original_data in original_quantities.items():
            returned_qty = returned_quantities.get(item_id, 0)
            remaining_qty = original_data['quantity'] - returned_qty
            
            
            if remaining_qty > 0:
                item_balance = remaining_qty * original_data['unit_price']
                balance_due += item_balance
            else:
                pass
        
        return balance_due
        
    except Exception as e:
        # Fallback to purchase invoice remaining balance if quantity calculation fails
        if debit_note.invoice_id:
            # Get the purchase invoice and return its remaining balance
            from app.models.purchase_invoice import PurchaseInvoice
            invoice = PurchaseInvoice.query.filter_by(uuid=debit_note.invoice_id).first()
            if invoice:
                # Use the same calculation as purchase invoice
                invoice_balance = max(0.0, float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount or 0))
                return invoice_balance
        
        # If no invoice, use simple calculation
        fallback_balance = float(debit_note.total_amount - debit_note.amount_received)
        return fallback_balance


def generate_debit_note_number(max_retries=5):
    """Generate a unique debit note number like DN-1834 with 4 digits - Production Ready"""
    import time
    import random
    
    for attempt in range(max_retries):
        try:
            
            # Method 1: Try to get the MAX from active records only
            result = db.session.execute(
                db.text("""
                    SELECT MAX(CAST(SUBSTRING(debit_note_number FROM 5) AS INTEGER)) as max_num 
                    FROM debit_notes 
                    WHERE debit_note_number LIKE 'DN-%' 
                    AND debit_note_number ~ 'DN-[0-9]{4}$'
                    AND is_deleted = FALSE
                """)
            )
            max_num = result.scalar()
            
            # Method 2: Also check ALL records (including deleted) to avoid any conflicts
            result_all = db.session.execute(
                db.text("""
                    SELECT MAX(CAST(SUBSTRING(debit_note_number FROM 5) AS INTEGER)) as max_num_all 
                    FROM debit_notes 
                    WHERE debit_note_number LIKE 'DN-%' 
                    AND debit_note_number ~ 'DN-[0-9]{4}$'
                """)
            )
            max_num_all = result_all.scalar()
            
            # Use the higher of the two to ensure no conflicts
            effective_max = max(max_num or 0, max_num_all or 0)
            
            if effective_max >= 1000:
                # Start from effective_max + 1
                new_num = effective_max + 1
                # Ensure it doesn't exceed 9999
                if new_num > 9999:
                    new_num = 1000  # Reset to 1000 if we exceed 9999
            else:
                new_num = 1000  # Start from DN-1000
            
            # Try up to 10 consecutive numbers to find a free one
            for offset in range(10):
                candidate_num = new_num + offset
                if candidate_num > 9999:
                    candidate_num = 1000 + (candidate_num - 10000)  # Wrap around
                
                candidate_number = f"DN-{candidate_num:04d}"
                
                # Check if this number exists in ANY state (active or deleted)
                existing_any = DebitNote.query.filter_by(
                    debit_note_number=candidate_number
                ).first()
                
                if not existing_any:
                    return candidate_number
                else:
                    pass
            
            # If we get here, all 10 numbers were taken, try a random approach
            for random_attempt in range(5):
                random_num = random.randint(1000, 9999)
                random_number = f"DN-{random_num:04d}"
                
                existing_random = DebitNote.query.filter_by(
                    debit_note_number=random_number
                ).first()
                
                if not existing_random:
                    return random_number
            
            
        except Exception as e:
            
            # Rollback any partial transaction
            try:
                db.session.rollback()
            except:
                pass
        
        # Brief delay before retry
        if attempt < max_retries - 1:
            time.sleep(0.1 * (attempt + 1))  # Increasing delay
    
    # Final fallback - use timestamp with random suffix
    timestamp = int(time.time())
    random_suffix = random.randint(100, 999)
    fallback_num = (timestamp + random_suffix) % 9000 + 1000
    return f"DN-{fallback_num:04d}"


def update_purchase_invoice_payment_status(purchase_invoice_id):
    """
    Update purchase invoice payment_status based on debit notes
    This function calculates the effective payment status considering:
    - Item quantities returned vs original quantities
    - Full return = paid, Partial return = partial, No return = unpaid
    """
    try:
        purchase_invoice = PurchaseInvoice.query.filter_by(uuid=purchase_invoice_id).first()
        if not purchase_invoice:
            return False
        
        # Get all debit notes for this purchase invoice
        debit_notes = DebitNote.query.filter_by(
            invoice_id=purchase_invoice_id, 
            is_deleted=False
        ).all()
        
        
        if not debit_notes:
            # No debit notes - status remains unpaid
            purchase_invoice.payment_status = "unpaid"
        else:
            # Get original purchase invoice items
            original_items = PurchaseInvoiceItem.query.filter_by(
                purchase_invoice_id=purchase_invoice_id
            ).all()
            
            # Create a dict of original quantities by item_id
            original_quantities = {}
            for item in original_items:
                if item.item_id:
                    original_quantities[str(item.item_id)] = float(item.quantity)
            
            # Calculate total returned quantities for each item across all debit notes
            returned_quantities = {}
            for dn in debit_notes:
                dn_items = DebitNoteItem.query.filter_by(debit_note_id=dn.uuid).all()
                for dn_item in dn_items:
                    if dn_item.item_id:
                        item_key = str(dn_item.item_id)
                        if item_key not in returned_quantities:
                            returned_quantities[item_key] = 0
                        returned_quantities[item_key] += float(dn_item.quantity)
            
            
            # Check if all items are fully returned
            all_fully_returned = True
            any_partially_returned = False
            
            for item_id, original_qty in original_quantities.items():
                returned_qty = returned_quantities.get(item_id, 0)
                
                if returned_qty >= original_qty:
                    pass
                elif returned_qty > 0:
                    any_partially_returned = True
                    all_fully_returned = False
                else:
                    all_fully_returned = False
            
            # Update status based on return quantities
            if all_fully_returned:
                purchase_invoice.payment_status = "paid"
            elif any_partially_returned or returned_quantities:
                purchase_invoice.payment_status = "partial"
            else:
                purchase_invoice.payment_status = "unpaid"
        
        # Commit the changes
        db.session.commit()
        return True
        
    except Exception as e:
        db.session.rollback()
        return False


debit_note_blueprint = Blueprint("debit_note", __name__)


@debit_note_blueprint.route('/api/debit-notes/next-number', methods=['GET'])
@login_required
@jwt_required()
def get_next_debit_note_number():
    """Get the next available debit note number for the business"""
    try:
        next_number = generate_debit_note_number()
        
        return jsonify({
            "success": True,
            "data": next_number,
            "status": 200
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting next debit note number: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to generate debit note number",
            "status": 500
        }), 500


@debit_note_blueprint.route('/', methods=['POST'])
@login_required
@jwt_required()
def create_debit_note():
    """Create a new debit note"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            # If JWT identity is a string (UUID), parse it
            user_id = jwt_claims
            business_id = 1  # Default fallback
        else:
            # If JWT claims is a dict, extract from claims
            user_id = jwt_claims.get('sub') or jwt_claims.get('user_id')
            business_id = jwt_claims.get('business_id', 1)
        
        data = request.get_json()
        
        # Handle both customer_id and vendor_id for backward compatibility
        if 'customer_id' in data and data['customer_id']:
            data['vendor_id'] = data['customer_id']
        
        # Generate debit note number if not provided or empty
        if not data.get('debit_note_number') or data.get('debit_note_number') == '':
            data['debit_note_number'] = generate_debit_note_number()
        
        # Validate required fields
        required_fields = ['vendor_id', 'debit_note_date']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "message": f"Missing required field: {field}",
                    "status": 400
                }), 400
        
        # Check if debit note number already exists
        existing_debit_note = DebitNote.query.filter_by(
            debit_note_number=data['debit_note_number'],
            is_deleted=False
        ).first()
        
        if existing_debit_note:
            return jsonify({
                "success": False,
                "message": "Debit note number already exists",
                "status": 400
            }), 400
        
        # Validate vendor exists
        vendor = Vendor.query.filter_by(
            uuid=data['vendor_id']
        ).first()
        
        if not vendor:
            return jsonify({
                "success": False,
                "message": "Vendor not found",
                "status": 404
            }), 404
        
        # Validate invoice if provided
        invoice = None
        if 'invoice_id' in data and data['invoice_id']:
            # Check if the invoice_id looks like a UUID (has dashes and proper format)
            invoice_id_str = str(data['invoice_id'])
            
            # Find the invoice first to get its UUID
            invoice_uuid = None
            if '-' in invoice_id_str and len(invoice_id_str) == 36:
                # Try to find by UUID first
                invoice = Invoice.query.filter_by(
                    uuid=data['invoice_id'],
                    is_deleted=False
                ).first()
                
                if not invoice:
                    # Try PurchaseInvoice table
                    invoice = PurchaseInvoice.query.filter_by(
                        uuid=data['invoice_id'],
                        is_deleted=False
                    ).first()
                
                if invoice:
                    invoice_uuid = invoice.uuid
            else:
                # Try by invoice number in both tables
                invoice = Invoice.query.filter_by(
                    invoice_number=data['invoice_id'],
                    is_deleted=False
                ).first()
                
                if not invoice:
                    # Try PurchaseInvoice table
                    invoice = PurchaseInvoice.query.filter_by(
                        invoice_number=data['invoice_id'],
                        is_deleted=False
                    ).first()
                
                if invoice:
                    invoice_uuid = invoice.uuid
            
            # Now check if this invoice already has a debit note
            if invoice_uuid:
                existing_debit_note = DebitNote.query.filter_by(
                    invoice_id=invoice_uuid,
                    business_id=business_id,
                    is_deleted=False
                ).first()
                
                if existing_debit_note:
                    return jsonify({
                        "success": False,
                        "message": f"Debit note already exists for this invoice (DN-{existing_debit_note.debit_note_number}). Only one debit note is allowed per purchase invoice.",
                        "status": 400
                    }), 400
            
            if not invoice:
                # Let's check what invoices exist in both tables
                all_invoices = Invoice.query.filter_by(is_deleted=False).all()
                all_purchase_invoices = PurchaseInvoice.query.filter_by(is_deleted=False).all()
                
                return jsonify({
                    "success": False,
                    "message": "Invoice not found",
                    "status": 404
                }), 404
        
        # Calculate charges and total amount
        charges_data = {}
        total_amount = 0
        amount_received = 0
        balance_amount = 0
        
        if 'charges' in data:
            charges = data['charges']
            
            # Extract or calculate charge components
            subtotal = charges.get('subtotal', 0)
            total_tax = charges.get('total_tax', 0)
            total_discount = charges.get('total_discount', 0)
            additional_charges = charges.get('additional_charges_total', 0)
            round_off = charges.get('round_off_amount', 0)
            
            # Calculate taxable_amount AFTER discount (correct GST calculation)
            taxable_amount = subtotal - total_discount
            
            # Split total_tax into CGST and SGST (assuming 50/50 split)
            cgst_amount = total_tax / 2
            sgst_amount = total_tax / 2
            
            # Calculate total amount
            total_amount = subtotal + total_tax - total_discount + additional_charges + round_off
            
            # For "credited" status, amount_received should equal total_amount
            status = data.get('status', 'Unpaid')
            if status and status.lower() == 'credited':
                amount_received = total_amount
                balance_amount = 0
            else:
                amount_received = 0
                balance_amount = total_amount
            
            # Build charges data for response
            charges_data = {
                "taxable_amount": taxable_amount,
                "cgst_amount": cgst_amount,
                "sgst_amount": sgst_amount,
                "total_tax": total_tax,
                "total_discount": total_discount,
                "subtotal": subtotal,
                "additional_charges_total": additional_charges,
                "round_off_amount": round_off
            }
            
            
        elif 'total_amount' in data:
            total_amount = data['total_amount']
            balance_amount = total_amount
        
        # Create debit note
        debit_note = DebitNote(
            debit_note_number=data['debit_note_number'],
            vendor_id=data['vendor_id'],
            business_id=business_id,
            invoice_id=invoice.uuid if invoice else None,
            invoice_number=invoice.invoice_number if invoice else None,
            debit_note_date=datetime.strptime(data['debit_note_date'], '%Y-%m-%d').date(),
            status=data.get('status', 'Unpaid'),
            total_amount=total_amount,
            amount_received=amount_received,
            balance_amount=balance_amount,
            created_by=user_id,
            updated_by=user_id
        )
        
        # Set charges if provided (use the calculated charges_data)
        if charges_data:
            debit_note.charges = charges_data
        elif 'charges' in data:
            debit_note.charges = data['charges']
        
        # Set additional notes if provided
        if 'additional_notes' in data:
            debit_note.additional_notes = data['additional_notes']
        
        db.session.add(debit_note)
        db.session.flush()  # Get the UUID without committing
        
        # Create items if provided
        if 'items' in data and data['items']:
            for item_data in data['items']:
                # Validate item exists
                item = Item.query.filter_by(
                    id=item_data['item_id'],
                    is_deleted=False
                ).first()
                
                if not item:
                    db.session.rollback()
                    return jsonify({
                        "success": False,
                        "message": f"Item not found: {item_data['item_id']}",
                        "status": 404
                    }), 404
                
                debit_note_item = DebitNoteItem(
                    debit_note_id=debit_note.uuid,
                    item_id=item_data['item_id'],
                    description=item_data.get('description'),
                    quantity=item_data['quantity'],
                    unit_price=item_data['unit_price'],
                    total_price=item_data['total_price'],
                    hsn_sac_code=item_data.get('hsn_sac_code'),
                    created_by=user_id,
                    updated_by=user_id
                )
                
                # Set discount and tax if provided
                if 'discount' in item_data:
                    debit_note_item.discount = item_data['discount']
                
                if 'tax' in item_data:
                    debit_note_item.tax = item_data['tax']
                
                db.session.add(debit_note_item)
        
        db.session.commit()
        
        # Update purchase invoice status using the helper function if debit note is linked to a purchase invoice
        if invoice and isinstance(invoice, PurchaseInvoice):
            try:
                # Store original payment_status in debit note before updating
                debit_note.original_invoice_payment_status = invoice.payment_status
                
                # Update purchase invoice balance to account for debit note
                # Calculate new balance: current balance - debit note total amount
                current_balance = float(invoice.balance_due or 0)
                new_balance = max(0.0, current_balance - float(debit_note.total_amount))
                
                
                # Update the invoice balance directly
                invoice.balance_due = new_balance
                
                # Update payment status based on new balance
                if new_balance <= 0:
                    invoice.payment_status = "paid"
                elif float(invoice.amount_paid) > 0:
                    invoice.payment_status = "partial"
                else:
                    invoice.payment_status = "unpaid"
                
                # Use the helper function to ensure consistency
                update_purchase_invoice_payment_status(invoice.uuid)
                
                # Force commit to ensure status updates are saved immediately
                db.session.commit()
                
                # Refresh invoice to get updated values
                db.session.refresh(invoice)
                
            except Exception as e:
                # Log error but don't fail the debit note creation
                pass
        
        # Calculate balance due using quantity-based logic
        balance_due = calculate_debit_note_balance_due(debit_note)
        
        # Prepare response data
        response_data = {
            "uuid": debit_note.uuid,
            "debit_note_number": debit_note.debit_note_number,
            "total_amount": float(debit_note.total_amount),
            "amount_received": float(debit_note.amount_received),
            "balance_amount": float(debit_note.balance_amount),
            "balance_due": float(balance_due),  # NEW: Quantity-based balance calculation
            "status": debit_note.status
        }
        
        # Include charges data if calculated
        if charges_data:
            response_data["charges"] = charges_data
        
        # Include updated invoice data if linked to purchase invoice
        if invoice and isinstance(invoice, PurchaseInvoice):
            response_data["invoice"] = {
                "uuid": str(invoice.uuid),
                "invoice_number": invoice.invoice_number,
                "balance_due": float(invoice.balance_due),
                "payment_status": invoice.payment_status,
                "amount_paid": float(invoice.amount_paid),
                "total_amount": float(invoice.total_amount)
            }
        
        # Return flat response structure to match purchase invoice API
        
        return jsonify(response_data), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating debit note: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to create debit note",
            "status": 500
        }), 500


@debit_note_blueprint.route('/available-purchase-invoices', methods=['GET'])
@login_required
@jwt_required()
def get_available_purchase_invoices():
    """Get purchase invoices that don't have existing debit notes"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
        else:
            business_id = jwt_claims.get('business_id', 1)
        
        # Get subquery for invoice IDs that have debit notes
        invoices_with_debit_notes = db.session.query(DebitNote.invoice_id).filter(
            DebitNote.business_id == business_id,
            DebitNote.is_deleted == False,
            DebitNote.invoice_id.isnot(None)
        ).subquery()
        
        # Get purchase invoices that DON'T have debit notes
        available_invoices = PurchaseInvoice.query.filter(
            PurchaseInvoice.business_id == business_id,
            PurchaseInvoice.is_deleted == False,
            ~PurchaseInvoice.uuid.in_(invoices_with_debit_notes)
        ).order_by(PurchaseInvoice.invoice_date.desc()).all()
        
        # Serialize data
        invoices = []
        for invoice in available_invoices:
            invoices.append({
                "uuid": invoice.uuid,
                "invoice_number": invoice.invoice_number,
                "invoice_date": invoice.invoice_date.isoformat(),
                "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
                "total_amount": float(invoice.total_amount),
                "balance_due": float(invoice.balance_due),
                "payment_status": invoice.payment_status,
                "vendor_id": invoice.vendor_id,
                "vendor_name": invoice.vendor.company_name if invoice.vendor else ""
            })
        
        return jsonify({
            "success": True,
            "data": invoices,
            "status": 200
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting available purchase invoices: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get available purchase invoices",
            "status": 500
        }), 500


@debit_note_blueprint.route('/', methods=['GET'])
@login_required
@jwt_required()
def get_debit_notes():
    """List all debit notes with pagination and filtering"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
        else:
            business_id = jwt_claims.get('business_id', 1)
        
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        search = request.args.get('search', '', type=str)
        vendor_id = request.args.get('vendor_id', '', type=str)
        customer_id = request.args.get('customer_id', '', type=str)  # For backward compatibility
        invoice_id = request.args.get('invoice_id', '', type=str)  # Add invoice_id parameter
        status = request.args.get('status', '', type=str)
        date_from = request.args.get('date_from', '', type=str)
        date_to = request.args.get('date_to', '', type=str)
        
        
        # Handle both customer_id and vendor_id for backward compatibility
        if customer_id and not vendor_id:
            vendor_id = customer_id
        
        # Build query
        query = DebitNote.query.filter_by(
            business_id=business_id,
            is_deleted=False
        )
        
        # Apply filters
        if search:
            query = query.filter(
                or_(
                    DebitNote.debit_note_number.ilike(f'%{search}%'),
                    DebitNote.vendor.has(Vendor.company_name.ilike(f'%{search}%')),
                    DebitNote.vendor.has(Vendor.vendor_name.ilike(f'%{search}%')),
                    DebitNote.invoice_number.ilike(f'%{search}%')  # Keep invoice_number for search
                )
            )
        
        # Handle invoice_id specific filter
        if invoice_id:
            query = query.filter(
                or_(
                    DebitNote.invoice_id == invoice_id,
                    DebitNote.invoice_number == invoice_id
                )
            )
        
        # Handle vendor_id
        if vendor_id:
            query = query.filter(DebitNote.vendor_id == vendor_id)
        
        if status:
            query = query.filter(DebitNote.status == status)
        
        if date_from:
            query = query.filter(DebitNote.debit_note_date >= datetime.strptime(date_from, '%Y-%m-%d').date())
        
        if date_to:
            query = query.filter(DebitNote.debit_note_date <= datetime.strptime(date_to, '%Y-%m-%d').date())
        
        # Order by date descending
        query = query.order_by(DebitNote.debit_note_date.desc())
        
        # Paginate
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Serialize data
        debit_notes = []
        for dn in pagination.items:
            # Debug UUID values
            
            debit_notes.append({
                "uuid": dn.uuid,
                "debit_note_number": dn.debit_note_number,
                "vendor_id": dn.vendor_id,
                "vendor_name": dn.vendor.company_name if dn.vendor else "",
                "vendor_address": {
                    "address1": dn.vendor.address1 if dn.vendor else "",
                    "address2": dn.vendor.address2 if dn.vendor else "",
                    "city": dn.vendor.city if dn.vendor else "",
                    "state": dn.vendor.state if dn.vendor else "",
                    "country": dn.vendor.country if dn.vendor else "",
                    "pin": dn.vendor.pin if dn.vendor else ""
                } if dn.vendor else {},
                "invoice_id": dn.invoice_id,
                "invoice_number": dn.invoice_number,
                "debit_note_date": dn.debit_note_date.isoformat(),
                "status": dn.status,
                "total_amount": float(dn.total_amount),
                "amount_received": float(dn.amount_received),
                "balance_amount": float(dn.balance_amount),
                "created_at": dn.created_at.isoformat()
            })
        
        # Debug final response
        
        return jsonify({
            "success": True,
            "data": {
                "debit_notes": debit_notes,
                "pagination": {
                    "current_page": pagination.page,
                    "per_page": pagination.per_page,
                    "total": pagination.total,
                    "last_page": pagination.pages
                }
            },
            "status": 200
        }), 200
        
    except Exception as e:
        import traceback
        current_app.logger.error(f"Error getting debit notes: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get debit notes",
            "status": 500
        }), 500


@debit_note_blueprint.route('/<debit_note_id>', methods=['GET'])
@login_required
@jwt_required()
def get_debit_note(debit_note_id):
    """Get a specific debit note by ID"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
        else:
            business_id = jwt_claims.get('business_id', 1)
        
        debit_note = DebitNote.query.options(
            joinedload(DebitNote.items)
        ).filter_by(
            uuid=debit_note_id,
            business_id=business_id,
            is_deleted=False
        ).first()
        
        if not debit_note:
            return jsonify({"error": "Debit note not found"}), 404
        
        
        
        # Get vendor using the same approach as purchase_invoice.py
        v = debit_note.vendor
        
        if v:
            pass
        else:
            pass
        
        # Get items
        items = []
        for item in debit_note.items:
            items.append({
                "uuid": item.uuid,
                "item_id": item.item_id,
                "item_name": item.item.item_name if item.item else "",
                "description": item.description,
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "discount": item.discount,
                "tax": item.tax,
                "total_price": float(item.total_price),
                "hsn_sac_code": item.hsn_sac_code
            })
        
        # Get payments
        payments = []
        for payment in debit_note.payments:
            if not payment.is_deleted:
                payments.append({
                    "uuid": payment.uuid,
                    "payment_amount": float(payment.payment_amount),
                    "payment_date": payment.payment_date.isoformat(),
                    "payment_method": payment.payment_method,
                    "payment_reference": payment.payment_reference,
                    "payment_notes": payment.payment_notes,
                    "status": payment.status,
                    "created_at": payment.created_at.isoformat()
                })
        
        # Calculate balance due using quantity-based logic
        
        debit_note_data = {
            "uuid": debit_note.uuid,
            "debit_note_number": debit_note.debit_note_number,
            "vendor_id": debit_note.vendor_id,
            "vendor_name": v.company_name if v else "",
            "vendor": {
                "uuid": str(v.uuid),
                "vendor_name": v.vendor_name,
                "company_name": v.company_name,
                "mobile": v.mobile,
                "email": v.email,
                "gst": v.gst,
                "address1": v.address1,
                "address2": v.address2,
                "city": v.city,
                "state": v.state,
                "country": v.country,
                "pin": v.pin,
            } if v else None,
            "invoice_id": debit_note.invoice_id,
            "invoice_number": debit_note.invoice_number,
            "debit_note_date": debit_note.debit_note_date.isoformat(),
            "status": debit_note.status,
            "total_amount": float(debit_note.total_amount),
            "amount_received": float(debit_note.amount_received),
            "balance_amount": float(debit_note.balance_amount),  # Use database balance_amount
            "balance_due": float(balance_due),  # Use calculated balance_due
            "charges": debit_note.charges,       
            "mark_as_fully_paid": debit_note.mark_as_fully_paid,
            "auto_round_off": debit_note.auto_round_off,
            "additional_notes": debit_note.additional_notes,
            "created_at": debit_note.created_at.isoformat(),
            "updated_at": debit_note.updated_at.isoformat()
        }
        
        
        # Debug response structure
        
        # Flatten response structure to match purchase invoice API
        response_data = debit_note_data.copy()
        response_data["items"] = items
        response_data["payments"] = payments
        
        
        return jsonify(response_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting debit note: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get debit note",
            "status": 500
        }), 500


@debit_note_blueprint.route('/<debit_note_id>', methods=['PUT'])
@login_required
@jwt_required()
def update_debit_note(debit_note_id):
    """Update an existing debit note"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            user_id = jwt_claims
            business_id = 1  # Default fallback
        else:
            user_id = jwt_claims.get('sub') or jwt_claims.get('user_id')
            business_id = jwt_claims.get('business_id', 1)
        data = request.get_json()
        
        debit_note = DebitNote.query.filter_by(
            uuid=debit_note_id,
            business_id=business_id,
            is_deleted=False
        ).first()
        
        if not debit_note:
            return jsonify({
                "success": False,
                "message": "Debit note not found",
                "status": 404
            }), 404
        
        # Update allowed fields
        if 'customer_id' in data:
            debit_note.vendor_id = data['customer_id']
        elif 'vendor_id' in data:
            debit_note.vendor_id = data['vendor_id']
        
        if 'invoice_id' in data:
            if data['invoice_id']:
                # Check if invoice_id looks like a UUID (has dashes and proper format)
                invoice_id_str = str(data['invoice_id'])
                invoice = None
                
                if '-' in invoice_id_str and len(invoice_id_str) == 36:
                    # Try to find by UUID first in both tables
                    invoice = Invoice.query.filter_by(
                        uuid=data['invoice_id'],
                        is_deleted=False
                    ).first()
                    
                    if not invoice:
                        # Try PurchaseInvoice table
                        invoice = PurchaseInvoice.query.filter_by(
                            uuid=data['invoice_id'],
                            is_deleted=False
                        ).first()
                
                if not invoice:
                    # Try by invoice number in both tables
                    invoice = Invoice.query.filter_by(
                        invoice_number=data['invoice_id'],
                        is_deleted=False
                    ).first()
                    
                    if not invoice:
                        # Try PurchaseInvoice table
                        invoice = PurchaseInvoice.query.filter_by(
                            invoice_number=data['invoice_id'],
                            is_deleted=False
                        ).first()
                
                if invoice:
                    debit_note.invoice_id = invoice.uuid
                    debit_note.invoice_number = invoice.invoice_number
                else:
                    return jsonify({
                        "success": False,
                        "message": "Invoice not found",
                        "status": 404
                    }), 404
            else:
                debit_note.invoice_id = None
                debit_note.invoice_number = None
        
        if 'debit_note_date' in data:
            debit_note.debit_note_date = datetime.strptime(data['debit_note_date'], '%Y-%m-%d').date()
        
        if 'status' in data:
            debit_note.status = data['status']
        
        if 'total_amount' in data:
            debit_note.total_amount = data['total_amount']
        
        if 'charges' in data:
            debit_note.charges = data['charges']
        
        if 'additional_notes' in data:
            debit_note.additional_notes = data['additional_notes']
        
        debit_note.updated_by = user_id
        
        # Update items if provided
        if 'items' in data and data['items']:
            # Delete existing items
            DebitNoteItem.query.filter_by(debit_note_id=debit_note.uuid).delete()
            
            # Create new items
            for item_data in data['items']:
                debit_note_item = DebitNoteItem(
                    debit_note_id=debit_note.uuid,
                    item_id=item_data['item_id'],
                    description=item_data.get('description'),
                    quantity=item_data['quantity'],
                    unit_price=item_data['unit_price'],
                    total_price=item_data['total_price'],
                    hsn_sac_code=item_data.get('hsn_sac_code'),
                    created_by=user_id,
                    updated_by=user_id
                )
                
                if 'discount' in item_data:
                    debit_note_item.discount = item_data['discount']
                
                if 'tax' in item_data:
                    debit_note_item.tax = item_data['tax']
                
                db.session.add(debit_note_item)
        
        db.session.commit()
        
        # Update purchase invoice status using the helper function if debit note is linked to a purchase invoice
        if debit_note.invoice_id:
            try:
                # Use the helper function to update purchase invoice payment status
                update_purchase_invoice_payment_status(debit_note.invoice_id)
            except Exception as e:
                # Log error but don't fail the debit note update
                pass
        
        return jsonify({
            "success": True,
            "message": "Debit note updated successfully",
            "status": 200
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating debit note: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to update debit note",
            "status": 500
        }), 500


@debit_note_blueprint.route('/check-invoice/<invoice_id>', methods=['GET'])
@login_required
@jwt_required()
def check_invoice_debit_notes(invoice_id):
    """Check if debit notes already exist for a given invoice"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
        else:
            business_id = jwt_claims.get('business_id', 1)
        
        # Check if invoice exists (both types)
        invoice = None
        invoice = Invoice.query.filter_by(
            uuid=invoice_id,
            business_id=business_id,
            is_deleted=False
        ).first()
        
        if not invoice:
            # Try PurchaseInvoice
            invoice = PurchaseInvoice.query.filter_by(
                uuid=invoice_id,
                business_id=business_id,
                is_deleted=False
            ).first()
        
        if not invoice:
            return jsonify({
                "success": False,
                "message": "Invoice not found",
                "status": 404
            }), 404
        
        # Get debit notes for this invoice
        debit_notes = DebitNote.query.filter_by(
            invoice_id=invoice_id,
            business_id=business_id,
            is_deleted=False
        ).all()
        
        debit_notes_data = []
        for dn in debit_notes:
            debit_notes_data.append({
                "uuid": dn.uuid,
                "debit_note_number": dn.debit_note_number,
                "debit_note_date": dn.debit_note_date.isoformat(),
                "status": dn.status,
                "total_amount": float(dn.total_amount)
            })
        
        return jsonify({
            "success": True,
            "data": {
                "has_debit_note": len(debit_notes_data) > 0,
                "debit_notes": debit_notes_data
            },
            "status": 200
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error checking invoice debit notes: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to check invoice debit notes",
            "status": 500
        }), 500


@debit_note_blueprint.route('/<debit_note_id>', methods=['DELETE'])
@login_required
@jwt_required()
def delete_debit_note(debit_note_id):
    """Delete a debit note (soft delete)"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
            user_id = jwt_claims
        else:
            business_id = jwt_claims.get('business_id', 1)
            user_id = jwt_claims.get('sub') or jwt_claims.get('user_id')
        
        debit_note = DebitNote.query.filter_by(
            uuid=debit_note_id,
            business_id=business_id,
            is_deleted=False
        ).first()
        
        if not debit_note:
            return jsonify({
                "success": False,
                "message": "Debit note not found",
                "status": 404
            }), 404
        
        debit_note.is_deleted = True
        debit_note.updated_by = user_id
        
        # Store the invoice_id before committing for status update
        linked_invoice_id = debit_note.invoice_id
        
        db.session.commit()
        
        # Update purchase invoice status using helper function if debit note was linked to a purchase invoice
        if linked_invoice_id:
            try:
                # Use the helper function to recalculate purchase invoice payment status
                # This will automatically handle the case where no debit notes remain
                update_purchase_invoice_payment_status(linked_invoice_id)
            except Exception as e:
                # Log error but don't fail the debit note deletion
                pass
        
        return jsonify({
            "success": True,
            "message": "Debit note deleted successfully",
            "status": 200
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting debit note: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to delete debit note",
            "status": 500
        }), 500


@debit_note_blueprint.route('/statistics', methods=['GET'])
@login_required
@jwt_required()
def get_debit_note_statistics():
    """Get debit note statistics for dashboard"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
        else:
            business_id = jwt_claims.get('business_id', 1)
        
        # Get counts by status
        status_counts = db.session.query(
            DebitNote.status,
            func.count(DebitNote.uuid).label('count')
        ).filter_by(
            business_id=business_id,
            is_deleted=False
        ).group_by(DebitNote.status).all()
        
        status_dict = {status: count for status, count in status_counts}
        
        # Get total amounts
        total_amount = db.session.query(
            func.sum(DebitNote.total_amount)
        ).filter_by(
            business_id=business_id,
            is_deleted=False
        ).scalar() or 0
        
        # Get this month's data
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        this_month_count = db.session.query(
            func.count(DebitNote.uuid)
        ).filter(
            and_(
                DebitNote.business_id == business_id,
                DebitNote.is_deleted == False,
                func.extract('month', DebitNote.debit_note_date) == current_month,
                func.extract('year', DebitNote.debit_note_date) == current_year
            )
        ).scalar() or 0
        
        this_month_amount = db.session.query(
            func.sum(DebitNote.total_amount)
        ).filter(
            and_(
                DebitNote.business_id == business_id,
                DebitNote.is_deleted == False,
                func.extract('month', DebitNote.debit_note_date) == current_month,
                func.extract('year', DebitNote.debit_note_date) == current_year
            )
        ).scalar() or 0
        
        statistics = {
            "total_debit_notes": status_dict.get('Unpaid', 0) + status_dict.get('Credited', 0),
            "unpaid_count": status_dict.get('Unpaid', 0),
            "credited_count": status_dict.get('Credited', 0),
            "total_amount": float(total_amount),
            "this_month_count": this_month_count,
            "this_month_amount": float(this_month_amount)
        }
        
        return jsonify({
            "success": True,
            "data": statistics,
            "status": 200
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting debit note statistics: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get debit note statistics",
            "status": 500
        }), 500


@debit_note_blueprint.route('/<debit_note_id>/payments', methods=['POST'])
@login_required
@jwt_required()
def create_debit_note_payment(debit_note_id):
    """Record a payment for a debit note"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
            user_id = jwt_claims
        else:
            business_id = jwt_claims.get('business_id', 1)
            user_id = jwt_claims.get('sub') or jwt_claims.get('user_id')
        data = request.get_json()
        
        # Validate debit note exists
        debit_note = DebitNote.query.filter_by(
            uuid=debit_note_id,
            business_id=business_id,
            is_deleted=False
        ).first()
        
        if not debit_note:
            return jsonify({
                "success": False,
                "message": "Debit note not found",
                "status": 404
            }), 404
        
        # Validate required fields
        required_fields = ['payment_amount', 'payment_date']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "message": f"Missing required field: {field}",
                    "status": 400
                }), 400
        
        # Create payment
        payment = DebitNotePayment(
            debit_note_id=debit_note.uuid,
            payment_amount=data['payment_amount'],
            payment_date=datetime.strptime(data['payment_date'], '%Y-%m-%d').date(),
            payment_method=data.get('payment_method', 'cash'),
            payment_reference=data.get('payment_reference'),
            payment_notes=data.get('payment_notes'),
            status='completed',
            created_by=user_id,
            updated_by=user_id
        )
        
        db.session.add(payment)
        
        # Update debit note amounts
        debit_note.amount_received += data['payment_amount']
        debit_note.balance_amount = debit_note.total_amount - debit_note.amount_received
        
        # Check if fully paid using calculated balance due
        calculated_balance_due = calculate_debit_note_balance_due(debit_note)
        if calculated_balance_due <= 0:
            debit_note.status = 'Credited'
            debit_note.mark_as_fully_paid = True
            debit_note.balance_amount = 0
        else:
            # Update balance_amount to reflect the calculated remaining balance
            debit_note.balance_amount = calculated_balance_due
        
        debit_note.updated_by = user_id
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Payment recorded successfully",
            "status": 201
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating debit note payment: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to record payment",
            "status": 500
        }), 500


@debit_note_blueprint.route('/<debit_note_id>/payments', methods=['GET'])
@login_required
@jwt_required()
def get_debit_note_payments(debit_note_id):
    """Get payment history for a debit note"""
    try:
        # Get JWT claims
        jwt_claims = get_jwt()
        
        # Handle different JWT token formats
        if isinstance(jwt_claims, str):
            business_id = 1  # Default fallback
        else:
            business_id = jwt_claims.get('business_id', 1)
        
        # Validate debit note exists
        debit_note = DebitNote.query.filter_by(
            uuid=debit_note_id,
            business_id=business_id,
            is_deleted=False
        ).first()
        
        if not debit_note:
            return jsonify({
                "success": False,
                "message": "Debit note not found",
                "status": 404
            }), 404
        
        # Get payments
        payments = []
        for payment in debit_note.payments:
            if not payment.is_deleted:
                payments.append({
                    "uuid": payment.uuid,
                    "payment_amount": float(payment.payment_amount),
                    "payment_date": payment.payment_date.isoformat(),
                    "payment_method": payment.payment_method,
                    "payment_reference": payment.payment_reference,
                    "payment_notes": payment.payment_notes,
                    "status": payment.status,
                    "created_at": payment.created_at.isoformat()
                })
        
        return jsonify({
            "success": True,
            "data": payments,
            "status": 200
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting debit note payments: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Failed to get payments",
            "status": 500
        }), 500
