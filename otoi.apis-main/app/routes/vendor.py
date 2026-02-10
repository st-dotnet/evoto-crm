from sqlite3 import IntegrityError
from flask import Blueprint, jsonify, request
from app.models.vendor import Vendor
from app.extensions import db
from sqlalchemy import func, or_

vendor_blueprint = Blueprint("vendor", __name__, url_prefix="/vendors")

# GET all vendors (support both with and without trailing slash)
@vendor_blueprint.route("/", methods=["GET"])
def get_vendors():
    query = Vendor.query

    # Basic filtering by a generic query term
    q = (request.args.get("query") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Vendor.company_name.ilike(like),
                Vendor.vendor_name.ilike(like),
                Vendor.email.ilike(like),
                Vendor.mobile.ilike(like),
                Vendor.gst.ilike(like),
            )
        )
    sort = request.args.get("sort", "uuid")
    order = request.args.get("order", "asc").lower()

    for field in sort.split(","):
        if field == "company_name":
            if order == "desc":
                query = query.order_by(db.desc(Vendor.company_name))
            else:
                query = query.order_by(Vendor.company_name)
        elif field == "vendor_name":
            if order == "desc":
                query = query.order_by(db.desc(Vendor.vendor_name))
            else:
                query = query.order_by(Vendor.vendor_name)
        elif field == "mobile":
            if order == "desc":
                query = query.order_by(db.desc(Vendor.mobile))
            else:
                query = query.order_by(Vendor.mobile)
        elif field == "gst":
            if order == "desc":
                query = query.order_by(db.desc(Vendor.gst))
            else:
                query = query.order_by(Vendor.gst)
        else:
            if field.startswith("-"):
                query = query.order_by(db.desc(getattr(Vendor, field[1:], "uuid")))
            else:
                query = query.order_by(getattr(Vendor, field, "uuid"))
    # Return all vendors for dropdown if requested
    if request.args.get("dropdown") == "true":
        return jsonify([
            {
                "uuid": str(v.uuid),
                "name": f"{v.company_name}".strip() # Use company_name as the display name for dropdown because vendor_name is optional and may be None
            }
            for v in query.all()
        ])

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 5))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    vendors = pagination.items

    return jsonify({
        "data": [
            {
                "id": str(v.uuid),
                "uuid": str(v.uuid),
                "company_name": v.company_name,
                "vendor_name": v.vendor_name,
                "mobile": v.mobile,
                "email": v.email,
                "gst": v.gst,
                "address1": v.address1,
                "address2": v.address2,
                "city": v.city,
                "state": v.state,
                "country": v.country,
                "pin": v.pin,
            }
            for v in vendors
        ],
        "pagination": {
            "total": pagination.total,
            "items_per_page": per_page,
            "current_page": page,
            "last_page": pagination.pages,
            "from": (pagination.page - 1) * per_page + 1 if pagination.total > 0 else 0,
            "to": min(pagination.page * per_page, pagination.total),
            "prev_page_url": None,
            "next_page_url": None,
            "first_page_url": None,
        }
    })

# GET a single vendor by UUID
@vendor_blueprint.route("/<uuid:vendor_id>", methods=["GET"])
def get_vendor(vendor_id):
    vendor = Vendor.query.get_or_404(vendor_id)
    return jsonify({
        "uuid": str(vendor.uuid),
        "company_name": vendor.company_name,
        "vendor_name": vendor.vendor_name,
        "mobile": vendor.mobile,
        "email": vendor.email,
        "gst": vendor.gst,
        "address1": vendor.address1,
        "address2": vendor.address2,
        "city": vendor.city,
        "state": vendor.state,
        "country": vendor.country,
        "pin": vendor.pin,
    })

