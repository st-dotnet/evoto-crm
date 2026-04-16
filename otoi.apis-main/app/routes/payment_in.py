from datetime import datetime, date
from flask import Blueprint, request, jsonify, g
from sqlalchemy import or_, desc, asc
from app.extensions import db
from app.models.paymentIn import PaymentIn
from app.models.invoice import Invoice
from app.models.customer import Customer

payment_in_blueprint = Blueprint("payment_in", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_payment_in_number() -> str:
    """Generate a unique payment-in number like PIN-1001."""
    last = PaymentIn.query.order_by(PaymentIn.created_at.desc()).first()
    if last and last.payment_number:
        try:
            last_num = int(last.payment_number.split("-")[1])
            return f"PIN-{last_num + 1}"
        except (IndexError, ValueError):
            pass
    return "PIN-1001"


def _date_filter_query(query, model, date_filter: str):
    """Apply common date filters to a query."""
    today = date.today()
    if date_filter == "today":
        query = query.filter(model.payment_date == today)

    elif date_filter == "this_week":
        start = today - __import__("datetime").timedelta(days=today.weekday())
        query = query.filter(model.payment_date >= start, model.payment_date <= today)

    elif date_filter == "last_week":
        import datetime as _dt
        start = today - _dt.timedelta(days=today.weekday() + 7)
        end   = start + _dt.timedelta(days=6)
        query = query.filter(model.payment_date >= start, model.payment_date <= end)

    elif date_filter == "this_month":
        query = query.filter(
            db.extract("month", model.payment_date) == today.month,
            db.extract("year",  model.payment_date) == today.year,
        )
    elif date_filter == "last_month":
        if today.month == 1:
            m, y = 12, today.year - 1
        else:
            m, y = today.month - 1, today.year
        query = query.filter(
            db.extract("month", model.payment_date) == m,
            db.extract("year",  model.payment_date) == y,
        )
    elif date_filter == "last_365_days":
        import datetime as _dt
        query = query.filter(model.payment_date >= today - _dt.timedelta(days=365))
    return query


# ── LIST ──────────────────────────────────────────────────────────────────────

@payment_in_blueprint.route("/", methods=["GET"])
def list_payment_ins():
    """
    List payment-in records with pagination, search, and date filters.
    ---
    tags:
     - Payment In
    parameters:
      - name: page
        in: query
        type: integer
      - name: per_page
        in: query
        type: integer
      - name: party_name
        in: query
        type: string
      - name: payment_number
        in: query
        type: string
      - name: payment_status
        in: query
        type: string
      - name: date_filter
        in: query
        type: string
    responses:
      200:
        description: Paginated list of payment-in records
    """
    try:
        page     = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 10))
        party_name     = request.args.get("party_name", "").strip()
        payment_number = request.args.get("payment_number", "").strip()
        payment_status = request.args.get("payment_status", "").strip()
        date_filter    = request.args.get("date_filter", "").strip()

        # Dropdown shortcuts
        if request.args.get("party_names_dropdown") == "true":
            business_id = getattr(g, "business_id", None)
            names = (
                db.session.query(PaymentIn.party_name)
                .filter(PaymentIn.business_id == business_id, PaymentIn.is_deleted == False)
                .distinct()
                .order_by(PaymentIn.party_name)
                .all()
            )
            return jsonify([n[0] for n in names if n[0]]), 200

        if request.args.get("payment_numbers_dropdown") == "true":
            business_id = getattr(g, "business_id", None)
            numbers = (
                db.session.query(PaymentIn.payment_number)
                .filter(PaymentIn.business_id == business_id, PaymentIn.is_deleted == False)
                .distinct()
                .order_by(PaymentIn.payment_number)
                .all()
            )
            return jsonify([n[0] for n in numbers if n[0]]), 200

        business_id = getattr(g, "business_id", None)
        query = (
            PaymentIn.query
            .outerjoin(Invoice, PaymentIn.invoice_id == Invoice.uuid)
            .filter(
                PaymentIn.business_id == business_id,
                PaymentIn.is_deleted == False,
            )
        )

        if party_name:
            query = query.filter(PaymentIn.party_name.ilike(f"%{party_name}%"))
        if payment_number:
            query = query.filter(PaymentIn.payment_number.ilike(f"%{payment_number}%"))

        # Filter based on CURRENT invoice status
        if payment_status and payment_status != "all":
            query = query.filter(Invoice.payment_status == payment_status)

        if date_filter and date_filter != "all":
            query = _date_filter_query(query, PaymentIn, date_filter)

        query = query.order_by(desc(PaymentIn.payment_date), desc(PaymentIn.created_at))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        result = []
        for p in pagination.items:
            # Use current invoice status from relationship if available
            current_status = p.invoice.payment_status if p.invoice else p.payment_status

            result.append({
                "id":             str(p.uuid),
                "payment_number": p.payment_number,
                "date":           p.payment_date.isoformat() if p.payment_date else None,
                "party_name":     p.party_name,
                "invoice_number": p.invoice_number,
                "total_amount":   float(p.total_amount) if p.total_amount else 0,
                "total_amount_settled": float(p.total_amount) if p.total_amount else 0,
                "amount_paid":    float(p.amount_received) if p.amount_received else 0,
                "amount_received": float(p.amount_received) if p.amount_received else 0,
                "balance_due":    float(p.balance_due) if p.balance_due else 0,
                "payment_discount": float(p.discount) if p.discount else 0,
                "payment_mode":   p.payment_mode,
                "payment_status": current_status,
                "payment_notes":  p.payment_notes,
                "invoice_id":     str(p.invoice_id),
                "created_at":     p.created_at.isoformat() if p.created_at else None,
            })

        return jsonify({
            "data": result,
            "pagination": {
                "total":        pagination.total,
                "per_page":     per_page,
                "current_page": page,
                "last_page":    pagination.pages,
                "from":         (page - 1) * per_page + 1 if pagination.total > 0 else 0,
                "to":           min(page * per_page, pagination.total),
            },
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to fetch payment-in records", "details": str(e)}), 500


# ── CREATE ────────────────────────────────────────────────────────────────────

@payment_in_blueprint.route("/", methods=["POST"])
def create_payment_in():
    """
    Create a new payment-in record manually.
    ---
    tags:
      - Payment In
    responses:
      201:
        description: Payment-in created
    """
    data = request.get_json() or {}
    try:
        payment_number = data.get("payment_number") or generate_payment_in_number()
        business_id = data.get("business_id") or getattr(g, "business_id", None)

        pi = PaymentIn(
            payment_number      = payment_number,
            payment_date        = data.get("payment_date") or data.get("date", date.today().isoformat()),
            invoice_id          = data["invoice_id"],
            party_name          = data.get("party_name", ""),
            invoice_number      = data.get("invoice_number", ""),
            total_amount        = data.get("total_amount") or data.get("total_amount_settled", 0),
            amount_received     = data.get("amount_received", 0),
            balance_due         = data.get("balance_due", 0),
            discount            = data.get("discount", 0),
            payment_status      = data.get("payment_status", "paid"),
            payment_mode        = data.get("payment_mode", "cash"),
            payment_notes       = data.get("payment_notes", ""),
            business_id         = business_id,
            created_by          = getattr(g, "current_user_id", None),
        )
        db.session.add(pi)
        db.session.commit()

        return jsonify({
            "message": "Payment-in created successfully",
            "uuid": str(pi.uuid),
            "payment_number": pi.payment_number,
        }), 201

    except KeyError as e:
        db.session.rollback()
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create payment-in", "details": str(e)}), 500


# ── GET ONE ───────────────────────────────────────────────────────────────────

@payment_in_blueprint.route("/<uuid:payment_id>", methods=["GET"])
def get_payment_in(payment_id):
    """Get a single payment-in record."""
    try:
        p = PaymentIn.query.filter_by(uuid=payment_id, is_deleted=False).first_or_404()
        return jsonify({
            "id":             str(p.uuid),
            "payment_number": p.payment_number,
            "date":           p.payment_date.isoformat() if p.payment_date else None,
            "party_name":     p.party_name,
            "invoice_number": p.invoice_number,
            "total_amount":   float(p.total_amount),
            "amount_received": float(p.amount_received),
            "balance_due":    float(p.balance_due),
            "discount":       float(p.discount or 0),
            "payment_mode":   p.payment_mode,
            "payment_status": p.payment_status,
            "payment_notes":  p.payment_notes,
            "invoice_id":     str(p.invoice_id),
            "business_id":    p.business_id,
            "created_at":     p.created_at.isoformat() if p.created_at else None,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── UPDATE ────────────────────────────────────────────────────────────────────

@payment_in_blueprint.route("/<uuid:payment_id>", methods=["PUT"])
def update_payment_in(payment_id):
    """
    Update an existing payment-in record (notes, mode, etc.).
    """
    p = PaymentIn.query.filter_by(uuid=payment_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}
    try:
        if "payment_notes" in data:
            p.payment_notes = data["payment_notes"]
        if "payment_mode" in data:
            p.payment_mode = data["payment_mode"]
        if "payment_date" in data:
            try:
                p.payment_date = datetime.strptime(data["payment_date"][:10], "%Y-%m-%d").date()
            except:
                pass

        db.session.commit()
        return jsonify({"message": "Payment-in updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── DELETE ────────────────────────────────────────────────────────────────────

@payment_in_blueprint.route("/<uuid:payment_id>", methods=["DELETE"])
def delete_payment_in(payment_id):
    """
    Delete a payment-in record and revert financials on the associated invoice.
    """
    try:
        p = PaymentIn.query.filter_by(uuid=payment_id).first()

        if not p:
            return jsonify({"error": "Payment not found"}), 404

        invoice = p.invoice

        if invoice:
            # Revert financial totals
            amt = float(p.amount_received or 0)
            dsc = float(p.discount or 0)

            curr_paid = float(invoice.amount_paid or 0)
            curr_due  = float(invoice.balance_due or 0)

            invoice.amount_paid = round(curr_paid - amt, 2)
            invoice.balance_due = round(curr_due + amt + dsc, 2)

            # Update status
            if float(invoice.amount_paid) <= 0.01:
                invoice.payment_status = "unpaid"
                invoice.amount_paid = 0
            else:
                invoice.payment_status = "partial"

        # Hard delete the payment record
        db.session.delete(p)
        db.session.commit()
        return jsonify({"message": "Payment-in deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": "Failed to delete payment", "details": str(e)}), 500


# ── CUSTOMER INVOICES ─────────────────────────────────────────────────────────

@payment_in_blueprint.route("/customer-invoices", methods=["GET"])
def get_customer_invoices():
    """
    Get invoices for a specific customer that have a pending balance.
    Used to populate the invoice selection in Create Payment In.
    ---
    tags:
      - Payment In
    parameters:
      - name: customer_name
        in: query
        required: false
        type: string
      - name: per_page
        in: query
        type: integer
    responses:
      200:
        description: List of invoices
    """
    try:
        customer_name = request.args.get("customer_name", "").strip()
        per_page      = int(request.args.get("per_page", 1000))
        business_id   = getattr(g, "business_id", None)

        query = (
            Invoice.query
            .filter(
                Invoice.is_deleted == False,
                Invoice.business_id == business_id,
            )
            .outerjoin(Customer, Invoice.customer_id == Customer.uuid)
        )

        if customer_name:
            query = query.filter(
                or_(
                    Customer.first_name.ilike(f"%{customer_name}%"),
                    Customer.last_name.ilike(f"%{customer_name}%"),
                )
            )

        invoices = query.limit(per_page).all()

        results = []
        for inv in invoices:
            c = inv.customer
            cname = ""
            if c:
                cname = f"{c.first_name or ''} {c.last_name or ''}".strip()

            amt_paid = float(inv.amount_paid or 0)
            total = float(inv.total_amount or 0)
            payment_discount = float(inv.payment_discount or 0)

            # Calculate correct balance including discount
            from app.models.creditIn import CreditNote
            credit_notes = CreditNote.query.filter_by(
                invoice_id=inv.uuid,
                is_deleted=False
            ).all()
            total_credit_amount = sum(float(cn.total_amount) for cn in credit_notes)

            balance = max(0.0, total - amt_paid - payment_discount - total_credit_amount)
            status = "unpaid"
            if balance <= 0 and amt_paid > 0:
                status = "paid"
            elif amt_paid > 0:
                status = "partial"

            results.append({
                "id":             str(inv.uuid),
                "invoice_number": inv.invoice_number,
                "date":           inv.invoice_date.isoformat() if inv.invoice_date else None,
                "due_date":       inv.due_date.isoformat() if inv.due_date else None,
                "customer_name":  cname,
                "invoice_amount": total,
                "amount_paid":    amt_paid,
                "balance_amount": balance,
                "balance_due":    balance,
                "discount":       payment_discount,
                "applied_credit_note": total_credit_amount,
                "payment_status": status,
                "status":         status,
            })

        return jsonify(results), 200

    except Exception as e:
        return jsonify({"error": "Failed to fetch customer invoices", "details": str(e)}), 500
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from app.extensions import db
from app.models import PaymentIn, Invoice
from app.utils.stamping import set_updated_fields
from app.utils.decorators import login_required

payment_in_blueprint = Blueprint("payment_in", __name__)

@payment_in_blueprint.route("/<uuid:payment_id>", methods=["DELETE"])
@login_required
def delete_payment(payment_id):
    """
    Delete a payment record and update invoice payment status
    ---
    tags:
      - Payment In
    parameters:
      - name: payment_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Payment deleted successfully
      404:
        description: Payment not found
      400:
        description: Cannot delete payment
    """
    print(f"PAYMENT-IN DELETION ROUTE CALLED - Payment ID: {payment_id}")
    try:
        # Debug: Check if payment exists
        payment = PaymentIn.query.filter_by(uuid=payment_id, is_deleted=False).first()
        print(f"PAYMENT-IN SEARCH RESULT: {payment}")
        
        # Debug: Check all payments
        all_payments = PaymentIn.query.all()
        print(f"ALL PAYMENTS IN DB: {[{'uuid': str(p.uuid), 'is_deleted': p.is_deleted} for p in all_payments]}")
        
        if not payment:
            print("PAYMENT-IN NOT FOUND - Returning 404")
            return jsonify({"error": "Payment not found"}), 404
        
        # Get the associated invoice
        invoice = Invoice.query.filter_by(uuid=payment.invoice_id).first()
        if not invoice:
            return jsonify({"error": "Associated invoice not found"}), 404
        
        # Store payment amount before deletion
        payment_amount = float(payment.amount_received)
        
        # Soft delete payment
        payment.is_deleted = True
        set_updated_fields(payment)
        
        # Update invoice payment status
        old_amount_paid = float(invoice.amount_paid)
        old_balance_due = float(invoice.balance_due)
        old_payment_status = invoice.payment_status
        
        invoice.amount_paid = max(0, float(invoice.amount_paid) - payment_amount)
        
        # Recalculate payment_discount from remaining (non-deleted) payments
        remaining_payments = PaymentIn.query.filter_by(invoice_id=invoice.uuid, is_deleted=False).all()
        total_discount = sum(float(p.discount or 0) for p in remaining_payments)
        invoice.payment_discount = total_discount
        
        print(f"PAYMENT-IN DELETION - Remaining payments count: {len(remaining_payments)}")
        print(f"PAYMENT-IN DELETION - Recalculated total_discount: {total_discount}")
        print(f"PAYMENT-IN DELETION - Invoice payment_discount updated to: {invoice.payment_discount}")
        
        invoice.balance_due = float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount or 0)
        
        # Update payment status based on remaining balance
        if invoice.balance_due <= 0:
            invoice.payment_status = "paid"
        elif invoice.amount_paid > 0:
            invoice.payment_status = "partial"
        else:
            invoice.payment_status = "unpaid"
            
        # Debug logging
        print(f"PAYMENT-IN DELETION - Invoice UUID: {invoice.uuid}")
        print(f"PAYMENT-IN DELETION - Old amount_paid: {old_amount_paid}, New amount_paid: {invoice.amount_paid}")
        print(f"PAYMENT-IN DELETION - Old balance_due: {old_balance_due}, New balance_due: {invoice.balance_due}")
        print(f"PAYMENT-IN DELETION - Old payment_status: {old_payment_status}, New payment_status: {invoice.payment_status}")
        
        set_updated_fields(invoice)
        db.session.commit()
        
        return jsonify({
            "message": "Payment deleted successfully",
            "invoice_payment_status": invoice.payment_status,
            "amount_paid": float(invoice.amount_paid),
            "balance_due": float(invoice.balance_due)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"PAYMENT-IN DELETION ERROR: {str(e)}")
        return jsonify({"error": "Failed to delete payment", "details": str(e)}), 500

@payment_in_blueprint.route("/test-create", methods=["POST"])
def test_create_payment():
    """Create a test payment record for testing"""
    try:
        from app.models.invoice import Invoice
        from datetime import datetime
        
        # Find an invoice to link to
        invoice = Invoice.query.filter_by(is_deleted=False).first()
        if not invoice:
            return jsonify({"error": "No invoices found to create test payment"}), 404
        
        # Generate payment number
        payment_count = PaymentIn.query.filter_by(invoice_id=str(invoice.uuid)).count()
        payment_number = f"PAY-{invoice.invoice_number}-{payment_count + 1}"
        
        # Create test payment
        payment_in = PaymentIn(
            payment_number=payment_number,
            payment_date=datetime.now().strftime("%Y-%m-%d"),
            invoice_id=str(invoice.uuid),
            party_name="Test Customer",
            invoice_number=invoice.invoice_number,
            total_amount=float(invoice.total_amount),
            amount_received=1000.0,
            balance_due=float(invoice.total_amount) - 1000.0,
            discount=0.0,
            payment_mode="Cash",
            business_id=invoice.business_id
        )
        
        db.session.add(payment_in)
        db.session.commit()
        
        return jsonify({
            "message": "Test payment created successfully",
            "payment_uuid": str(payment_in.uuid),
            "payment_number": payment_in.payment_number,
            "invoice_number": invoice.invoice_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create test payment", "details": str(e)}), 500

@payment_in_blueprint.route("/debug/list", methods=["GET"])
def debug_list_payments():
    """Debug endpoint to list all payment UUIDs"""
    try:
        payments = PaymentIn.query.all()
        payment_list = []
        
        for payment in payments:
            payment_list.append({
                "uuid": str(payment.uuid),
                "payment_number": payment.payment_number,
                "invoice_number": payment.invoice_number,
                "amount_received": float(payment.amount_received),
                "balance_due": float(payment.balance_due),
                "payment_status": payment.payment_status,
                "is_deleted": payment.is_deleted,
                "invoice_id": str(payment.invoice_id)
            })
        
        return jsonify({
            "total_payments": len(payment_list),
            "payments": payment_list
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to list payments", "details": str(e)}), 500

@payment_in_blueprint.route("/invoice/<uuid:invoice_id>", methods=["DELETE"])
@login_required
def delete_payments_by_invoice(invoice_id):
    """
    Delete ALL payment records for a specific invoice and update invoice payment status
    ---
    tags:
      - Payment In
    parameters:
      - name: invoice_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: All payments deleted successfully
      404:
        description: No payments found for invoice
    """
    print(f"PAYMENT-IN DELETION BY INVOICE - Invoice ID: {invoice_id}")
    try:
        # Find all payments for this invoice
        payments = PaymentIn.query.filter_by(invoice_id=str(invoice_id), is_deleted=False).all()
        print(f"FOUND {len(payments)} PAYMENTS FOR INVOICE")
        
        if not payments:
            print("NO PAYMENTS FOUND FOR INVOICE - Returning 404")
            return jsonify({"error": "No payments found for invoice"}), 404
        
        # Get the associated invoice
        invoice = Invoice.query.filter_by(uuid=str(invoice_id)).first()
        if not invoice:
            return jsonify({"error": "Associated invoice not found"}), 404
        
        # Store total payment amount before deletion
        total_payment_amount = sum(float(p.amount_received) for p in payments)
        
        # Soft delete all payments
        for payment in payments:
            payment.is_deleted = True
            set_updated_fields(payment)
            print(f"DELETED PAYMENT: {payment.payment_number}")
        
        # Update invoice payment status
        old_amount_paid = float(invoice.amount_paid)
        old_balance_due = float(invoice.balance_due)
        old_payment_status = invoice.payment_status
        
        invoice.amount_paid = max(0, float(invoice.amount_paid) - total_payment_amount)
        
        # Since all payments are being deleted, set payment_discount to 0
        invoice.payment_discount = 0
        
        invoice.balance_due = float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount or 0)
        
        # Update payment status based on remaining balance
        if invoice.balance_due <= 0:
            invoice.payment_status = "paid"
        elif invoice.amount_paid > 0:
            invoice.payment_status = "partial"
        else:
            invoice.payment_status = "unpaid"
            
        # Debug logging
        print(f"PAYMENT-IN DELETION BY INVOICE - Invoice UUID: {invoice.uuid}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Total payment amount: {total_payment_amount}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Old amount_paid: {old_amount_paid}, New amount_paid: {invoice.amount_paid}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Old balance_due: {old_balance_due}, New balance_due: {invoice.balance_due}")
        print(f"PAYMENT-IN DELETION BY INVOICE - Old payment_status: {old_payment_status}, New payment_status: {invoice.payment_status}")
        
        db.session.commit()
        
        return jsonify({
            "message": f"Deleted {len(payments)} payment(s) successfully",
            "invoice_uuid": str(invoice.uuid),
            "invoice_number": invoice.invoice_number,
            "total_amount_deleted": total_payment_amount,
            "updated_amount_paid": float(invoice.amount_paid),
            "updated_balance_due": float(invoice.balance_due),
            "updated_payment_status": invoice.payment_status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"PAYMENT-IN DELETION BY INVOICE ERROR: {str(e)}")
        return jsonify({"error": "Failed to delete payments", "details": str(e)}), 500
