"""
Purchase Invoice Routes
=======================
Workflow
--------
1.  POST /from-po/<po_id>   — Convert a PO into a Purchase Invoice (payment_status = "unpaid").
                              Inventory is NOT updated at this stage.
2.  GET  /                  — List all purchase invoices (paginated).
3.  GET  /<inv_id>          — Get a single purchase invoice with items.
4.  POST /<inv_id>/record-payment
                            — Record a (partial or full) payment.
                              When balance_due reaches 0 (fully paid) AND
                              inventory_updated is still False, the items'
                              opening_stock is incremented automatically.
5.  PUT  /<inv_id>/delete   — Soft-delete a purchase invoice.
"""

from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import desc, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.inventory import Item
from app.models.vendor import Vendor
from app.services.pdf_service import generate_purchase_invoice_pdf

purchase_invoice_blueprint = Blueprint("purchase_invoice", __name__)



# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_invoice_number() -> str:
    last = PurchaseInvoice.query.order_by(PurchaseInvoice.created_at.desc()).first()
    if last and last.invoice_number:
        try:
            num = int(last.invoice_number.split("-")[1])
            return f"PINV-{num + 1}"
        except (IndexError, ValueError):
            pass
    return "PINV-1001"


def _credit_inventory(invoice: PurchaseInvoice) -> None:
    """
    Increase opening_stock for each Product item on the invoice.
    Called once when the invoice transitions to fully-paid.
    Skipped for Service items (opening_stock is NULL for them).
    """
    for inv_item in invoice.items:
        if not inv_item.item_id:
            continue
        product = Item.query.get(inv_item.item_id)
        if product and product.opening_stock is not None:
            product.opening_stock = float(product.opening_stock or 0) + float(inv_item.quantity)

    invoice.inventory_updated = True


def _serialize_item(inv_item: PurchaseInvoiceItem, product_map: dict) -> dict:
    row = {
        "uuid": str(inv_item.uuid),
        "item_id": str(inv_item.item_id) if inv_item.item_id else None,
        "description": inv_item.description,
        "quantity": float(inv_item.quantity) if inv_item.quantity else 0,
        "unit_price": float(inv_item.unit_price) if inv_item.unit_price else 0,
        "discount": inv_item.discount or {},
        "tax": inv_item.tax or {},
        "total_price": float(inv_item.total_price) if inv_item.total_price else 0,
    }
    if inv_item.item_id and inv_item.item_id in product_map:
        p = product_map[inv_item.item_id]
        row["product_name"] = p.item_name
        row["hsn_sac_code"] = p.hsn_code
        row["measuring_unit_id"] = p.measuring_unit_id
    return row


