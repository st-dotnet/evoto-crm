from flask import Blueprint, jsonify, request
from app.models.customer import Customer
from app.extensions import db

customer_blueprint = Blueprint("customers", __name__)

# GET all customers
@customer_blueprint.route("/", methods=["GET"])
def get_customers():
    customers = Customer.query.all()
    print("=== DEBUG Update Incoming Data ===", customers)
    sort = request.args.get("sort", "uuid")
    order = request.args.get("order", "asc")  # Extract order ('asc' or 'desc')

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

    return jsonify([
        {
            "uuid": str(c.uuid),
            "Customer_id": str(c.Customer_id),
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
    ])

# GET a single customer by UUID
@customer_blueprint.route("/<uuid:customer_id>", methods=["GET"])
def get_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    return jsonify({
        "uuid": str(customer.uuid),
        "Customer_id": str(customer.Customer_id),
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
