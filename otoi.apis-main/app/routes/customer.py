from flask import Blueprint, jsonify, request
from sqlalchemy import func
from app.models.common import Address
from app.models.customer import Customer
from app.extensions import db
from sqlalchemy import func

from app.models.person import Person, PersonAddress


customer_blueprint = Blueprint("customer", __name__, url_prefix="/customers")

# GET all customers (support both with and without trailing slash)
@customer_blueprint.route("/", methods=["GET"])
def get_customers():
    # Start with a base query
    query = Customer.query

    sort = request.args.get("sort", "uuid")
    order = request.args.get("order", "asc").lower()  # asc or desc

    for field in sort.split(","):
        if field == "name":
            # Sort by concatenated first_name + last_name
            if order == "desc":
                query = query.order_by(
                    db.desc(func.concat(Customer.first_name, " ", Customer.last_name))
                )
            else:
                query = query.order_by(
                    func.concat(Customer.first_name, " ", Customer.last_name)
                )
        elif field == "gst":
            query = query.order_by(
                db.desc(Customer.gst) if order == "desc" else Customer.gst
            )
        elif field == "mobile":
            query = query.order_by(
                db.desc(Customer.mobile) if order == "desc" else Customer.mobile
            )
        else:
            # Generic field sorting
            if field.startswith("-"):
                query = query.order_by(
                    db.desc(getattr(Customer, field[1:], Customer.uuid))
                )
            else:
                query = query.order_by(
                    getattr(Customer, field, Customer.uuid)
                )

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 10))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    customers = pagination.items

    return jsonify([
        {
            "uuid": str(c.uuid),
            "person_id": str(c.person_id),
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
@customer_blueprint.route("/<uuid:person_id>", methods=["GET"])
def get_customer(person_id):
    customer = Customer.query.get_or_404(person_id)
    return jsonify({
        "uuid": str(customer.uuid),
        "person_id": str(customer.person_id), 
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


@customer_blueprint.route("/<uuid:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    # Fetch customer
    customer = Customer.query.get_or_404(customer_id)

    data = request.get_json()

    # --- Update Customer ---
    customer.first_name = data.get("first_name", customer.first_name)
    customer.last_name = data.get("last_name", customer.last_name)
    customer.mobile = data.get("mobile", customer.mobile)
    customer.email = data.get("email", customer.email)
    customer.gst = data.get("gst", customer.gst)
    customer.status = data.get("status", customer.status)

    customer.address1 = data.get("address1", customer.address1)
    customer.address2 = data.get("address2", customer.address2)
    customer.city = data.get("city", customer.city)
    customer.state = data.get("state", customer.state)
    customer.country = data.get("country", customer.country)
    customer.pin = data.get("pin", customer.pin)

    # --- Update linked Person ---
    if customer.person_id:
        person = Person.query.get(customer.person_id)
        if person:
            person.first_name = customer.first_name
            person.last_name = customer.last_name
            person.mobile = customer.mobile
            person.email = customer.email
            person.gst = customer.gst
            person.status = customer.status

            # --- Update linked Address (if exists) ---
            person_address = PersonAddress.query.filter_by(person_id=person.uuid).first()
            if person_address:
                address = Address.query.get(person_address.address_id)
                if address:
                    address.address1 = customer.address1
                    address.address2 = customer.address2
                    address.city = customer.city
                    address.state = customer.state
                    address.country = customer.country
                    address.pin = customer.pin

    db.session.commit()

    return jsonify({
        "message": "Customer (and linked Person + Address) updated successfully",
        "customer_id": str(customer.uuid),
        "person_id": str(customer.person_id),
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

