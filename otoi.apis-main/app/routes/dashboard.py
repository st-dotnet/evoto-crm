from flask import Blueprint, request, jsonify, g
from sqlalchemy import func, and_, desc
from datetime import datetime, timedelta
from app.extensions import db
from app.models.invoice import Invoice
from app.models.purchase_invoice import PurchaseInvoice
from app.models.purchase_order import PurchaseOrder
from app.models.creditIn import CreditNote
from app.models.debit_note import DebitNote
from app.models.paymentIn import PaymentIn
from app.models.paymentOut import PaymentOut
from app.models.customer import Customer
from app.models.vendor import Vendor

dashboard_blueprint = Blueprint("dashboard", __name__)


@dashboard_blueprint.route("/summary", methods=["GET"])
def get_dashboard_summary():
    """
    Returns business overview stats: To Collect, To Pay, and Total Cash+Bank Balance.
    Scoped to the authenticated user's business_id (from JWT claims).
    ---
    tags:
      - Dashboard
    responses:
      200:
        description: Dashboard summary statistics
    """
    try:
        business_id = g.get("business_id")

        # ------- To Collect (Net Receivables) -------
        # Sum of balance_due on all non-deleted, non-paid invoices (sales)
        invoices_to_collect = (
            db.session.query(func.coalesce(func.sum(Invoice.balance_due), 0))
            .filter(
                Invoice.business_id == business_id,
                Invoice.is_deleted == False,
                Invoice.payment_status != "paid",
            )
            .scalar()
        )

        # Split credit notes into two buckets:
        # 1) CN against unpaid/partial invoices → offsets receivables (reduce "To Collect")
        # 2) CN against fully-paid invoices or refund CNs → actual refund owed (add to "To Pay")

        # All outstanding (non-paid) credit notes for this business
        outstanding_cns = (
            CreditNote.query
            .filter(
                CreditNote.business_id == business_id,
                CreditNote.is_deleted == False,
                CreditNote.status != "paid",
            )
            .all()
        )

        credit_notes_offset = 0.0    # reduces To Collect (CN that offsets unpaid invoice balance)
        credit_notes_refund = 0.0    # adds to To Pay (excess CN = actual refund owed to customer)

        for cn in outstanding_cns:
            cn_balance = float(cn.balance_amount or 0)
            if cn_balance <= 0:
                continue

            if cn.invoice_id:
                # Check the linked invoice
                linked_invoice = Invoice.query.filter_by(
                    uuid=cn.invoice_id,
                    is_deleted=False
                ).first()

                if linked_invoice:
                    # invoice.balance_due = total_amount - amount_paid (raw DB value, not modified by CN)
                    invoice_remaining = float(linked_invoice.balance_due or 0)

                    if linked_invoice.payment_status == "paid":
                        # Invoice marked "paid" (CN + payments covered it fully).
                        # The invoice is already excluded from invoices_to_collect.
                        # offset portion = min(cn_balance, invoice_remaining) → already excluded, no action
                        # refund portion = excess beyond invoice balance → To Pay
                        refund_portion = max(0.0, cn_balance - invoice_remaining)
                        credit_notes_refund += refund_portion
                    else:
                        # Invoice still unpaid/partial → included in invoices_to_collect
                        # offset = min(cn_balance, invoice_remaining) → reduce To Collect
                        offset = min(cn_balance, invoice_remaining)
                        credit_notes_offset += offset
                        # Any excess beyond invoice balance is a refund → To Pay
                        excess = max(0.0, cn_balance - invoice_remaining)
                        credit_notes_refund += excess
                else:
                    # Linked invoice was deleted; treat full CN as offset
                    credit_notes_offset += cn_balance
            else:
                # No linked invoice
                if cn.status == "refunded":
                    credit_notes_refund += cn_balance
                else:
                    # Standalone unpaid CN – offset from receivables
                    credit_notes_offset += cn_balance

        credit_notes_to_refund = round(credit_notes_offset + credit_notes_refund, 2)
        to_collect = round(float(invoices_to_collect) - credit_notes_offset, 2)

        # ------- To Pay (Net Payables) -------
        # Sum of balance_due on all non-deleted, non-paid purchase invoices
        invoices_to_pay = (
            db.session.query(func.coalesce(func.sum(PurchaseInvoice.balance_due), 0))
            .filter(
                PurchaseInvoice.business_id == business_id,
                PurchaseInvoice.is_deleted == False,
                PurchaseInvoice.payment_status != "paid",
            )
            .scalar()
        )
        # Minus outstanding Debit Notes (money vendors owe back to us)
        debit_notes_to_receive = (
            db.session.query(func.coalesce(func.sum(DebitNote.balance_amount), 0))
            .filter(
                DebitNote.business_id == business_id,
                DebitNote.is_deleted == False,
                DebitNote.status != "paid",
            )
            .scalar()
        )
        to_pay = round(float(invoices_to_pay) - float(debit_notes_to_receive) + credit_notes_refund, 2)

        # ------- Cash Book (Cash vs Bank Balance) -------
        # Let's split payment_mode == "cash" vs others to compute genuine Cash in Hand vs Bank
        
        # PaymentIn
        pin_cash = db.session.query(func.coalesce(func.sum(PaymentIn.amount_received), 0)).filter(
            PaymentIn.business_id == business_id,
            func.lower(PaymentIn.payment_mode) == 'cash'
        ).scalar()
        
        pin_bank = db.session.query(func.coalesce(func.sum(PaymentIn.amount_received), 0)).filter(
            PaymentIn.business_id == business_id,
            func.lower(PaymentIn.payment_mode) != 'cash'
        ).scalar()
        
        # PaymentOut
        pout_cash = db.session.query(func.coalesce(func.sum(PaymentOut.amount_paid), 0)).filter(
            PaymentOut.business_id == business_id,
            func.lower(PaymentOut.payment_mode) == 'cash'
        ).scalar()
        
        pout_bank = db.session.query(func.coalesce(func.sum(PaymentOut.amount_paid), 0)).filter(
            PaymentOut.business_id == business_id,
            func.lower(PaymentOut.payment_mode) != 'cash'
        ).scalar()

        cash_in_hand = round(float(pin_cash) - float(pout_cash), 2)
        bank_balance = round(float(pin_bank) - float(pout_bank), 2)
        cash_bank_balance = cash_in_hand + bank_balance

        return jsonify({
            "to_collect": to_collect,
            "to_pay": to_pay,
            "cash_in_hand": cash_in_hand,
            "bank_balance": bank_balance,
            "cash_bank_balance": cash_bank_balance,
            "total_receivables_gross": round(float(invoices_to_collect), 2),
            "total_credit_notes": round(credit_notes_offset, 2),
            "total_payables_gross": round(float(invoices_to_pay), 2),
            "total_debit_notes": round(float(debit_notes_to_receive), 2),
            "credit_notes_refund": round(credit_notes_refund, 2),
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to load dashboard summary", "details": str(e)}), 500


@dashboard_blueprint.route("/latest-transactions", methods=["GET"])
def get_latest_transactions():
    """
    Returns the most recent transactions across invoices, purchase invoices,
    purchase orders, payment-in, and payment-out — unified into one timeline.
    ---
    tags:
      - Dashboard
    parameters:
      - name: limit
        in: query
        type: integer
        default: 5
    responses:
      200:
        description: List of latest transactions
    """
    try:
        business_id = g.get("business_id")
        limit = int(request.args.get("limit", 5))
        transactions = []

        # Auto-close overdue POs so stale orders don't appear
        from app.routes.purchase_order import auto_close_overdue_pos
        try:
            auto_close_overdue_pos()
        except Exception:
            pass

        # --- Sales Invoices ---
        try:
            sinvs = (
                Invoice.query
                .filter(
                    Invoice.business_id == business_id,
                    Invoice.is_deleted == False,
                )
                .order_by(desc(Invoice.created_at))
                .limit(limit)
                .all()
            )
            for sinv in sinvs:
                customer_name = "-"
                if sinv.customer:
                    customer_name = f"{sinv.customer.first_name or ''} {sinv.customer.last_name or ''}".strip() or "-"
                transactions.append({
                    "id": str(sinv.uuid),
                    "route_path": f"/invoices/{sinv.uuid}",
                    "date": str(sinv.invoice_date) if sinv.invoice_date else None,
                    "type": "Sales Invoices",
                    "txn_no": str(sinv.invoice_number),
                    "party_name": customer_name,
                    "amount": round(float(sinv.total_amount or 0), 2),
                    "created_at": str(sinv.created_at) if sinv.created_at else None,
                })
        except Exception as e:
            print("Error parsing Sales Invoices in latest transactions:", e)

        # --- Payment In ---
        try:
            pay_ins = (
                PaymentIn.query
                .filter(PaymentIn.business_id == business_id)
                .order_by(desc(PaymentIn.created_at))
                .limit(limit)
                .all()
            )
            for pi in pay_ins:
                transactions.append({
                    "id": str(pi.uuid),
                    "route_path": f"/payment-in/{pi.uuid}",
                    "date": str(pi.payment_date) if pi.payment_date else None,
                    "type": "Payment In",
                    "txn_no": str(pi.payment_number),
                    "party_name": pi.party_name or "-",
                    "amount": round(float(pi.amount_received or 0), 2),
                    "created_at": str(pi.created_at) if pi.created_at else None,
                })
        except Exception as e:
            print("Error parsing Payment In transactions:", e)

        # --- Payment Out ---
        try:
            pay_outs = (
                PaymentOut.query
                .filter(PaymentOut.business_id == business_id)
                .order_by(desc(PaymentOut.created_at))
                .limit(limit)
                .all()
            )
            for po in pay_outs:
                transactions.append({
                    "id": str(po.uuid),
                    "route_path": f"/payment-out/{po.uuid}",
                    "date": str(po.payment_date) if po.payment_date else None,
                    "type": "Payment Out",
                    "txn_no": str(po.payment_number),
                    "party_name": po.party_name or "-",
                    "amount": round(float(po.amount_paid or 0), 2),
                    "created_at": str(po.created_at) if po.created_at else None,
                })
        except Exception as e:
            print("Error parsing Payment Out transactions:", e)

        # --- Purchase Invoices ---
        try:
            pinvs = (
                PurchaseInvoice.query
                .filter(
                    PurchaseInvoice.business_id == business_id,
                    PurchaseInvoice.is_deleted == False,
                )
                .order_by(desc(PurchaseInvoice.created_at))
                .limit(limit)
                .all()
            )
            for pinv in pinvs:
                vendor_name = "-"
                if pinv.vendor:
                    vendor_name = pinv.vendor.company_name or pinv.vendor.vendor_name or "-"
                transactions.append({
                    "id": str(pinv.uuid),
                    "route_path": f"/purchases/purchase-invoices/{pinv.uuid}",
                    "date": str(pinv.invoice_date) if pinv.invoice_date else None,
                    "type": "Purchase Invoices",
                    "txn_no": str(pinv.invoice_number),
                    "party_name": vendor_name,
                    "amount": round(float(pinv.total_amount or 0), 2),
                    "created_at": str(pinv.created_at) if pinv.created_at else None,
                })
        except Exception as e:
            print("Error parsing Purchase Invoices transactions:", e)

        # --- Purchase Orders (only "open" — closed/received POs are fulfilled) ---
        try:
            pos = (
                PurchaseOrder.query
                .filter(
                    PurchaseOrder.business_id == business_id,
                    PurchaseOrder.status == "open",
                )
                .order_by(desc(PurchaseOrder.created_at))
                .limit(limit)
                .all()
            )
            for po_item in pos:
                vendor_name = "-"
                if po_item.vendor:
                    vendor_name = po_item.vendor.company_name or po_item.vendor.vendor_name or "-"
                transactions.append({
                    "id": str(po_item.uuid),
                    "route_path": f"/purchases/purchase-orders/{po_item.uuid}",
                    "date": str(po_item.po_date) if po_item.po_date else None,
                    "type": "Purchase Orders",
                    "txn_no": str(po_item.po_number),
                    "party_name": vendor_name,
                    "amount": round(float(po_item.total_amount or 0), 2),
                    "created_at": str(po_item.created_at) if po_item.created_at else None,
                })
        except Exception as e:
            print("Error parsing Purchase Orders transactions:", e)

        # Sort all by created_at descending, take top `limit`
        transactions.sort(key=lambda t: t.get("created_at") or "", reverse=True)
        transactions = transactions[:limit]

        return jsonify({"transactions": transactions}), 200

    except Exception as e:
        return jsonify({"error": "Failed to load transactions", "details": str(e)}), 500


@dashboard_blueprint.route("/sales-report", methods=["GET"])
def get_sales_report():
    """
    Returns aggregated sales data for charts.
    Supports daily / weekly / monthly grouping via ?period=daily|weekly|monthly
    and an optional ?days=N parameter (default 7).
    ---
    tags:
      - Dashboard
    parameters:
      - name: period
        in: query
        type: string
        default: daily
      - name: days
        in: query
        type: integer
        default: 7
    responses:
      200:
        description: Sales chart data
    """
    try:
        business_id = g.get("business_id")
        period = request.args.get("period", "daily")
        days = int(request.args.get("days", 7))

        today = datetime.utcnow().date()
        start_date = today - timedelta(days=days - 1)

        # Get all non-deleted invoices in the date range
        invoices = (
            Invoice.query
            .filter(
                Invoice.business_id == business_id,
                Invoice.is_deleted == False,
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= today,
            )
            .all()
        )

        total_sales = 0.0
        invoices_made = 0

        if period == "daily":
            # Build a day-by-day bucket
            data_points = []
            for i in range(days):
                d = start_date + timedelta(days=i)
                day_total = sum(
                    float(inv.total_amount)
                    for inv in invoices
                    if inv.invoice_date == d
                )
                day_count = sum(1 for inv in invoices if inv.invoice_date == d)
                total_sales += day_total
                invoices_made += day_count
                data_points.append({
                    "label": d.strftime("%a"),       # Thu, Fri, etc.
                    "date": d.isoformat(),
                    "value": round(day_total, 2),
                    "count": day_count,
                })
        elif period == "weekly":
            # Group by ISO week
            from collections import OrderedDict
            weeks = OrderedDict()
            for inv in invoices:
                week_num = inv.invoice_date.isocalendar()[1]
                key = f"W{week_num}"
                if key not in weeks:
                    weeks[key] = {"value": 0.0, "count": 0}
                weeks[key]["value"] += float(inv.total_amount)
                weeks[key]["count"] += 1
            data_points = [
                {"label": k, "value": round(v["value"], 2), "count": v["count"]}
                for k, v in weeks.items()
            ]
            total_sales = sum(d["value"] for d in data_points)
            invoices_made = sum(d["count"] for d in data_points)
        else:  # monthly
            from collections import OrderedDict
            months = OrderedDict()
            for inv in invoices:
                key = inv.invoice_date.strftime("%b %Y")
                if key not in months:
                    months[key] = {"value": 0.0, "count": 0}
                months[key]["value"] += float(inv.total_amount)
                months[key]["count"] += 1
            data_points = [
                {"label": k, "value": round(v["value"], 2), "count": v["count"]}
                for k, v in months.items()
            ]
            total_sales = sum(d["value"] for d in data_points)
            invoices_made = sum(d["count"] for d in data_points)

        return jsonify({
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": today.isoformat(),
            "data_points": data_points,
            "total_sales": round(total_sales, 2),
            "invoices_made": invoices_made,
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to load sales report", "details": str(e)}), 500


@dashboard_blueprint.route("/overdue-summary", methods=["GET"])
def get_overdue_summary():
    """
    Returns a summary of overdue invoices (past due_date, not fully paid).
    ---
    tags:
      - Dashboard
    responses:
      200:
        description: Overdue invoice summary
    """
    try:
        business_id = g.get("business_id")
        today = datetime.utcnow().date()

        overdue_invoices = (
            Invoice.query
            .filter(
                Invoice.business_id == business_id,
                Invoice.is_deleted == False,
                Invoice.payment_status != "paid",
                Invoice.due_date < today,
            )
            .all()
        )

        total_count = len(overdue_invoices)
        total_amount = sum(float(inv.balance_due or 0) for inv in overdue_invoices)

        oldest_days = 0
        if overdue_invoices:
            oldest_due = min(inv.due_date for inv in overdue_invoices if inv.due_date)
            oldest_days = (today - oldest_due).days

        return jsonify({
            "total_count": total_count,
            "total_amount": round(total_amount, 2),
            "oldest_days": oldest_days,
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to load overdue summary", "details": str(e)}), 500


@dashboard_blueprint.route("/top-parties", methods=["GET"])
def get_top_parties():
    """
    Returns top customers (receivable) or vendors (payable) by outstanding balance.
    ---
    tags:
      - Dashboard
    parameters:
      - name: type
        in: query
        type: string
        default: receivable
        description: "receivable or payable"
      - name: limit
        in: query
        type: integer
        default: 5
    responses:
      200:
        description: Top parties by outstanding balance
    """
    try:
        business_id = g.get("business_id")
        party_type = request.args.get("type", "receivable")
        limit = int(request.args.get("limit", 5))

        parties = []

        if party_type == "receivable":
            # Group invoices by customer, sum balance_due
            results = (
                db.session.query(
                    Invoice.customer_id,
                    func.sum(Invoice.balance_due).label("total_due"),
                    func.count(Invoice.uuid).label("inv_count"),
                )
                .filter(
                    Invoice.business_id == business_id,
                    Invoice.is_deleted == False,
                    Invoice.payment_status != "paid",
                )
                .group_by(Invoice.customer_id)
                .order_by(func.sum(Invoice.balance_due).desc())
                .limit(limit)
                .all()
            )

            for customer_id, total_due, inv_count in results:
                customer = Customer.query.get(customer_id)
                if customer:
                    name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or "-"
                else:
                    name = "-"
                parties.append({
                    "name": name,
                    "amount": round(float(total_due or 0), 2),
                    "count": inv_count,
                })
        else:
            # Group purchase invoices by vendor, sum balance_due
            results = (
                db.session.query(
                    PurchaseInvoice.vendor_id,
                    func.sum(PurchaseInvoice.balance_due).label("total_due"),
                    func.count(PurchaseInvoice.uuid).label("inv_count"),
                )
                .filter(
                    PurchaseInvoice.business_id == business_id,
                    PurchaseInvoice.is_deleted == False,
                    PurchaseInvoice.payment_status != "paid",
                )
                .group_by(PurchaseInvoice.vendor_id)
                .order_by(func.sum(PurchaseInvoice.balance_due).desc())
                .limit(limit)
                .all()
            )

            for vendor_id, total_due, inv_count in results:
                vendor = Vendor.query.get(vendor_id) if vendor_id else None
                if vendor:
                    name = vendor.company_name or vendor.vendor_name or "-"
                else:
                    name = "-"
                parties.append({
                    "name": name,
                    "amount": round(float(total_due or 0), 2),
                    "count": inv_count,
                })

        return jsonify({"parties": parties}), 200

    except Exception as e:
        return jsonify({"error": "Failed to load top parties", "details": str(e)}), 500
