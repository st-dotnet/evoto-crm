from flask import Blueprint, current_app, jsonify, request
from app.models.customer import Customer
from app.models.person import Lead
from app.extensions import db
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException
from flask import send_file
from io import BytesIO
from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation
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
    query = Customer.query.filter_by(is_deleted=False)

    # Search query filter
    if "query" in request.args:
        query_value = request.args.get("query", "").strip()
        if query_value:
            query = query.filter(
                or_(
                    Customer.first_name.ilike(f"%{query_value}%"),
                    Customer.last_name.ilike(f"%{query_value}%"),
                    func.concat(Customer.first_name, " ", Customer.last_name).ilike(f"%{query_value}%"), #For search customer by dropdown
                    Customer.email.ilike(f"%{query_value}%"),
                    Customer.mobile.ilike(f"%{query_value}%"),
                    Customer.gst.ilike(f"%{query_value}%"),
                )
            )

    sort = request.args.get("sort", "created_at")  # Default sort by created_at
    order = request.args.get("order", "desc").upper()  # Default order is now 'desc'

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

    # Return all customers for dropdown if requested
    if request.args.get("dropdown") == "true":
        return jsonify([
            {
                "uuid": str(c.uuid),
                "name": f"{c.first_name} {c.last_name}".strip()
            }
            for c in query.all()
        ])

    # Paginated results for the main grid
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 5))
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

