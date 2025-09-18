from flask import Blueprint, jsonify, request
from app.models.customer import Customer
from app.extensions import db
from sqlalchemy import func

customer_blueprint = Blueprint("customer", __name__, url_prefix="/customers")

# GET all customers (support both with and without trailing slash)
@customer_blueprint.route("/", methods=["GET"])
def get_customers():
    query = Customer.query
    sort = request.args.get("sort", "uuid")
    order = request.args.get("order", "asc").lower()  # Extract order ('asc' or 'desc')

    for field in sort.split(","):
      if field == "name":
          # Sort by concatenated first_name and last_name
          if order == "desc":
              query = query.order_by(db.desc(func.concat(Customer.first_name, " ", Customer.last_name)))
          else:
              query = query.order_by(func.concat(Customer.first_name, " ", Customer.last_name))      
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
    return jsonify({
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
            "from": (pagination.page - 1) * per_page + 1 if pagination.total > 0 else 0,
            "to": min(pagination.page * per_page, pagination.total),
            "prev_page_url": None,
            "next_page_url": None,
            "first_page_url": None,
        }
    })

# GET a single customer by UUID
@customer_blueprint.route("/<uuid:customer_id>", methods=["GET"])
def get_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    return jsonify({
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
    })

# UPDATE a customer by UUID
@customer_blueprint.route("/<uuid:customer_id>", methods=["PUT"])
def update_customer(customer_id):
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

    return jsonify({
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
    }), 200
