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

# CREATE a new customer (support both with and without trailing slash)
@customer_blueprint.route("/", methods=["POST"])
def create_customer():
    from app.models.person import Person, PersonType  # local import to avoid cycles
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

    if not first_name or not last_name or not mobile:
        return jsonify({"error": "first_name, last_name and mobile are required"}), 400

    # Resolve person_id: if provided use it, else create/find a Person
    person_id = data.get("person_id")
    person = None
    if person_id:
        person = Person.query.get(person_id)
        if not person:
            return jsonify({"error": "Person not found for provided person_id"}), 404
    else:
        # Try to find existing person by mobile, else create
        person = Person.query.filter(Person.mobile == mobile).first()
        if not person:
            # Determine Customer person type (id or name)
            person_type = None
            if data.get("person_type_id"):
                person_type = PersonType.query.filter_by(id=data.get("person_type_id")).first()
            if not person_type:
                person_type = PersonType.query.filter(PersonType.name.ilike("customer")).first()

            person = Person(
                first_name=first_name,
                last_name=last_name,
                mobile=mobile,
                email=email or None,
                gst=gst or None,
                status=status,
                reason=(data.get("reason") or None),
                person_type_id=person_type.id if person_type else None,
            )
            db.session.add(person)
            db.session.flush()  # get uuid

    # If a customer uuid is provided, try to update existing
    existing_customer = None
    if data.get("uuid"):
        existing_customer = Customer.query.get(data.get("uuid"))
    if not existing_customer:
        # Or find by person_id if already linked
        existing_customer = Customer.query.filter_by(person_id=person.uuid).first()

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

        return jsonify({
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
        }), 200

    # Create customer record (no existing found)
    customer = Customer(
        person_id=person.uuid,
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
    }), 201

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