# CREATE a new customer
@customer_blueprint.route("/", methods=["POST"])
def create_customer():
    data = request.get_json() or {}

    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    mobile = (data.get("mobile") or "").strip() or None
    email = (data.get("email") or "").strip() or None
    gst = (data.get("gst") or "").strip() or None
    status = (data.get("status") or "").strip() or "1"
    address1 = (data.get("address1") or "").strip()
    address2 = (data.get("address2") or "").strip() or None
    city = (data.get("city") or "").strip()
    state = (data.get("state") or "").strip()
    country = (data.get("country") or "").strip()
    pin = (data.get("pin") or "").strip()
    uuid_to_ignore = data.get("uuid")  # For updates

    # Validate required fields
    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400

    if not mobile and not email:
        return jsonify({"error": "Either mobile or email is required"}), 400

    # -------------------
    # DUPLICATE CHECKS
    # -------------------
    if mobile:
        query = Customer.query.filter(Customer.mobile == mobile, Customer.is_deleted == False)
        if uuid_to_ignore:
            query = query.filter(Customer.uuid != uuid_to_ignore)
        existing_mobile = query.first()
        if existing_mobile:
            return (
                jsonify({"error": "Customer with this mobile number already exists"}),
                400,
            )

    if gst and gst.strip():  # Check if GST is provided and not empty
        gst = gst.strip().upper()  # Normalize GST to uppercase
        gst_query = Customer.query.filter(func.upper(Customer.gst) == gst, Customer.is_deleted == False)
        if uuid_to_ignore:
            gst_query = gst_query.filter(Customer.uuid != uuid_to_ignore)
        existing_gst = gst_query.first()
        if existing_gst:
            return (
                jsonify({"error": "Customer with this GST number already exists"}),
                400,
            )

    # -------------------
    # RESOLVE LEAD
    # -------------------
    lead_id = data.get("lead_id")
    lead = None
    if lead_id:
        lead = Lead.query.filter_by(uuid=lead_id, is_deleted=False).first()
        if not lead:
            return jsonify({"error": "Lead not found for provided lead_id"}), 404
    else:
        # Only create/find lead if we have either mobile or email
        if mobile or email:
            # Try to find existing lead by mobile or email
            if mobile:
                lead = Lead.query.filter(Lead.mobile == mobile, Lead.is_deleted == False).first()
            if not lead and email:
                lead = Lead.query.filter(Lead.email == email, Lead.is_deleted == False).first()

            # If no existing lead found, create a new one
            if not lead:
                # This check is redundant since we already validated this at the start

                lead_data = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "gst": gst,
                    "status": status,
                    "reason": (data.get("reason") or None),
                }

                # Only add mobile/email if they are provided
                if mobile:
                    lead_data["mobile"] = mobile
                if email:
                    lead_data["email"] = email

                lead = Lead(**lead_data)
                db.session.add(lead)
                try:
                    db.session.flush()
                except Exception as e:
                    db.session.rollback()
                    return jsonify({"error": f"Failed to create lead: {str(e)}"}), 400
        else:
            return jsonify({"error": "Either mobile or email is required"}), 400

    # -------------------
    # UPDATE EXISTING CUSTOMER IF UUID PROVIDED
    # -------------------
    existing_customer = None
    if uuid_to_ignore:
        existing_customer = Customer.query.get(uuid_to_ignore)

    if existing_customer:
        existing_customer.first_name = first_name
        existing_customer.last_name = last_name
        existing_customer.mobile = mobile
        existing_customer.email = email
        existing_customer.gst = gst
        existing_customer.status = status
        existing_customer.address1 = address1
        existing_customer.address2 = address2
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

    # -------------------
    # CREATE NEW CUSTOMER
    # -------------------
    customer = Customer(
        lead_id=lead.uuid if lead else None,
        first_name=first_name,
        last_name=last_name,
        mobile=mobile,
        email=email,
        gst=gst,
        status=status,
        address1=address1,
        address2=address2,
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
    customer = Customer.query.filter_by(uuid=customer_id, is_deleted=False).first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
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
# UPDATE an existing customer
@customer_blueprint.route("/<uuid:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    try:
        data = request.get_json() or {}
        current_app.logger.info(f"Starting update for customer ID: {customer_id}")
        current_app.logger.info(f"Received data: {data}")

        customer = Customer.query.filter_by(uuid=customer_id, is_deleted=False).first()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        status = str(data.get("status", customer.status))
        # ---------------- DUPLICATE CHECKS ----------------
        if "mobile" in data and data["mobile"]:
            mobile = str(data["mobile"]).strip()
            if mobile != customer.mobile:  # Only check if mobile is being changed
                existing = Customer.query.filter(
                    Customer.mobile == mobile,
                    Customer.uuid != customer_id,
                    Customer.is_deleted == False
                ).first()
                if existing:
                    return jsonify({"error": "Customer with this mobile number already exists"}), 400

        if "gst" in data and data["gst"]:
            gst = str(data["gst"]).strip().upper()
            if gst != (customer.gst or "").upper():  # Only check if GST is being changed
                existing = Customer.query.filter(
                    func.upper(Customer.gst) == gst,
                    Customer.uuid != customer_id,
                    Customer.is_deleted == False
                ).first()
                if existing:
                    return jsonify({"error": "Customer with this GST number already exists"}), 400

        # ---------------- BASIC FIELDS ----------------
        basic_fields = ["first_name", "last_name", "mobile", "email", "gst", "status"]
        for field in basic_fields:
            if field in data:
                value = str(data[field]).strip() if data[field] is not None else None
                if field in ["first_name", "last_name"] and not value:
                    return jsonify({"error": f"Field '{field}' is required and cannot be empty"}), 400
                setattr(customer, field, value)

        # ---------------- ADDRESS UPDATE ---------------

        # ---------------- 🔥 NORMALIZATION (CRITICAL FIX) ----------------
        # Match deployed behavior: NEVER save NULL for NOT NULL columns
        for field in ["address1", "city", "state", "country", "pin"]:
            if getattr(customer, field) is None:
                setattr(customer, field, "")

        # address2 can remain NULL (allowed)
        if customer.address2 is None:
            customer.address2 = None

        # ---------------- COMMIT ----------------
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

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(str(e))
        return jsonify({"error": "Database constraint violation"}), 400

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(str(e))
        return jsonify({"error": "Unexpected error while updating customer"}), 500

# Delete a customer (soft delete)
@customer_blueprint.route("/<uuid:customer_id>", methods=["DELETE"])
def delete_customer(customer_id):
    try:
        customer = Customer.query.filter_by(uuid=customer_id, is_deleted=False).first()
        if not customer:
            return jsonify({"message": "Customer not found"}), 404

        customer.is_deleted = True
        db.session.commit()

        return jsonify({"message": "Customer soft-deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        print(str(e))
        return jsonify({"message": "Internal server error", "error": str(e)}), 500


@customer_blueprint.route("/download-template", methods=["GET"])
def download_customer_template():
    try:
    
        statuses = ["New", "In-progress", "Quote Given", "Win", "Lose"]      
        wb = Workbook()
        ws = wb.active
        ws.title = "Customers"

        columns = [
            "first_name",     # A
            "last_name",      # B
            "mobile",         # C
            "email",          # D
            "gst",            # E
            "status",         # F
            "address1",       # G
            "address2",       # H
            "city",           # I
            "state",          # J
            "country",        # K
            "pin",            # L
        ]
        ws.append(columns)

        ws_hidden = wb.create_sheet("DropdownData")
        for i, value in enumerate(statuses, start=1):
            ws_hidden[f"A{i}"] = value
        ws_hidden.sheet_state = "hidden"

        dv_status = DataValidation(
            type="list",
            formula1="=DropdownData!$A$1:$A$5",
            allow_blank=False,
            showErrorMessage=True,
            error="Select a valid status"
        )
        ws.add_data_validation(dv_status)
        dv_status.add("F2:F1000")

        dv_mobile = DataValidation(
            type="custom",
            formula1='=OR(ISBLANK(C2),AND(ISNUMBER(C2),LEN(C2)=10))',
            showErrorMessage=True,
            error="Mobile must be exactly 10 digits"
        )
        ws.add_data_validation(dv_mobile)
        dv_mobile.add("C2:C1000")

        dv_email = DataValidation(
            type="custom",
            formula1='=OR(ISBLANK(D2),AND(ISNUMBER(SEARCH("@",D2)),ISNUMBER(SEARCH(".",D2))))',
            showErrorMessage=True,
            error="Enter a valid email (example@domain.com)"
        )
        ws.add_data_validation(dv_email)
        dv_email.add("D2:D1000")

        dv_gst = DataValidation(
            type="custom",
            formula1='=OR(ISBLANK(E2),LEN(E2)=15)',
            showErrorMessage=True,
            error="GST must be exactly 15 characters"
        )
        ws.add_data_validation(dv_gst)
        dv_gst.add("E2:E1000")

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name="customer_template.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}, 500