# CREATE a new vendor
@vendor_blueprint.route("/", methods=["POST"])
def create_vendor():
    data = request.get_json() or {}

    company_name = (data.get("company_name") or "").strip()
    vendor_name = (data.get("vendor_name") or "").strip() or None
    mobile = (data.get("mobile") or "").strip() or None
    email = (data.get("email") or "").strip() or None
    gst = (data.get("gst") or "").strip() or None
    address1 = (data.get("address1") or "").strip()
    address2 = (data.get("address2") or "").strip() or None
    city = (data.get("city") or "").strip()
    state = (data.get("state") or "").strip()
    country = (data.get("country") or "").strip()
    pin = (data.get("pin") or "").strip()

    # ---------- REQUIRED FIELD VALIDATION ----------
    if not company_name or not address1 or not city or not state or not country or not pin or not gst:
        return jsonify({
            "error": "company_name, address1, gst, city, state, country, and pin are required"
        }), 400

    # ---------- MOBILE OR EMAIL REQUIRED ----------
    if not mobile and not email:
        return jsonify({
            "error": "Either mobile or email is required"
        }), 400
    
    # ---------- DUPLICATE GST CHECK ----------
    if gst:
        gst_upper = gst.strip().upper()
        duplicate = Vendor.query.filter(func.upper(Vendor.gst) == gst_upper).first()
        if duplicate:
            return jsonify({
                "error": "A vendor with this GST already exists"
            }), 400

    # ---------- DUPLICATE MOBILE CHECK ----------
    if mobile and Vendor.query.filter(Vendor.mobile == mobile).first():
        return jsonify({"error": "Mobile number already exists"}), 400

    vendor = Vendor(
        company_name=company_name,
        vendor_name=vendor_name,
        mobile=mobile,
        email=email,
        gst=gst,
        address1=address1,
        address2=address2,
        city=city,
        state=state,
        country=country,
        pin=pin,
    )

    try:
        db.session.add(vendor)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Duplicate mobile or GST"}), 400

    return jsonify({
        "uuid": str(vendor.uuid),
        "company_name": vendor.company_name,
        "vendor_name": vendor.vendor_name,
        "mobile": vendor.mobile,
        "email": vendor.email,
        "gst": vendor.gst,
        "address1": vendor.address1,
        "address2": vendor.address2,
        "city": vendor.city,
        "state": vendor.state,
        "country": vendor.country,
        "pin": vendor.pin,
    }), 201

# UPDATE a vendor by UUID
@vendor_blueprint.route("/<uuid:vendor_id>", methods=["PUT"])
def update_vendor(vendor_id):
    data = request.get_json() or {}
    vendor = Vendor.query.get_or_404(vendor_id)

    company_name = (data.get("company_name") or vendor.company_name).strip()
    # vendor_name is optional: allow clearing to None; if omitted, keep existing
    if "vendor_name" in data:
        vendor_name = (data.get("vendor_name") or "").strip() or None
    else:
        vendor_name = vendor.vendor_name
    if "mobile" in data:
        mobile = (data.get("mobile") or "").strip() or None
    else:
        mobile = vendor.mobile
    if "email" in data:
        email = (data.get("email") or "").strip() or None
    else:
        email = vendor.email
    gst = (data.get("gst") or "").strip() or vendor.gst
    address1 = (data.get("address1") or vendor.address1).strip()
    # address2 is optional: allow clearing to None; if omitted, keep existing
    if "address2" in data:
        address2 = (data.get("address2") or "").strip() or None
    else:
        address2 = vendor.address2
    city = (data.get("city") or vendor.city).strip()
    state = (data.get("state") or vendor.state).strip()
    country = (data.get("country") or vendor.country).strip()
    pin = (data.get("pin") or vendor.pin).strip()

    # ---------- REQUIRED FIELD VALIDATION ----------
    if not company_name or not address1 or not city or not state or not country or not pin or not gst:
        return jsonify({
            "error": "company_name, address1, gst, city, state, country, and pin are required"
        }), 400

    # ---------- MOBILE OR EMAIL REQUIRED ----------
    if not mobile and not email:
        return jsonify({
            "error": "Either mobile or email is required"
        }), 400

    # ---------- DUPLICATE MOBILE CHECK ----------
    if mobile:
        duplicate = Vendor.query.filter(Vendor.mobile == mobile).first()
        if duplicate and duplicate.uuid != vendor.uuid:
            return jsonify({
                "error": "A vendor with this mobile already exists"
            }), 400

    # ---------- DUPLICATE GST CHECK ----------
    if gst:
        gst_upper = gst.strip().upper()
        duplicate = Vendor.query.filter(func.upper(Vendor.gst) == gst_upper).first()
        if duplicate and duplicate.uuid != vendor.uuid:
            return jsonify({
                "error": "A vendor with this GST already exists"
            }), 400

    vendor.company_name = company_name
    vendor.vendor_name = vendor_name
    vendor.mobile = mobile
    vendor.email = email
    vendor.gst = gst
    vendor.address1 = address1
    vendor.address2 = address2
    vendor.city = city
    vendor.state = state
    vendor.country = country
    vendor.pin = pin
    
    db.session.commit()
    
    return jsonify({
        "uuid": str(vendor.uuid),
        "company_name": vendor.company_name,
        "vendor_name": vendor.vendor_name,
        "mobile": vendor.mobile,
        "email": vendor.email,
        "gst": vendor.gst,
        "address1": vendor.address1,
        "address2": vendor.address2,
        "city": vendor.city,
        "state": vendor.state,
        "country": vendor.country,
        "pin": vendor.pin,
    }), 200



@vendor_blueprint.route("/<uuid:vendor_id>", methods=["DELETE"])
def delete_vendor(vendor_id):
    ...

    vendor = Vendor.query.get_or_404(vendor_id)
    db.session.delete(vendor)
    db.session.commit()
    return jsonify({"message": "Vendor deleted successfully"}), 200 