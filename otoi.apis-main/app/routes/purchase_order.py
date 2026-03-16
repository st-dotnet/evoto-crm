from datetime import datetime, date
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, func, desc, asc, and_, update
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.vendor import Vendor
from app.models.inventory import Item
from app.services.pdf_service import generate_purchase_order_pdf


purchase_order_blueprint = Blueprint("purchase_order", __name__)



# ── Helpers ──────────────────────────────────────────────────────────────────

def generate_po_number():
    """Generate a unique PO number like PO-1001."""
    last = PurchaseOrder.query.order_by(PurchaseOrder.created_at.desc()).first()
    if last and last.po_number:
        try:
            last_num = int(last.po_number.split("-")[1])
            return f"PO-{last_num + 1}"
        except (IndexError, ValueError):
            pass
    return "PO-1001"


def auto_close_overdue_pos():
    """Bulk-close open POs whose delivery_date has passed."""
    today = date.today()
    result = db.session.execute(
        update(PurchaseOrder)
        .where(
            and_(
                PurchaseOrder.status == "open",
                PurchaseOrder.delivery_date <= today,
            )
        )
        .values(status="closed")
        .execution_options(synchronize_session="fetch")
    )
    if result.rowcount > 0:
        db.session.commit()
    return result.rowcount


# ── Routes ───────────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/next-number", methods=["GET"])
def get_next_po_number():
    """
    Get the next available PO number
    ---
    tags:
      - Purchase Orders
    responses:
      200:
        description: Next PO number
    """
    try:
        return jsonify({"next_po_number": generate_po_number()}), 200
    except Exception as e:
        return jsonify({"error": "Failed to generate PO number", "details": str(e)}), 500


@purchase_order_blueprint.route("/po-dropdown", methods=["GET"])
def get_po_numbers_dropdown():
    """
    Get all PO numbers for dropdown
    ---
    tags:
      - Purchase Orders
    responses:
      200:
        description: List of PO numbers
    """
    try:
        pos = (
            PurchaseOrder.query
            .with_entities(PurchaseOrder.uuid, PurchaseOrder.po_number)
            .order_by(PurchaseOrder.po_number)
            .all()
        )
        return jsonify([{"uuid": str(p.uuid), "po_number": p.po_number} for p in pos]), 200
    except Exception as e:
        return jsonify({"error": "Failed to fetch PO numbers", "details": str(e)}), 500


# ── RECENT PRICES ─────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/recent-prices", methods=["GET"])
def get_recent_purchase_prices():
    """
    Get recent purchase prices for an item from a specific vendor
    ---
    tags:
      - Purchase Orders
    parameters:
      - name: item_id
        in: query
        required: true
        type: string
        format: uuid
      - name: vendor_id
        in: query
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: List of recent purchase prices
    """
    item_id = request.args.get("item_id")
    vendor_id = request.args.get("vendor_id")
    
    if not item_id or not vendor_id:
        return jsonify({"error": "item_id and vendor_id are required"}), 400
        
    try:
        # Fetch one row per distinct PO (deduplication prevents the same edited PO
        # appearing multiple times). Use po_date as the user-visible date and
        # updated_at for ordering so the latest edit surfaces first.
        recent_items = (
            db.session.query(
                PurchaseOrderItem,
                PurchaseOrder.po_date,
                PurchaseOrder.updated_at,
            )
            .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.uuid)
            .filter(
                PurchaseOrderItem.item_id == item_id,
                PurchaseOrder.vendor_id == vendor_id,
            )
            .order_by(desc(PurchaseOrder.updated_at))
            .limit(5)
            .all()
        )

        result = []
        seen_po_ids = set()
        for poi, po_date, updated_at in recent_items:
            po_id = str(poi.purchase_order_id)
            if po_id in seen_po_ids:
                continue
            seen_po_ids.add(po_id)

            # Use po_date (user-set date on the PO form) as the display date.
            # Fall back to updated_at if po_date is missing.
            display_date = po_date or updated_at
            result.append({
                "date": display_date.isoformat() if display_date else None,
                "price": float(poi.unit_price) if poi.unit_price else 0,
            })

        return jsonify({"data": result}), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to fetch recent prices", "details": str(e)}), 500