# ── CREATE FROM PO ────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/from-po/<uuid:po_id>", methods=["POST"])
def create_from_purchase_order(po_id):
    """
    Convert a Purchase Order into a Purchase Invoice.
    ---
    tags:
      - Purchase Invoices
    parameters:
      - name: po_id
        in: path
        required: true
        type: string
        format: uuid
    requestBody:
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
              notes:
                type: string
    responses:
      201:
        description: Purchase Invoice created (payment_status = unpaid)
      404:
        description: PO not found
      409:
        description: Invoice already exists for this PO
    """
    po = (
        PurchaseOrder.query
        .options(selectinload(PurchaseOrder.items))
        .filter_by(uuid=po_id)
        .first_or_404(description="Purchase Order not found")
    )

    # Prevent duplicate invoices for the same PO
    existing = PurchaseInvoice.query.filter_by(
        purchase_order_id=po.uuid, is_deleted=False
    ).first()
    if existing:
        return jsonify({
            "error": "A Purchase Invoice already exists for this PO",
            "invoice_uuid": str(existing.uuid),
            "invoice_number": existing.invoice_number,
        }), 409

    data = request.get_json() or {}
    today = datetime.utcnow().date()

    try:
        invoice_number = _generate_invoice_number()
        invoice_date_str = data.get("invoice_date")
        due_date_str = data.get("due_date")

        invoice_date = (
            datetime.strptime(invoice_date_str, "%Y-%m-%d").date()
            if invoice_date_str else today
        )
        due_date = (
            datetime.strptime(due_date_str, "%Y-%m-%d").date()
            if due_date_str else today + timedelta(days=30)
        )

        total_amount = float(po.total_amount or 0)

        invoice = PurchaseInvoice(
            invoice_number=invoice_number,
            purchase_order_id=po.uuid,
            vendor_id=po.vendor_id,
            business_id=po.business_id,
            invoice_date=invoice_date,
            due_date=due_date,
            total_amount=total_amount,
            amount_paid=0,
            balance_due=total_amount,
            charges=po.charges or {},
            payment_status="unpaid",
            inventory_updated=False,
            additional_notes={
                "notes": data.get("notes", (po.additional_notes or {}).get("notes", "")),
                "terms_and_conditions": (po.additional_notes or {}).get("terms_and_conditions", ""),
            },
        )
        db.session.add(invoice)
        db.session.flush()

        # Copy line items from PO
        # Fetch inventory item details for each PO item
        item_ids = [poi.item_id for poi in po.items if poi.item_id]
        product_map = {
            p.id: p
            for p in Item.query.filter(Item.id.in_(item_ids)).all()
        } if item_ids else {}

        for poi in po.items:
            pi_item = PurchaseInvoiceItem(
                purchase_invoice_id=invoice.uuid,
                item_id=poi.item_id,
                description=poi.description,
                quantity=poi.quantity,
                unit_price=poi.unit_price,
                discount=poi.discount or {},
                tax=poi.tax or {},
                total_price=poi.total_price,
            )
            db.session.add(pi_item)

        # Mark PO as "received" (goods expected/received; payment pending)
        po.status = "received"

        db.session.commit()

        return jsonify({
            "message": "Purchase Invoice created successfully. Inventory will be updated upon full payment.",
            "invoice_uuid": str(invoice.uuid),
            "invoice_number": invoice.invoice_number,
            "payment_status": invoice.payment_status,
            "total_amount": float(invoice.total_amount),
            "inventory_updated": invoice.inventory_updated,
        }), 201

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create purchase invoice", "details": str(e)}), 500


