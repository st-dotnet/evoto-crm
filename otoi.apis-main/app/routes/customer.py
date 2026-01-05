from flask import Blueprint, current_app, jsonify, request
from app.models.customer import Customer
from app.models.person import Lead
from app.extensions import db
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

customer_blueprint = Blueprint("customer", __name__, url_prefix="/customers")


# GET all customers (support both with and without trailing slash)
@customer_blueprint.route("/", methods=["GET"])
def get_customers():
    """
    Get all customers.
    ---
    tags:
      - customers
    responses:
      200:
        description: A list of all customers.
        content:
          application/json:
            schema:
              type: array
    """
    query = Customer.query
    sort = request.args.get("sort", "uuid")
    order = request.args.get("order", "asc").lower()  # Extract order ('asc' or 'desc')

    for field in sort.split(","):
        if field == "name":
            # Sort by concatenated first_name and last_name
            if order == "desc":
                query = query.order_by(
                    db.desc(func.concat(Customer.first_name, " ", Customer.last_name))
                )
            else:
                query = query.order_by(
                    func.concat(Customer.first_name, " ", Customer.last_name)
                )
        if field == "gst":
            # Sort by concatenated first_name and last_name
            if order == "desc":
                query = query.order_by(db.desc(Customer.gst))
            else:
                query = query.order_by(Customer.gst)
        if field == "mobile":
            # Sort by concatenated first_name and last_name
            if order == "desc":
                query = query.order_by(db.desc(Customer.mobile))
            else:
                query = query.order_by(Customer.mobile)
        else:
            # Handle other fields
            if field.startswith("-"):
                query = query.order_by(db.desc(getattr(Customer, field[1:], "uuid")))
            else:
                query = query.order_by(getattr(Customer, field, "uuid"))

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 10))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    customers = pagination.items

    # Shape response to match frontend expectations: { data: [...], pagination: { total, ... } }
    return jsonify(
        {
            "data": [
                {
                    "id": str(c.uuid),  # alias for row key expected by frontend
                    "uuid": str(c.uuid),
                    "customer_id": str(c.uuid),
                    "first_name": c.first_name,
                    "last_name": c.last_name,
                    "mobile": c.mobile,
                    "email": c.email,
                    "gst": c.gst,
                    "status": c.status,
                    "address1": c.address1,
                    "address2": c.address2,
                    "city": c.city,
                    "state": c.state,
                    "country": c.country,
                    "pin": c.pin,
                }
                for c in customers
            ],
            "pagination": {
                "total": pagination.total,
                "items_per_page": per_page,
                "current_page": page,
                "last_page": pagination.pages,
                "from": (
                    (pagination.page - 1) * per_page + 1 if pagination.total > 0 else 0
                ),
                "to": min(pagination.page * per_page, pagination.total),
                "prev_page_url": None,
                "next_page_url": None,
                "first_page_url": None,
            },
        }
    )