# ── CREATE ────────────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/", methods=["POST"])
def create_purchase_order():
    """
    Create a new purchase order
    ---
    tags:
      - Purchase Orders
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - business_id
              - vendor_id
              - po_date
              - total_amount
            properties:
              business_id:
                type: integer
              vendor_id:
                type: string
                format: uuid
              po_date:
                type: string
                format: date
              delivery_date:
                type: string
                format: date
              total_amount:
                type: number
              status:
                type: string
              notes:
                type: string
              terms_and_conditions:
                type: string
              items:
                type: array
    responses:
      201:
        description: Purchase order created successfully
      400:
        description: Validation error
      500:
        description: Server error
    """
    data = request.get_json()
    try:
        po_number = data.get("po_number") or generate_po_number()

        charges = {
            "subtotal":                data.get("subtotal", 0),
            "tax_total":               data.get("total_tax", 0),
            "discount_total":          data.get("total_discount", 0),
            "additional_charges_total": data.get("additional_charges_total", 0),
            "round_off":               data.get("round_off", 0),
        }

        additional_notes = {
            "notes":                data.get("notes", ""),
            "terms_and_conditions": data.get("terms_and_conditions", ""),
            "version":              1,
        }

        po = PurchaseOrder(
            po_number=po_number,
            business_id=data["business_id"],
            vendor_id=data.get("vendor_id"),
            po_date=data["po_date"],
            delivery_date=data.get("delivery_date"),
            total_amount=data["total_amount"],
            charges=charges,
            status=data.get("status", "open"),
            additional_notes=additional_notes,
        )
        db.session.add(po)
        db.session.flush()  # get UUID before committing

        for item_data in data.get("items", []):
            discount_json = {
                "discount_percentage": item_data.get("discount", 0),
                "discount_amount":     item_data.get("discount_amount", 0),
            }
            tax_json = {
                "tax_percentage": item_data.get("tax", 0),
                "tax_amount":     item_data.get("tax_amount", 0),
            }
            poi = PurchaseOrderItem(
                purchase_order_id=po.uuid,
                item_id=item_data.get("item_id"),
                description=item_data.get("description"),
                quantity=item_data["quantity"],
                unit_price=item_data.get("unit_price") or item_data.get("price_per_item"),
                discount=discount_json,
                tax=tax_json,
                total_price=item_data.get("total_price") or item_data.get("amount"),
            )
            db.session.add(poi)

        db.session.commit()

        return jsonify({
            "message":   "Purchase order created successfully",
            "uuid":      str(po.uuid),
            "po_number": po.po_number,
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


# ── LIST ──────────────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/", methods=["GET"])
def get_purchase_orders():
    """
    Get all purchase orders with pagination, search, and filtering
    ---
    tags:
      - Purchase Orders
    parameters:
      - name: search
        in: query
        type: string
      - name: vendor_name
        in: query
        type: string
      - name: po_number
        in: query
        type: string
      - name: status
        in: query
        type: string
      - name: page
        in: query
        type: integer
      - name: per_page
        in: query
        type: integer
      - name: sort
        in: query
        type: string
      - name: order
        in: query
        type: string
      - name: vendor_dropdown_all
        in: query
        type: boolean
        description: Return all vendors that have at least one PO
    responses:
      200:
        description: Paginated list of purchase orders
    """
    try:
        # Auto-close overdue POs
        auto_close_overdue_pos()

        # ── Vendor dropdown shortcut ───────────────────────────────────────
        if request.args.get("vendor_dropdown_all") == "true":
            rows = (
                PurchaseOrder.query
                .outerjoin(Vendor, PurchaseOrder.vendor_id == Vendor.uuid)
                .with_entities(Vendor.uuid, Vendor.vendor_name, Vendor.company_name)
                .distinct()
                .all()
            )
            result = []
            for r in rows:
                if r.uuid:
                    name = r.vendor_name or r.company_name or ""
                    if name:
                        result.append({"uuid": str(r.uuid), "name": name})
            result.sort(key=lambda x: x["name"].lower())
            return jsonify(result), 200

        # ── Base query with vendor join ────────────────────────────────────
        query = PurchaseOrder.query.outerjoin(Vendor, PurchaseOrder.vendor_id == Vendor.uuid)

        search      = request.args.get("search", "").strip()
        vendor_name = request.args.get("vendor_name", "").strip()
        po_number   = request.args.get("po_number", "").strip()
        status      = request.args.get("status", "").strip()

        if search:
            query = query.filter(
                or_(
                    PurchaseOrder.po_number.ilike(f"%{search}%"),
                    Vendor.vendor_name.ilike(f"%{search}%"),
                    Vendor.company_name.ilike(f"%{search}%"),
                )
            )
        else:
            if vendor_name:
                query = query.filter(
                    or_(
                        Vendor.vendor_name.ilike(f"%{vendor_name}%"),
                        Vendor.company_name.ilike(f"%{vendor_name}%"),
                    )
                )
            if po_number:
                query = query.filter(PurchaseOrder.po_number.ilike(f"%{po_number}%"))

        if status:
            query = query.filter(PurchaseOrder.status == status)

        # ── Sorting ───────────────────────────────────────────────────────
        sort  = request.args.get("sort", "delivery_date")
        order = request.args.get("order", "asc").upper()

        sort_map = {
            "po_number":     PurchaseOrder.po_number,
            "po_date":       PurchaseOrder.po_date,
            "delivery_date": PurchaseOrder.delivery_date,
            "total_amount":  PurchaseOrder.total_amount,
            "status":        PurchaseOrder.status,
            "created_at":    PurchaseOrder.created_at,
        }
        sort_col = sort_map.get(sort, PurchaseOrder.delivery_date)
        query = query.order_by(desc(sort_col) if order == "DESC" else asc(sort_col))

        # ── Pagination ────────────────────────────────────────────────────
        page     = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page") or request.args.get("items_per_page") or 5)
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        pos = pagination.items

        # Batch-fetch vendors and purchase invoices
        vendor_ids  = [p.vendor_id for p in pos if p.vendor_id]
        vendor_map  = {v.uuid: v for v in Vendor.query.filter(Vendor.uuid.in_(vendor_ids)).all()} if vendor_ids else {}

        po_ids = [p.uuid for p in pos]
        invoice_map = {}
        if po_ids:
            from app.models.purchase_invoice import PurchaseInvoice
            # Get the most recent invoice for each PO (not deleted)
            invoices = PurchaseInvoice.query.filter(
                PurchaseInvoice.purchase_order_id.in_(po_ids),
                PurchaseInvoice.is_deleted == False
            ).all()
            for inv in invoices:
                invoice_map[inv.purchase_order_id] = {
                    "uuid": str(inv.uuid),
                    "invoice_number": inv.invoice_number,
                    "payment_status": inv.payment_status,
                    "balance_due": float(inv.balance_due)
                }

        result = []
        for p in pos:
            v = vendor_map.get(p.vendor_id)
            result.append({
                "uuid":          str(p.uuid),
                "po_number":     p.po_number,
                "po_date":       p.po_date.isoformat() if p.po_date else None,
                "delivery_date": p.delivery_date.isoformat() if p.delivery_date else None,
                "vendor_id":     str(p.vendor_id) if p.vendor_id else None,
                "vendor_name":   (v.vendor_name or v.company_name) if v else None,
                "total_amount":  float(p.total_amount) if p.total_amount else 0,
                "status":        p.status,
                "charges":       p.charges,
                "created_at":    p.created_at.isoformat() if p.created_at else None,
                "invoice":       invoice_map.get(p.uuid)
            })

        return jsonify({
            "data": result,
            "pagination": {
                "total":          pagination.total,
                "items_per_page": per_page,
                "current_page":   page,
                "last_page":      pagination.pages,
                "from":           (page - 1) * per_page + 1 if pagination.total > 0 else 0,
                "to":             min(page * per_page, pagination.total),
                "prev_page_url":  None,
                "next_page_url":  None,
                "first_page_url": None,
            },
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to fetch purchase orders", "details": str(e)}), 500


# ── GET ONE ───────────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/<uuid:po_id>", methods=["GET"])
def get_purchase_order(po_id):
    """
    Get a single purchase order by ID
    ---
    tags:
      - Purchase Orders
    parameters:
      - name: po_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Purchase order details
      404:
        description: Not found
    """
    try:
        po = (
            PurchaseOrder.query
            .options(selectinload(PurchaseOrder.items))
            .filter_by(uuid=po_id)
            .first()
        )
        if not po:
            return jsonify({"error": "Purchase order not found"}), 404

        # Batch-fetch inventory items
        item_ids = [i.item_id for i in po.items if i.item_id]
        inventory_map = {}
        if item_ids:
            inv_items = Item.query.filter(Item.id.in_(item_ids)).all()
            inventory_map = {i.id: i for i in inv_items}

        items_data = []
        for poi in po.items:
            row = {
                "uuid":        str(poi.uuid),
                "item_id":     str(poi.item_id) if poi.item_id else None,
                "description": poi.description,
                "quantity":    float(poi.quantity) if poi.quantity else 0,
                "unit_price":  float(poi.unit_price) if poi.unit_price else 0,
                "discount":    poi.discount or {},
                "tax":         poi.tax or {},
                "total_price": float(poi.total_price) if poi.total_price else 0,
            }
            if poi.item_id and poi.item_id in inventory_map:
                inv = inventory_map[poi.item_id]
                row["product_name"]      = inv.item_name
                row["hsn_sac_code"]      = inv.hsn_code
                row["measuring_unit_id"] = inv.measuring_unit_id
            items_data.append(row)

        v = po.vendor
        vendor_data = None
        if v:
            vendor_data = {
                "uuid":         str(v.uuid),
                "vendor_name":  v.vendor_name,
                "company_name": v.company_name,
                "mobile":       v.mobile,
                "email":        v.email,
                "gst":          v.gst,
                "address1":     v.address1,
                "address2":     v.address2,
                "city":         v.city,
                "state":        v.state,
                "country":      v.country,
                "pin":          v.pin,
            }

        return jsonify({
            "uuid":             str(po.uuid),
            "po_number":        po.po_number,
            "business_id":      po.business_id,
            "vendor_id":        str(po.vendor_id) if po.vendor_id else None,
            "vendor":           vendor_data,
            "po_date":          po.po_date.isoformat() if po.po_date else None,
            "delivery_date":    po.delivery_date.isoformat() if po.delivery_date else None,
            "total_amount":     float(po.total_amount) if po.total_amount else 0,
            "charges":          po.charges or {},
            "status":           po.status,
            "additional_notes": po.additional_notes or {},
            "items":            items_data,
            "created_at":       po.created_at.isoformat() if po.created_at else None,
            "updated_at":       po.updated_at.isoformat() if po.updated_at else None,
        }), 200

    except Exception as e:
        return jsonify({"error": "Failed to fetch purchase order", "details": str(e)}), 500


# ── UPDATE ────────────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/<uuid:po_id>", methods=["PUT"])
def update_purchase_order(po_id):
    """
    Update a purchase order
    ---
    tags:
      - Purchase Orders
    parameters:
      - name: po_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Purchase order updated successfully
      404:
        description: Not found
      500:
        description: Server error
    """
    data = request.get_json()
    po   = PurchaseOrder.query.get_or_404(po_id)

    try:
        if "vendor_id" in data:
            po.vendor_id = data["vendor_id"]
        if "po_date" in data:
            po.po_date = data["po_date"]
        if "delivery_date" in data:
            po.delivery_date = data["delivery_date"]
        if "total_amount" in data:
            po.total_amount = data["total_amount"]
        if "status" in data:
            po.status = data["status"]

        # Update charges JSON
        existing_charges = po.charges or {}
        po.charges = {
            "subtotal":                data.get("subtotal",                existing_charges.get("subtotal", 0)),
            "tax_total":               data.get("total_tax",               existing_charges.get("tax_total", 0)),
            "discount_total":          data.get("total_discount",          existing_charges.get("discount_total", 0)),
            "additional_charges_total": data.get("additional_charges_total", existing_charges.get("additional_charges_total", 0)),
            "round_off":               data.get("round_off",               existing_charges.get("round_off", 0)),
        }
        flag_modified(po, "charges")

        # Update additional_notes JSON — handle both flat and nested payload formats
        existing_notes = po.additional_notes or {}
        incoming_notes = data.get("additional_notes", {})
        po.additional_notes = {
            "notes":                data.get("notes", incoming_notes.get("notes", existing_notes.get("notes", ""))),
            "terms_and_conditions": data.get(
                "terms_and_conditions",
                incoming_notes.get("terms_and_conditions", existing_notes.get("terms_and_conditions", "")),
            ),
            "version": existing_notes.get("version", 0) + 1,
        }
        flag_modified(po, "additional_notes")

        # Replace items (delete + reinsert strategy — simple and reliable)
        if "items" in data:
            PurchaseOrderItem.query.filter_by(purchase_order_id=po.uuid).delete()

            for item_data in data["items"]:
                discount_json = {
                    "discount_percentage": item_data.get("discount_percentage", item_data.get("discount", 0)),
                    "discount_amount":     item_data.get("discount_amount", 0),
                }
                tax_json = {
                    "tax_percentage": item_data.get("tax_percentage", item_data.get("tax", 0)),
                    "tax_amount":     item_data.get("tax_amount", 0),
                }
                poi = PurchaseOrderItem(
                    purchase_order_id=po.uuid,
                    item_id=item_data.get("item_id"),
                    description=item_data.get("description"),
                    quantity=item_data["quantity"],
                    unit_price=item_data.get("unit_price") or item_data.get("price_per_item"),
                    discount=discount_json,
                    tax=tax_json,
                    total_price=item_data.get("total_price") or item_data.get("amount"),
                )
                db.session.add(poi)

        db.session.commit()

        return jsonify({
            "message":   "Purchase order updated successfully",
            "uuid":      str(po.uuid),
            "po_number": po.po_number,
        }), 200

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


# ── DELETE ────────────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/<uuid:po_id>", methods=["DELETE"])
def delete_purchase_order(po_id):
    """
    Delete a purchase order
    ---
    tags:
      - Purchase Orders
    parameters:
      - name: po_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Deleted successfully
      404:
        description: Not found
    """
    po = PurchaseOrder.query.get_or_404(po_id)
    try:
        db.session.delete(po)
        db.session.commit()
        return jsonify({"message": "Purchase order deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


# ── DOWNLOAD PDF ──────────────────────────────────────────────────────────────

@purchase_order_blueprint.route("/<uuid:po_id>/pdf", methods=["GET"])
def download_purchase_order_pdf(po_id):
    """
    Download a purchase order as a PDF.
    ---
    tags:
      - Purchase Orders
    parameters:
      - name: po_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: PDF file download
      404:
        description: Purchase order not found
      500:
        description: PDF generation failed
    """
    try:
        po = (
            PurchaseOrder.query
            .options(selectinload(PurchaseOrder.items))
            .filter_by(uuid=po_id)
            .first_or_404(description="Purchase order not found")
        )

        # Build items_data list
        item_ids = [i.item_id for i in po.items if i.item_id]
        product_map = (
            {p.id: p for p in Item.query.filter(Item.id.in_(item_ids)).all()}
            if item_ids else {}
        )

        items_data = []
        for poi in po.items:
            row = {
                "description": poi.description,
                "quantity":    float(poi.quantity) if poi.quantity else 0,
                "unit_price":  float(poi.unit_price) if poi.unit_price else 0,
                "discount":    poi.discount or {},
                "tax":         poi.tax or {},
                "total_price": float(poi.total_price) if poi.total_price else 0,
            }
            if poi.item_id and poi.item_id in product_map:
                p = product_map[poi.item_id]
                row["product_name"]      = p.item_name
                row["hsn_sac_code"]      = p.hsn_code
                row["measuring_unit_id"] = p.measuring_unit_id
            else:
                row["product_name"] = poi.description or "Item"
            items_data.append(row)

        pdf_buffer = generate_purchase_order_pdf(po, items_data)

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{po.po_number}.pdf",
        )

    except Exception as e:
        return jsonify({"error": "PDF generation failed", "details": str(e)}), 500

