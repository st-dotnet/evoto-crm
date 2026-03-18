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
from flask import Blueprint, request, jsonify, send_file, g
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


def _debit_inventory(invoice: PurchaseInvoice) -> None:
    """
    Decrease opening_stock for each Product item on the invoice.
    Called if an invoice that was previously fully-paid is updated/deleted.
    """
    if not invoice.inventory_updated:
        return
    for inv_item in invoice.items:
        if not inv_item.item_id:
            continue
        product = Item.query.get(inv_item.item_id)
        if product and product.opening_stock is not None:
            product.opening_stock = float(product.opening_stock or 0) - float(inv_item.quantity)
    invoice.inventory_updated = False


def _serialize_item(inv_item: PurchaseInvoiceItem, product_map: dict) -> dict:
    discount_data = inv_item.discount or {}
    tax_data = inv_item.tax or {}
    row = {
        "uuid": str(inv_item.uuid),
        "item_id": str(inv_item.item_id) if inv_item.item_id else None,
        "description": inv_item.description,
        "quantity": float(inv_item.quantity) if inv_item.quantity else 0,
        "unit_price": float(inv_item.unit_price) if inv_item.unit_price else 0,
        "discount": discount_data,
        "discount_percentage": float(discount_data.get("discount_percentage") or 0),
        "discount_amount": float(discount_data.get("discount_amount") or 0),
        "tax": tax_data,
        "tax_percentage": float(tax_data.get("tax_percentage") or 0),
        "tax_amount": float(tax_data.get("tax_amount") or 0),
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
        invoice_number = data.get("invoice_number") or data.get("purchase_invoice_number") or _generate_invoice_number()
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
        payment_discount = float(data.get("payment_discount") or data.get("discount") or 0)
        balance_due = total_amount - amount_paid - payment_discount

        invoice = PurchaseInvoice(
            invoice_number=invoice_number,
            vendor_id=data.get("vendor_id"),
            business_id=business_id,
            invoice_date=invoice_date,
            due_date=due_date,
            total_amount=total_amount,
            amount_paid=amount_paid,
            payment_discount=payment_discount,
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
            item_id = item.get("item_id")
            if not item_id:
                continue
                
            unit_price = round(float(item.get("unit_price") or item.get("price_per_item") or 0), 2)
            quantity = float(item.get("quantity") or 0)
            
            # Format discount
            discount = item.get("discount")
            if not isinstance(discount, dict):
                discount = {
                    "discount_percentage": float(item.get("discount_percentage") or item.get("discount") or 0),
                    "discount_amount": float(item.get("discount_amount") or 0)
                }
            
            # Format tax
            tax = item.get("tax")
            if not isinstance(tax, dict):
                tax = {
                    "tax_percentage": float(item.get("tax_percentage") or item.get("tax") or 0),
                    "tax_amount": float(item.get("tax_amount") or 0)
                }

            pi_item = PurchaseInvoiceItem(
                item_id=item_id,
                description=item.get("description"),
                quantity=quantity,
                unit_price=unit_price,
                discount=discount,
                tax=tax,
                total_price=round(float(item.get("total_price") or item.get("amount") or 0), 2),
            )
            invoice.items.append(pi_item)

        # ── KEY BUSINESS RULE ────────────────────────────────────────────────
        # Credit inventory ONLY when the invoice becomes fully paid AND
        # inventory has not been updated yet for this invoice.
        if invoice.payment_status == "paid" and not invoice.inventory_updated:
             _credit_inventory(invoice)
        # ──────────────────────────────────────────────────────────────────────

        # Create a PaymentOut record if there's an initial payment
        if amount_paid > 0 or payment_discount > 0:
            from app.models.paymentOut import PaymentOut
            from app.routes.payment_out import generate_payment_out_number
            from datetime import date
            
            vendor = Vendor.query.get(invoice.vendor_id) if invoice.vendor_id else None
            party_name = vendor.vendor_name if vendor else "Initial Payment"
            
            po_record = PaymentOut(
                payment_number      = generate_payment_out_number(),
                payment_date        = date.today(),
                purchase_invoice_id = invoice.uuid,
                party_name          = party_name,
                invoice_number      = invoice.invoice_number,
                total_amount        = float(invoice.total_amount or 0),
                amount_paid         = amount_paid,
                balance_due         = round(balance_due, 2),
                discount            = payment_discount,
                payment_status      = invoice.payment_status,
                payment_mode        = data.get("payment_mode", "cash"),
                payment_notes       = "Initial payment during invoice creation",
                business_id         = invoice.business_id,
                created_by          = getattr(g, "current_user_id", None),
            )
            db.session.add(po_record)

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





# ── UPDATE ───────────────────────────────────────────────────────────────────

@purchase_invoice_blueprint.route("/<uuid:invoice_id>", methods=["PUT"])
def update_purchase_invoice(invoice_id):
    """
    Update an existing purchase invoice.
    """
    invoice = (
        PurchaseInvoice.query
        .options(selectinload(PurchaseInvoice.items))
        .filter_by(uuid=invoice_id, is_deleted=False)
        .first_or_404(description="Purchase invoice not found")
    )

    data = request.get_json() or {}

    try:
        # 0. Update invoice number if provided
        if "invoice_number" in data or "purchase_invoice_number" in data:
            invoice.invoice_number = data.get("invoice_number") or data.get("purchase_invoice_number")

        # 1. Reverse inventory if it was already updated
        if invoice.inventory_updated:
            _debit_inventory(invoice)

        # 2. Update basic fields
        if "vendor_id" in data:
            invoice.vendor_id = data["vendor_id"]
        if "invoice_date" in data:
            invoice.invoice_date = datetime.strptime(data["invoice_date"], "%Y-%m-%d").date()
        if "due_date" in data:
            invoice.due_date = datetime.strptime(data["due_date"], "%Y-%m-%d").date()
        
        invoice.additional_notes = {
            "notes": data.get("notes", invoice.additional_notes.get("notes", "")),
            "terms_and_conditions": data.get("terms_and_conditions", invoice.additional_notes.get("terms_and_conditions", "")),
        }

        # 3. Update items if provided
        if "items" in data:
            # Delete old items
            for old_item in list(invoice.items):
                db.session.delete(old_item)
            
            # Add new items
            for item in data["items"]:
                unit_price = float(item.get("unit_price") or item.get("price_per_item") or 0)
                quantity = float(item.get("quantity") or 0)
                
                # Format discount
                discount = item.get("discount")
                if not isinstance(discount, dict):
                    discount = {
                        "discount_percentage": float(item.get("discount_percentage") or item.get("discount") or 0),
                        "discount_amount": float(item.get("discount_amount") or 0)
                    }
                
                # Format tax
                tax = item.get("tax")
                if not isinstance(tax, dict):
                    tax = {
                        "tax_percentage": float(item.get("tax_percentage") or item.get("tax") or 0),
                        "tax_amount": float(item.get("tax_amount") or 0)
                    }

                new_item = PurchaseInvoiceItem(
                    item_id=item.get("item_id"),
                    description=item.get("description"),
                    quantity=quantity,
                    unit_price=round(unit_price, 2),
                    discount=discount,
                    tax=tax,
                    total_price=round(float(item.get("total_price") or item.get("amount") or 0), 2),
                )
                invoice.items.append(new_item)

        # 4. Update Financials
        invoice.total_amount = float(data.get("total_amount", invoice.total_amount))
        # Keep amount_paid as is unless explicitly provided (usually handled by record-payment)
        if "amount_paid" in data:
            invoice.amount_paid = float(data["amount_paid"])
        if "payment_discount" in data or "discount" in data:
            invoice.payment_discount = float(data.get("payment_discount") or data.get("discount"))
        
        invoice.balance_due = max(0.0, float(invoice.total_amount) - float(invoice.amount_paid) - float(invoice.payment_discount))
        invoice.charges = {
            "additional_charges": data.get("additional_charges", (invoice.charges or {}).get("additional_charges", 0)),
            "overall_discount": data.get("overall_discount", (invoice.charges or {}).get("overall_discount", 0)),
            "round_off": data.get("round_off", (invoice.charges or {}).get("round_off", 0)),
        }

        # 5. Update Payment Status
        if invoice.balance_due <= 0:
            invoice.payment_status = "paid"
        elif float(invoice.amount_paid) > 0:
            invoice.payment_status = "partial"
        else:
            invoice.payment_status = "unpaid"

        # 6. Re-apply inventory if status is now "paid"
        if invoice.payment_status == "paid" and not invoice.inventory_updated:
            _credit_inventory(invoice)

        db.session.commit()

        return jsonify({
            "message": "Purchase Invoice updated successfully",
            "invoice_uuid": str(invoice.uuid),
            "payment_status": invoice.payment_status,
            "inventory_updated": invoice.inventory_updated
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to update purchase invoice", "details": str(e)}), 500


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

