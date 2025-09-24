from flask import Blueprint, jsonify, request
from app.models.vendor import Vendor
from app.extensions import db
from sqlalchemy import func, or_

vendor_blueprint = Blueprint("vendor", __name__, url_prefix="/vendors")

# GET all vendors (support both with and without trailing slash)
@vendor_blueprint.route("/", methods=["GET"])
@vendor_blueprint.route("", methods=["GET"])
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

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 10))
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

# CREATE a new vendor (support both with and without trailing slash)
@vendor_blueprint.route("/", methods=["POST"])
@vendor_blueprint.route("", methods=["POST"])
def create_vendor():
    data = request.get_json() or {}
    company_name = (data.get("company_name") or "").strip()
    vendor_name = (data.get("vendor_name") or "").strip()
    mobile = (data.get("mobile") or "").strip()
    email = (data.get("email") or "").strip() or None
    gst = (data.get("gst") or "").strip() or None
    address1 = (data.get("address1") or "").strip()
    address2 = (data.get("address2") or "").strip() or None
    city = (data.get("city") or "").strip()
    state = (data.get("state") or "").strip()
    country = (data.get("country") or "").strip()
    pin = (data.get("pin") or "").strip()

    if not company_name  or not mobile or not city or not state or not country or not pin:
        return jsonify({"error": "company_name, mobile, city, state, country, pin are required"}), 400

    existing_vendor = None
    if data.get("uuid"):
        existing_vendor = Vendor.query.get(data.get("uuid"))
    if not existing_vendor:
        existing_vendor = Vendor.query.filter_by(mobile=mobile).first()

    if existing_vendor:
        existing_vendor.company_name = company_name
        existing_vendor.vendor_name = vendor_name
        existing_vendor.mobile = mobile
        existing_vendor.email = email
        existing_vendor.gst = gst
        existing_vendor.address1 = address1
        existing_vendor.address2 = address2
        existing_vendor.city = city
        existing_vendor.state = state
        existing_vendor.country = country
        existing_vendor.pin = pin
        db.session.commit()
        return jsonify({
            "uuid": str(existing_vendor.uuid),
            "company_name": existing_vendor.company_name,
            "vendor_name": existing_vendor.vendor_name,
            "mobile": existing_vendor.mobile,
            "email": existing_vendor.email,
            "gst": existing_vendor.gst,
            "address1": existing_vendor.address1,
            "address2": existing_vendor.address2,
            "city": existing_vendor.city,
            "state": existing_vendor.state,
            "country": existing_vendor.country,
            "pin": existing_vendor.pin,
        }), 200

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
    db.session.add(vendor)
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
    }), 201

# UPDATE a vendor by UUID
@vendor_blueprint.route("/<uuid:vendor_id>", methods=["PUT"])
def update_vendor(vendor_id):
    data = request.get_json() or {}
    vendor = Vendor.query.get_or_404(vendor_id)
    vendor.company_name = data.get("company_name", vendor.company_name)
    vendor.vendor_name = data.get("vendor_name", vendor.vendor_name)
    vendor.mobile = data.get("mobile", vendor.mobile)
    vendor.email = data.get("email", vendor.email)
    vendor.gst = data.get("gst", vendor.gst)
    vendor.address1 = data.get("address1", vendor.address1)
    vendor.address2 = data.get("address2", vendor.address2)
    vendor.city = data.get("city", vendor.city)
    vendor.state = data.get("state", vendor.state)
    vendor.country = data.get("country", vendor.country)
    vendor.pin = data.get("pin", vendor.pin)
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