# ── CREATE DIRECT ─────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/", methods=["POST"])
def create_purchase_invoice():
    """
    Create a Purchase Invoice directly (without a PO).
    ---
    tags:
      - Purchase Invoices
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - vendor_id
              - items
              - total_amount
            properties:
              vendor_id:
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
              balance_due:
                type: number
              items:
                type: array
                items:
                  type: object
                  properties:
                    item_id:
                      type: string
                    description:
                      type: string
                    quantity:
                      type: number
                    unit_price:
                      type: number
                    discount:
                      type: object
                    tax:
                      type: object
                    total_price:
                      type: number
              notes:
                type: string
              terms_and_conditions:
                type: string
    responses:
      201:
        description: Created
    """
    data = request.get_json() or {}
    business_id = request.headers.get("X-Business-Id") or 1  # Fallback for now

    try:
        invoice_number = _generate_invoice_number()
        today = datetime.utcnow().date()

        invoice_date_str = data.get("invoice_date")
        due_date_str = data.get("due_date")

        invoice_date = (
            datetime.strptime(invoice_date_str, "%Y-%m-%d").date()
            if invoice_date_str else today
        )
        due_date = (
            datetime.strptime(due_date_str, "%Y-%m-%d").date()
            if due_date_str else today + timedelta(days=30)
        )

        total_amount = float(data.get("total_amount", 0))
        amount_paid = float(data.get("amount_paid", 0))
        balance_due = total_amount - amount_paid

        invoice = PurchaseInvoice(
            invoice_number=invoice_number,
            vendor_id=data.get("vendor_id"),
            business_id=business_id,
            invoice_date=invoice_date,
            due_date=due_date,
            total_amount=total_amount,
            amount_paid=amount_paid,
            balance_due=balance_due,
            charges=data.get("charges", {}),
            payment_status="paid" if balance_due <= 0 else ("partial" if amount_paid > 0 else "unpaid"),
            inventory_updated=False,
            additional_notes={
                "notes": data.get("notes", ""),
                "terms_and_conditions": data.get("terms_and_conditions", ""),
            },
        )
        db.session.add(invoice)
        db.session.flush()

        # Add items
        for item in data.get("items", []):
            pi_item = PurchaseInvoiceItem(
                purchase_invoice_id=invoice.uuid,
                item_id=item.get("item_id"),
                description=item.get("description"),
                quantity=item.get("quantity"),
                unit_price=item.get("unit_price"),
                discount=item.get("discount") or {},
                tax=item.get("tax") or {},
                total_price=item.get("total_price"),
            )
            db.session.add(pi_item)

        # Trigger inventory update if fully paid
        if invoice.payment_status == "paid":
             _credit_inventory(invoice)

        db.session.commit()

        return jsonify({
            "message": "Purchase Invoice created successfully",
            "invoice_uuid": str(invoice.uuid),
            "invoice_number": invoice.invoice_number,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to create purchase invoice", "details": str(e)}), 500


# ── LIST ──────────────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/", methods=["GET"])
def list_purchase_invoices():
    """
    List all purchase invoices with pagination and filtering.
    ---
    tags:
      - Purchase Invoices
    parameters:
      - name: search
        in: query
        type: string
      - name: payment_status
        in: query
        type: string
        description: unpaid | partial | paid
      - name: page
        in: query
        type: integer
      - name: per_page
        in: query
        type: integer
    responses:
      200:
        description: Paginated list of purchase invoices
    """
    try:
        query = db.session.query(PurchaseInvoice).outerjoin(Vendor, PurchaseInvoice.vendor_id == Vendor.uuid).filter(PurchaseInvoice.is_deleted == False)

        search = request.args.get("search", "").strip()
        vendor_name = request.args.get("vendor_name", "").strip()
        invoice_number = request.args.get("invoice_number", "").strip()
        payment_status = request.args.get("payment_status", "").strip()

        if search:
            query = query.filter(
                or_(
                    PurchaseInvoice.invoice_number.ilike(f"%{search}%"),
                    Vendor.vendor_name.ilike(f"%{search}%"),
                    Vendor.company_name.ilike(f"%{search}%")
                )
            )
        
        if vendor_name:
            query = query.filter(
                or_(
                    Vendor.vendor_name.ilike(f"%{vendor_name}%"),
                    Vendor.company_name.ilike(f"%{vendor_name}%")
                )
            )
            
        if invoice_number:
            query = query.filter(PurchaseInvoice.invoice_number.ilike(f"%{invoice_number}%"))

        if payment_status:
            query = query.filter(PurchaseInvoice.payment_status == payment_status)

        query = query.order_by(desc(PurchaseInvoice.created_at))

        page = int(request.args.get("page", 1))
        per_page = int(
            request.args.get("per_page")
            or request.args.get("items_per_page")
            or 10
        )
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        invoices = pagination.items

        # Batch-fetch vendors
        vendor_ids = [inv.vendor_id for inv in invoices if inv.vendor_id]
        vendor_map = (
            {v.uuid: v for v in Vendor.query.filter(Vendor.uuid.in_(vendor_ids)).all()}
            if vendor_ids else {}
        )

        result = []
        for inv in invoices:
            v = vendor_map.get(inv.vendor_id)
            result.append({
                "uuid": str(inv.uuid),
                "invoice_number": inv.invoice_number,
                "purchase_order_id": str(inv.purchase_order_id) if inv.purchase_order_id else None,
                "vendor_id": str(inv.vendor_id) if inv.vendor_id else None,
                "vendor_name": (v.vendor_name or v.company_name) if v else None,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
                "total_amount": float(inv.total_amount),
                "amount_paid": float(inv.amount_paid),
                "balance_due": float(inv.balance_due),
                "payment_status": inv.payment_status,
                "inventory_updated": inv.inventory_updated,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            })

        return jsonify({
            "data": result,
            "pagination": {
                "total": pagination.total,
                "items_per_page": per_page,
                "current_page": page,
                "last_page": pagination.pages,
            },
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to fetch purchase invoices", "details": str(e)}), 500


# ── GET ONE ───────────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/<uuid:invoice_id>", methods=["GET"])
def get_purchase_invoice(invoice_id):
    """
    Get a single purchase invoice by UUID.
    ---
    tags:
      - Purchase Invoices
    responses:
      200:
        description: Purchase invoice detail
      404:
        description: Not found
    """
    invoice = (
        PurchaseInvoice.query
        .options(selectinload(PurchaseInvoice.items))
        .filter_by(uuid=invoice_id, is_deleted=False)
        .first_or_404(description="Purchase invoice not found")
    )

    item_ids = [i.item_id for i in invoice.items if i.item_id]
    product_map = (
        {p.id: p for p in Item.query.filter(Item.id.in_(item_ids)).all()}
        if item_ids else {}
    )

    v = invoice.vendor
    return jsonify({
        "uuid": str(invoice.uuid),
        "invoice_number": invoice.invoice_number,
        "purchase_order_id": str(invoice.purchase_order_id) if invoice.purchase_order_id else None,
        "vendor_id": str(invoice.vendor_id) if invoice.vendor_id else None,
        "vendor": {
            "uuid": str(v.uuid),
            "vendor_name": v.vendor_name,
            "company_name": v.company_name,
            "mobile": v.mobile,
            "email": v.email,
            "gst": v.gst,
            "address1": v.address1,
            "city": v.city,
            "state": v.state,
            "country": v.country,
            "pin": v.pin,
        } if v else None,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        "total_amount": float(invoice.total_amount),
        "amount_paid": float(invoice.amount_paid),
        "balance_due": float(invoice.balance_due),
        "charges": invoice.charges or {},
        "payment_status": invoice.payment_status,
        "payment_mode": invoice.payment_mode,
        "inventory_updated": invoice.inventory_updated,
        "additional_notes": invoice.additional_notes or {},
        "items": [_serialize_item(i, product_map) for i in invoice.items],
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "updated_at": invoice.updated_at.isoformat() if invoice.updated_at else None,
    }), 200


# ── RECORD PAYMENT ────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/<uuid:invoice_id>/record-payment", methods=["POST"])
def record_payment(invoice_id):
    """
    Record a payment against a purchase invoice.

   When the invoice becomes fully paid (balance_due <= 0) and inventory
    has not been updated yet, the items' opening_stock is incremented.

    ---
    tags:
      - Purchase Invoices
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
                description: Payment amount
              payment_mode:
                type: string
                description: Cash | Bank Transfer | UPI | Cheque | etc.
              notes:
                type: string
    responses:
      200:
        description: Payment recorded; inventory updated if fully paid
      400:
        description: Overpayment / validation error
      404:
        description: Invoice not found
    """
    invoice = (
        PurchaseInvoice.query
        .options(selectinload(PurchaseInvoice.items))
        .filter_by(uuid=invoice_id, is_deleted=False)
        .first_or_404(description="Purchase invoice not found")
    )

    data = request.get_json() or {}

    try:
        payment_amount = float(data.get("amount", 0))
        if payment_amount <= 0:
            return jsonify({"error": "Payment amount must be greater than 0"}), 400

        current_paid = float(invoice.amount_paid or 0)
        current_balance = float(invoice.balance_due or 0)
        epsilon = 0.01  # 1 paisa tolerance

        if payment_amount > current_balance + epsilon:
            return jsonify({
                "error": "Overpayment not allowed",
                "details": f"Maximum allowed payment is ₹{current_balance:.2f}",
                "max_allowed": current_balance,
                "attempted_amount": payment_amount,
            }), 400

        # Update payment fields
        invoice.amount_paid = current_paid + payment_amount
        invoice.balance_due = max(0.0, float(invoice.total_amount) - float(invoice.amount_paid))
        if data.get("payment_mode"):
            invoice.payment_mode = data["payment_mode"]

        # Determine new payment status
        if invoice.balance_due <= 0:
            invoice.payment_status = "paid"
        elif float(invoice.amount_paid) > 0:
            invoice.payment_status = "partial"
        else:
            invoice.payment_status = "unpaid"

        # ── KEY BUSINESS RULE ────────────────────────────────────────────────
        # Credit inventory ONLY when the invoice becomes fully paid AND
        # inventory has not been updated yet for this invoice.
        inventory_just_updated = False
        if invoice.payment_status == "paid" and not invoice.inventory_updated:
            _credit_inventory(invoice)
            inventory_just_updated = True
        # ──────────────────────────────────────────────────────────────────────

        db.session.flush()
        db.session.commit()
        db.session.refresh(invoice)

        return jsonify({
            "message": (
                "Payment recorded and inventory updated successfully."
                if inventory_just_updated
                else "Payment recorded successfully. Inventory will be updated upon full payment."
            ),
            "amount_paid": float(invoice.amount_paid),
            "balance_due": float(invoice.balance_due),
            "payment_status": invoice.payment_status,
            "inventory_updated": invoice.inventory_updated,
            "inventory_just_updated": inventory_just_updated,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to record payment", "details": str(e)}), 500


# ── SOFT DELETE ───────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/<uuid:invoice_id>/delete", methods=["PUT"])
def soft_delete_purchase_invoice(invoice_id):
    """
    Soft-delete a purchase invoice.
    ---
    tags:
      - Purchase Invoices
    responses:
      200:
        description: Deleted
      404:
        description: Not found
    """
    invoice = PurchaseInvoice.query.filter_by(
        uuid=invoice_id, is_deleted=False
    ).first_or_404(description="Purchase invoice not found")

    try:
        invoice.is_deleted = True
        db.session.commit()
        return jsonify({"message": "Purchase invoice deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to delete purchase invoice", "details": str(e)}), 500


# ── DOWNLOAD PDF ──────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/<uuid:invoice_id>/pdf", methods=["GET"])
def download_purchase_invoice_pdf(invoice_id):
    """
    Download a purchase invoice as a PDF.
    ---
    tags:
      - Purchase Invoices
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
        description: Purchase invoice not found
      500:
        description: PDF generation failed
    """
    try:
        invoice = (
            PurchaseInvoice.query
            .options(selectinload(PurchaseInvoice.items))
            .filter_by(uuid=invoice_id, is_deleted=False)
            .first_or_404(description="Purchase invoice not found")
        )

        # Build items_data list
        item_ids = [i.item_id for i in invoice.items if i.item_id]
        product_map = (
            {p.id: p for p in Item.query.filter(Item.id.in_(item_ids)).all()}
            if item_ids else {}
        )

        items_data = []
        for inv_item in invoice.items:
            row = {
                "description": inv_item.description,
                "quantity": float(inv_item.quantity) if inv_item.quantity else 0,
                "unit_price": float(inv_item.unit_price) if inv_item.unit_price else 0,
                "discount": inv_item.discount or {},
                "tax": inv_item.tax or {},
                "total_price": float(inv_item.total_price) if inv_item.total_price else 0,
            }
            if inv_item.item_id and inv_item.item_id in product_map:
                p = product_map[inv_item.item_id]
                row["product_name"] = p.item_name
                row["hsn_sac_code"] = p.hsn_code
                row["measuring_unit_id"] = p.measuring_unit_id
            else:
                row["product_name"] = inv_item.description or "Item"
            items_data.append(row)

        pdf_buffer = generate_purchase_invoice_pdf(invoice, items_data)

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{invoice.invoice_number}.pdf",
        )

    except Exception as e:
        return jsonify({"error": "PDF generation failed", "details": str(e)}), 500

