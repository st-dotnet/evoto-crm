from datetime import datetime, date
from flask import Blueprint, request, jsonify, g
from sqlalchemy import or_, desc, asc
from sqlalchemy.orm import selectinload
from app.extensions import db
from app.models.paymentOut import PaymentOut
from app.models.purchase_invoice import PurchaseInvoice
from app.models.vendor import Vendor
from app.models.inventory import Item


payment_out_blueprint = Blueprint("payment_out", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_payment_out_number() -> str:
    """Generate a unique payment-out number like POUT-1001."""
    last = PaymentOut.query.order_by(PaymentOut.created_at.desc()).first()
    if last and last.payment_number:
        try:
            last_num = int(last.payment_number.split("-")[1])
            return f"POUT-{last_num + 1}"
        except (IndexError, ValueError):
            pass
    return "POUT-1001"


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


def _credit_inventory(invoice: PurchaseInvoice) -> None:
    """
    Increase opening_stock for each Product item on the invoice.
    Called once when the invoice transitions to fully-paid.
    """
    for inv_item in invoice.items:
        if not inv_item.item_id:
            continue
        product = Item.query.get(inv_item.item_id)
        if product and product.opening_stock is not None:
            product.opening_stock = float(product.opening_stock or 0) + float(inv_item.quantity)

    invoice.inventory_updated = True


# ── LIST ──────────────────────────────────────────────────────────────────────

@payment_out_blueprint.route("/", methods=["GET"])
def list_payment_outs():
    """
    List payment-out records with pagination, search, and date filters.
    ---
    tags:
      - Payment Out
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
        description: Paginated list of payment-out records
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
            names = (
                db.session.query(PaymentOut.party_name)
                .distinct()
                .order_by(PaymentOut.party_name)
                .all()
            )
            return jsonify([n[0] for n in names if n[0]]), 200

        if request.args.get("payment_numbers_dropdown") == "true":
            numbers = (
                db.session.query(PaymentOut.payment_number)
                .distinct()
                .order_by(PaymentOut.payment_number)
                .all()
            )
            return jsonify([n[0] for n in numbers if n[0]]), 200

        query = PaymentOut.query

        if party_name:
            query = query.filter(PaymentOut.party_name.ilike(f"%{party_name}%"))
        if payment_number:
            query = query.filter(PaymentOut.payment_number.ilike(f"%{payment_number}%"))
        if payment_status and payment_status != "all":
            query = query.filter(PaymentOut.payment_status == payment_status)
        if date_filter and date_filter != "all":
            query = _date_filter_query(query, PaymentOut, date_filter)

        query = query.order_by(desc(PaymentOut.payment_date), desc(PaymentOut.created_at))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        result = []
        for p in pagination.items:
            result.append({
                "id":             str(p.uuid),
                "payment_number": p.payment_number,
                "date":           p.payment_date.isoformat() if p.payment_date else None,
                "party_name":     p.party_name,
                "invoice_number": p.invoice_number,
                "total_amount":   float(p.total_amount) if p.total_amount else 0,
                "total_amount_settled": float(p.total_amount) if p.total_amount else 0,
                "amount_paid":    float(p.amount_paid) if p.amount_paid else 0,
                "amount_received": float(p.amount_paid) if p.amount_paid else 0,
                "balance_due":    float(p.balance_due) if p.balance_due else 0,
                "payment_discount": float(p.discount) if p.discount else 0,
                "payment_mode":   p.payment_mode,
                "payment_status": p.payment_status,
                "payment_notes":  p.payment_notes,
                "purchase_invoice_id": str(p.purchase_invoice_id),
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
        return jsonify({"error": "Failed to fetch payment-out records", "details": str(e)}), 500


# ── CREATE ────────────────────────────────────────────────────────────────────

@payment_out_blueprint.route("/", methods=["POST"])
def create_payment_out():
    """
    Create a new payment-out record manually.
    ---
    tags:
      - Payment Out
    responses:
      201:
        description: Payment-out created
    """
    data = request.get_json() or {}
    try:
        payment_number = data.get("payment_number") or generate_payment_out_number()

        po = PaymentOut(
            payment_number      = payment_number,
            payment_date        = data.get("payment_date", date.today().isoformat()),
            purchase_invoice_id = data["purchase_invoice_id"],
            party_name          = data.get("party_name", ""),
            invoice_number      = data.get("invoice_number", ""),
            total_amount        = data.get("total_amount", 0),
            amount_paid         = data.get("amount_paid", 0),
            balance_due         = data.get("balance_due", 0),
            discount            = data.get("discount", 0),
            payment_status      = data.get("payment_status", "paid"),
            payment_mode        = data.get("payment_mode", "cash"),
            payment_notes       = data.get("payment_notes", ""),
            business_id         = data["business_id"],
            created_by          = getattr(g, "current_user_id", None),
        )
        db.session.add(po)
        db.session.commit()

        return jsonify({
            "message":        "Payment-out created successfully",
            "uuid":           str(po.uuid),
            "payment_number": po.payment_number,
        }), 201

    except KeyError as e:
        db.session.rollback()
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create payment-out", "details": str(e)}), 500


# ── RECORD PAYMENT ────────────────────────────────────────────────────────────

@payment_out_blueprint.route("/record-payment/<uuid:invoice_id>", methods=["POST"])
def record_payment_out(invoice_id):
    """
    Record an outgoing payment against a Purchase Invoice.
    Updates invoice amount_paid, balance_due, and payment_status.
    Creates a PaymentOut history record.
    ---
    tags:
      - Payment Out
    parameters:
      - name: invoice_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Payment recorded
      400:
        description: Validation error
      404:
        description: Invoice not found
    """
    data = request.get_json() or {}
    try:
        amount_to_pay = float(data.get("amount_paid", 0))
        payment_mode  = data.get("payment_mode", "cash")
        notes         = data.get("notes", "")
        discount      = float(data.get("discount", 0))

        if amount_to_pay <= 0:
            return jsonify({"error": "Payment amount must be greater than 0"}), 400

        invoice = PurchaseInvoice.query.filter_by(uuid=invoice_id, is_deleted=False).first()
        if not invoice:
            return jsonify({"error": "Purchase invoice not found"}), 404

        if invoice.payment_status == "paid":
            return jsonify({"error": "Invoice is already fully paid"}), 400

        current_balance = float(invoice.balance_due or invoice.total_amount or 0)
        total_to_apply  = amount_to_pay + discount

        if total_to_apply > current_balance + 0.01:
            return jsonify({
                "error": f"Overpayment not allowed. Max allowed: ₹{current_balance:.2f}",
                "max_allowed": current_balance,
            }), 400

        # Update invoice financials
        new_amount_paid = float(invoice.amount_paid or 0) + amount_to_pay
        new_balance_due = float(invoice.total_amount or 0) - new_amount_paid - float(invoice.charges.get("discount_total", 0) if isinstance(invoice.charges, dict) else 0)
        new_balance_due = max(new_balance_due - discount, 0)

        invoice.amount_paid   = round(new_amount_paid, 2)
        invoice.balance_due   = round(new_balance_due, 2)
        invoice.payment_mode  = payment_mode
        if new_balance_due <= 0.01:
            invoice.payment_status = "paid"
        elif new_amount_paid > 0:
            invoice.payment_status = "partial"

        # Resolve party name from vendor
        party_name = ""
        if invoice.vendor_id:
            vendor = Vendor.query.get(invoice.vendor_id)
            if vendor:
                party_name = vendor.vendor_name or vendor.company_name or ""
        if not party_name:
            party_name = data.get("party_name", "Unknown Vendor")

        # Create PaymentOut record
        po_record = PaymentOut(
            payment_number      = generate_payment_out_number(),
            payment_date        = date.today(),
            purchase_invoice_id = invoice.uuid,
            party_name          = party_name,
            invoice_number      = invoice.invoice_number,
            total_amount        = float(invoice.total_amount or 0),
            amount_paid         = amount_to_pay,
            balance_due         = round(new_balance_due, 2),
            discount            = discount,
            payment_status      = invoice.payment_status,
            payment_mode        = payment_mode,
            payment_notes       = notes,
            business_id         = invoice.business_id,
            created_by          = getattr(g, "current_user_id", None),
        )
        db.session.add(po_record)

        # ── KEY BUSINESS RULE ────────────────────────────────────────────────
        # Credit inventory ONLY when the invoice becomes fully paid AND
        # inventory has not been updated yet for this invoice.
        if invoice.payment_status == "paid" and not invoice.inventory_updated:
            _credit_inventory(invoice)
        # ──────────────────────────────────────────────────────────────────────

        db.session.commit()

        return jsonify({
            "message":        "Payment recorded successfully",
            "payment_number": po_record.payment_number,
            "amount_paid":    float(invoice.amount_paid),
            "balance_due":    float(invoice.balance_due),
            "payment_status": invoice.payment_status,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to record payment", "details": str(e)}), 500


# ── GET ONE ───────────────────────────────────────────────────────────────────

@payment_out_blueprint.route("/<uuid:payment_id>", methods=["GET"])
def get_payment_out(payment_id):
    """Get a single payment-out record."""
    try:
        p = PaymentOut.query.filter_by(uuid=payment_id).first_or_404()
        return jsonify({
            "id":             str(p.uuid),
            "payment_number": p.payment_number,
            "date":           p.payment_date.isoformat() if p.payment_date else None,
            "party_name":     p.party_name,
            "invoice_number": p.invoice_number,
            "total_amount":   float(p.total_amount),
            "amount_paid":    float(p.amount_paid),
            "balance_due":    float(p.balance_due),
            "discount":       float(p.discount or 0),
            "payment_mode":   p.payment_mode,
            "payment_status": p.payment_status,
            "payment_notes":  p.payment_notes,
            "purchase_invoice_id": str(p.purchase_invoice_id),
            "business_id":    p.business_id,
            "created_at":     p.created_at.isoformat() if p.created_at else None,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── UPDATE ────────────────────────────────────────────────────────────────────

@payment_out_blueprint.route("/<uuid:payment_id>", methods=["PUT"])
def update_payment_out(payment_id):
    """
    Update an existing payment-out record (notes, mode, etc.).
    Total amount and amount paid are usually kept as is for history integrity.
    """
    p = PaymentOut.query.filter_by(uuid=payment_id).first_or_404()
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
        return jsonify({"message": "Payment-out updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── DELETE ────────────────────────────────────────────────────────────────────

@payment_out_blueprint.route("/<uuid:payment_id>", methods=["DELETE"])
def delete_payment_out(payment_id):
    """Delete a payment-out record."""
    p = PaymentOut.query.filter_by(uuid=payment_id).first_or_404()
    try:
        db.session.delete(p)
        db.session.commit()
        return jsonify({"message": "Payment-out deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ── VENDOR INVOICES ───────────────────────────────────────────────────────────

@payment_out_blueprint.route("/vendor-invoices", methods=["GET"])
def get_vendor_invoices():
    """
    Get purchase invoices for a specific vendor that have a pending balance.
    Used to populate the invoice selection in Create Payment Out.
    ---
    tags:
      - Payment Out
    parameters:
      - name: vendor_name
        in: query
        required: false
        type: string
      - name: per_page
        in: query
        type: integer
    responses:
      200:
        description: List of purchase invoices
    """
    try:
        vendor_name = request.args.get("vendor_name", "").strip()
        per_page    = int(request.args.get("per_page", 1000))

        query = (
            PurchaseInvoice.query
            .filter(PurchaseInvoice.is_deleted == False)
            .outerjoin(Vendor, PurchaseInvoice.vendor_id == Vendor.uuid)
        )

        if vendor_name:
            query = query.filter(
                or_(
                    Vendor.vendor_name.ilike(f"%{vendor_name}%"),
                    Vendor.company_name.ilike(f"%{vendor_name}%"),
                )
            )

        invoices = query.limit(per_page).all()

        # Build results — include all except "unpaid" when vendor_name is given
        results = []
        for inv in invoices:
            v = inv.vendor
            vname = ""
            if v:
                vname = v.vendor_name or v.company_name or ""

            balance = float(inv.balance_due or 0)
            amt_paid = float(inv.amount_paid or 0)
            total = float(inv.total_amount or 0)

            status = "unpaid"
            if balance <= 0 and amt_paid > 0:
                status = "paid"
            elif amt_paid > 0:
                status = "partial"
            else:
                status = "unpaid"

            results.append({
                "id":             str(inv.uuid),
                "invoice_number": inv.invoice_number,
                "date":           inv.invoice_date.isoformat() if inv.invoice_date else None,
                "due_date":       inv.due_date.isoformat() if inv.due_date else None,
                "vendor_name":    vname,
                "invoice_amount": total,
                "amount_paid":    amt_paid,
                "balance_amount": balance,
                "balance_due":    balance,
                "discount":       0,
                "payment_status": status,
                "status":         status,
            })

        return jsonify(results), 200

    except Exception as e:
        return jsonify({"error": "Failed to fetch vendor invoices", "details": str(e)}), 500