# CREATE a new customer (support both with and without trailing slash)
@customer_blueprint.route("/", methods=["POST"])
def create_customer():
    """
    Create or update a customer linked to a Lead.
    If a lead_id is provided, that lead is used; otherwise we try to
    find/create a Lead based on the mobile number.
    """
    data = request.get_json() or {}

    # Basic validation
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    mobile = (data.get("mobile") or "").strip()
    email = (data.get("email") or "").strip()
    gst = (data.get("gst") or "").strip()
    status = (data.get("status") or "").strip() or "1"  # default New
    address1 = (data.get("address1") or "").strip()
    address2 = (data.get("address2") or "").strip()
    city = (data.get("city") or "").strip()
    state = (data.get("state") or "").strip()
    country = (data.get("country") or "").strip()
    pin = (data.get("pin") or "").strip()

    if not first_name or not last_name or (not mobile and not email): 
        return jsonify({
        "error": "first_name, last_name and either mobile or email are required"
    }), 400


    # Resolve lead: if lead_id is provided use it, else create/find a Lead
    lead_id = data.get("lead_id")
    lead = None
    if lead_id:
        lead = Lead.query.get(lead_id)
        if not lead:
            return jsonify({"error": "Lead not found for provided lead_id"}), 404
    else:
        lead = Lead.query.filter(Lead.mobile == mobile).first()
        if not lead:
            lead = Lead(
                first_name=first_name,
                last_name=last_name,
                mobile=mobile,
                email=email or None,
                gst=gst or None,
                status=status,
                reason=(data.get("reason") or None),
            )
            db.session.add(lead)
            db.session.flush()  # get uuid

    # If a customer uuid is provided, try to update existing
    existing_customer = None
    if data.get("uuid"):
        existing_customer = Customer.query.get(data.get("uuid"))
    if not existing_customer and lead is not None:
        # Or find by lead_id if already linked
        existing_customer = Customer.query.filter_by(lead_id=lead.uuid).first()

    if existing_customer:
        # Update existing (idempotent POST for current frontend behavior)
        existing_customer.first_name = first_name
        existing_customer.last_name = last_name
        existing_customer.mobile = mobile
        existing_customer.email = email or None
        existing_customer.gst = gst or None
        existing_customer.status = status
        existing_customer.address1 = address1
        existing_customer.address2 = address2 or None
        existing_customer.city = city
        existing_customer.state = state
        existing_customer.country = country
        existing_customer.pin = pin
        db.session.commit()

        return (
            jsonify(
                {
                    "uuid": str(existing_customer.uuid),
                    "customer_id": str(existing_customer.uuid),
                    "first_name": existing_customer.first_name,
                    "last_name": existing_customer.last_name,
                    "mobile": existing_customer.mobile,
                    "email": existing_customer.email,
                    "gst": existing_customer.gst,
                    "status": existing_customer.status,
                    "address1": existing_customer.address1,
                    "address2": existing_customer.address2,
                    "city": existing_customer.city,
                    "state": existing_customer.state,
                    "country": existing_customer.country,
                    "pin": existing_customer.pin,
                }
            ),
            200,
        )

    # Create customer record (no existing found)
    customer = Customer(
        lead_id=lead.uuid if lead is not None else None,
        first_name=first_name,
        last_name=last_name,
        mobile=mobile,
        email=email or None,
        gst=gst or None,
        status=status,
        address1=address1,
        address2=address2 or None,
        city=city,
        state=state,
        country=country,
        pin=pin,
    )
    db.session.add(customer)
    db.session.commit()

    return (
        jsonify(
            {
                "uuid": str(customer.uuid),
                "customer_id": str(customer.uuid),
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "mobile": customer.mobile,
                "email": customer.email,
                "gst": customer.gst,
                "status": customer.status,
                "address1": customer.address1,
                "address2": customer.address2,
                "city": customer.city,
                "state": customer.state,
                "country": customer.country,
                "pin": customer.pin,
            }
        ),
        201,
    )


# GET a single customer by UUID
@customer_blueprint.route("/<uuid:customer_id>", methods=["GET"])
def get_customer(customer_id):
    """
    Get customer by id.
    ---
    tags:
      - get customer by id
    responses:
      200:
        description: get customer by id .

    """
    customer = Customer.query.get_or_404(customer_id)
    return jsonify(
        {
            "uuid": str(customer.uuid),
            "customer_id": str(customer.uuid),
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "mobile": customer.mobile,
            "email": customer.email,
            "gst": customer.gst,
            "status": customer.status,
            "address1": customer.address1,
            "address2": customer.address2,
            "city": customer.city,
            "state": customer.state,
            "country": customer.country,
            "pin": customer.pin,
        }
    )


# UPDATE a customer by UUID
@customer_blueprint.route("/<uuid:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    """
    tags:
      - Update customer
    responses:
      200:
        description: update customer.

    """
    data = request.get_json() or {}
    customer = Customer.query.get_or_404(customer_id)

    # Update primitive fields safely
    customer.first_name = data.get("first_name", customer.first_name)
    customer.last_name = data.get("last_name", customer.last_name)
    customer.mobile = data.get("mobile", customer.mobile)
    customer.email = data.get("email", customer.email)
    customer.gst = data.get("gst", customer.gst)
    customer.status = data.get("status", customer.status)

    # Address fields
    customer.address1 = data.get("address1", customer.address1)
    customer.address2 = data.get("address2", customer.address2)
    customer.city = data.get("city", customer.city)
    customer.state = data.get("state", customer.state)
    customer.country = data.get("country", customer.country)
    customer.pin = data.get("pin", customer.pin)

    db.session.commit()

    return (
        jsonify(
            {
                "uuid": str(customer.uuid),
                "customer_id": str(customer.uuid),
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "mobile": customer.mobile,
                "email": customer.email,
                "gst": customer.gst,
                "status": customer.status,
                "address1": customer.address1,
                "address2": customer.address2,
                "city": customer.city,
                "state": customer.state,
                "country": customer.country,
                "pin": customer.pin,
            }
        ),
        200,
    )
 
@customer_blueprint.route("/<customer_uuid>", methods=["DELETE"])
def delete_customer(customer_uuid):
    print(f"Delete request received for customer: {customer_uuid}")
    try:
        customer = Customer.query.filter_by(uuid=customer_uuid).first()
        if not customer:
            return jsonify({"message": "Customer not found"}), 404

        db.session.delete(customer)
        db.session.commit()

        return jsonify({"message": "Customer deleted successfully"}), 200

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({
            "message": "Cannot delete customer. It is referenced in other records."
        }), 409

    except Exception as e:
        db.session.rollback()
        print(str(e))
        return jsonify({
            "message": "Internal server error",
            "error": str(e)
        }), 500

 