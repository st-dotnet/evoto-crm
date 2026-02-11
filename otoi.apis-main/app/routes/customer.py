from flask import Blueprint, current_app, jsonify, request, g
from app.models.customer import Customer
from app.models.person import Lead
from app.models.common import Address, Shipping
from app.extensions import db
from app.utils.address_utils import clean_orphaned_addresses, validate_address_type
from sqlalchemy import func, or_
from app.utils.stamping import set_created_fields, set_business, set_updated_fields
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
                    "reason": c.reason,
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
    reason = (data.get("reason") or "").strip() or None

    LOSE_STATUSES = {"Lose", "5"}
    if status in LOSE_STATUSES and not reason:
        return jsonify({"error": "Reason is required when status is Lose"}), 400
    
    is_deleted = status in LOSE_STATUSES

    REQUIRED_ADDRESS_STATUSES = {"Win", "4"}
    is_address_required = status in REQUIRED_ADDRESS_STATUSES

    # Billing Address Data
    address1 = (data.get("address1") or "").strip()
    address2 = (data.get("address2") or "").strip() or None
    city = (data.get("city") or "").strip()
    state = (data.get("state") or "").strip()
    country = (data.get("country") or "").strip()
    pin = (data.get("pin") or "").strip()
    uuid_to_ignore = data.get("uuid")  # For updates
  

    # Shipping Address Data - Get from root level with shipping_ prefix

    is_shipping_same = data.get("is_shipping_same", True)
    shipping_address = None

    

    # Check if any shipping address fields are present in the request

    has_shipping_fields = any(key.startswith('shipping_') and key != 'is_shipping_same' for key in data.keys())

    
    if not is_shipping_same or has_shipping_fields:
        shipping_address = {
            "address1": (data.get("shipping_address1") or "").strip(),
            "address2": (data.get("shipping_address2") or "").strip() or None,
            "city": (data.get("shipping_city") or "").strip(),
            "state": (data.get("shipping_state") or "").strip(),
            "country": (data.get("shipping_country") or "").strip(),
            "pin": (data.get("shipping_pin") or "").strip(),
            "is_default": data.get("is_default_shipping", False)
        }
       
        # Only set to None if all fields are empty (except is_default)
        if shipping_address and not any(v for k, v in shipping_address.items() if k != 'is_default' and v):
            shipping_address = None
        elif shipping_address and is_address_required and not all([
            shipping_address['address1'],
            shipping_address['city'],
            shipping_address['state'],
            shipping_address['country'],
            shipping_address['pin']
        ]):
            return jsonify({
                "error": "All required address information must be provided."
            }), 400

    # Validate required fields
    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400
    if not mobile and not email:
        return jsonify({"error": "Either mobile or email is required"}), 400
    # Billing address validation ONLY for status Win or 4

    if is_address_required:
        if not all([address1, city, state, country, pin]):
            return jsonify({
                "error": "All required address information must be provided."
            }), 400


    # DUPLICATE CHECKS
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

    # RESOLVE LEAD

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

    # UPDATE EXISTING CUSTOMER IF UUID PROVIDED

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
        existing_customer.reason = data.get("reason", existing_customer.reason)


        # Handle shipping address update if different from billing

        if not is_shipping_same and shipping_address:

            is_default = shipping_address.get("is_default", False)

           #This will find the existing shipping (any one)
            existing_shipping = Shipping.query.filter_by(
                customer_id=existing_customer.uuid
            ).first()


            # If this shipping should be default → unset others

            if is_default:
                Shipping.query.filter(
                    Shipping.customer_id==existing_customer.uuid,
                    Shipping.is_default==True
                ).update(
                    {"is_default": False},
                    synchronize_session=False
                )

            

            # If shipping address is provided and different from billing

            if any(shipping_address.values()):
                # Create new address record for shipping
                shipping_addr = Address(
                    address1=shipping_address["address1"],
                    city=shipping_address["city"],
                    state=shipping_address["state"],
                    country=shipping_address["country"],
                    pin=shipping_address["pin"],
                    customer_id=existing_customer.uuid  # Ensure customer_id is set for shipping address
                )
                set_created_fields(shipping_addr)
                set_business(shipping_addr)
                db.session.add(shipping_addr)
                db.session.flush()
                
                # Create or update shipping record
                if existing_shipping:
                    # Update existing shipping address
                    existing_shipping.address1 = shipping_address["address1"]
                    existing_shipping.city = shipping_address["city"]
                    existing_shipping.state = shipping_address["state"]
                    existing_shipping.country = shipping_address["country"]
                    existing_shipping.pin = shipping_address["pin"]
                    existing_shipping.address_type = shipping_address.get("address_type", "home")
                    existing_shipping.is_default = is_default
                    set_updated_fields(existing_shipping)
                else:
                    # Create new shipping record
                    shipping = Shipping(
                        customer_id=existing_customer.uuid,
                        address1=shipping_address["address1"],
                        city=shipping_address["city"],
                        state=shipping_address["state"],
                        country=shipping_address["country"],
                        pin=shipping_address["pin"],
                        address_type=shipping_address.get("address_type", "home"),
                        is_default=is_default
                    )
                    set_created_fields(shipping)
                    set_business(shipping)
                    db.session.add(shipping)
            elif existing_shipping and not is_shipping_same:
                # If shipping address is marked as not same but no address provided, remove existing shipping

                db.session.delete(existing_shipping)

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
                    "reason": existing_customer.reason,
                }
            ),
            200,
        )

    # CREATE NEW CUSTOMER


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
        reason=reason,
        is_deleted=is_deleted,
    )
    db.session.add(customer)
    db.session.flush()

    # Create or update billing address record
    billing_address = Address.query.filter_by(customer_id=customer.uuid).first()
    if billing_address:
        # Update existing billing address
        billing_address.address1 = address1
        billing_address.address2 = address2
        billing_address.city = city
        billing_address.state = state
        billing_address.country = country
        billing_address.pin = pin
        set_updated_fields(billing_address)
    else:
        # Create new billing address
        billing_address = Address(

           customer_id=customer.uuid,
            address1=address1,
            address2=address2,
            city=city,
            state=state,
            country=country,
            pin=pin,
        )
        set_created_fields(billing_address)
        set_business(billing_address)
        db.session.add(billing_address)
    
    # Handle shipping address if different from billing or if shipping fields are present
    if (not is_shipping_same or has_shipping_fields) and shipping_address:
        try:
            current_app.logger.info(f"Processing shipping address for customer {customer.uuid}")
            current_app.logger.info(f"Shipping address data: {shipping_address}")
            
            # Get shipping address data with proper defaults
            shipping_data = {
                'address1': shipping_address.get('address1', '').strip(),
                'city': shipping_address.get('city', '').strip(),
                'state': shipping_address.get('state', '').strip(),
                'country': shipping_address.get('country', '').strip(),
                'pin': shipping_address.get('pin', '').strip(),
                'address_type': shipping_address.get('address_type', 'home').lower(),
                'is_default': bool(shipping_address.get('is_default', False))
            }

            # Validate required fields
            required_fields = ['address1', 'city', 'state', 'country', 'pin']
            missing_fields = [field for field in required_fields if not shipping_data[field]]
            if missing_fields:
                return jsonify({"error": f"Missing required shipping address fields: {', '.join(missing_fields)}"}), 400

            # Validate address type
            if shipping_data['address_type'] not in ['home', 'work', 'other']:
                return jsonify({"error": "Invalid address type. Must be 'home', 'work', or 'other'"}), 400

            # Check if this address type already exists for this customer
            existing_address = Shipping.query.filter_by(
                customer_id=customer.uuid,
                address_type=shipping_data['address_type']
            ).first()

           
            if existing_address:
                # Update existing address
                for field in ['address1', 'city', 'state', 'country', 'pin']:
                    setattr(existing_address, field, shipping_data[field])
                
                if shipping_data['is_default']:
                    existing_address.is_default = True
                    # Unset other defaults
                    Shipping.query.filter(
                        Shipping.customer_id == customer.uuid,
                        Shipping.uuid != existing_address.uuid,
                        Shipping.is_default == True
                    ).update(
                        {"is_default": False},
                        synchronize_session=False
                    )

                

                set_updated_fields(existing_address)
                current_app.logger.info("Updated existing shipping address")
                
            else:
                # Check address limit
                address_count = Shipping.query.filter_by(customer_id=customer.uuid).count()
                if address_count >= 3:
                    return jsonify({"error": "Maximum of 3 shipping addresses allowed per customer"}), 400
                
                # Create new shipping address
                shipping = Shipping(
                    customer_id=customer.uuid,
                    **shipping_data,
                    business_id=getattr(g, 'business_id', None)
                )
                
                # If this is the first address or explicitly set as default, make it default
                if address_count == 0 or shipping_data['is_default']:
                    shipping.is_default = True
                    # Unset other defaults if needed
                    if shipping_data['is_default']:
                        Shipping.query.filter(
                            Shipping.customer_id == customer.uuid,
                            Shipping.is_default == True
                        ).update(
                            {"is_default": False},
                            synchronize_session=False
                        )
                
                set_created_fields(shipping)
                set_business(shipping)
                db.session.add(shipping)
                current_app.logger.info("Created new shipping address")
            
            db.session.flush()
            current_app.logger.info("Processed shipping address successfully")
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error processing shipping address: {str(e)}", exc_info=True)
            return jsonify({"error": f"Failed to process shipping address: {str(e)}"}), 500
    
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
                "reason": customer.reason,
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
        description: Returns customer details including shipping address if available.
    """
    customer = Customer.query.filter_by(uuid=customer_id, is_deleted=False).first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    
    # Prepare base response
    response_data = {
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
        "reason": customer.reason,
    }
    
    # Get all shipping addresses
    shipping_addresses = Shipping.query.filter(
        Shipping.customer_id == customer.uuid
    ).order_by(
        Shipping.is_default.desc()  # Put default address first
    ).all()
    
    # Add shipping addresses to response
    if shipping_addresses:
        # For backward compatibility, include the first shipping address at root level
        shipping = shipping_addresses[0]
        response_data.update({
            "shipping_address1": shipping.address1,
            "shipping_city": shipping.city,
            "shipping_state": shipping.state,
            "shipping_country": shipping.country,
            "shipping_pin": shipping.pin,
            "address_type": shipping.address_type,
            "is_default_shipping": shipping.is_default,
            "shipping_uuid": str(shipping.uuid)
        })
        
        # Include all shipping addresses in a list
        response_data["shipping_addresses"] = [{
            "uuid": str(addr.uuid),
            "address_type": addr.address_type,
            "address1": addr.address1,
            "city": addr.city,
            "state": addr.state,
            "country": addr.country,
            "pin": addr.pin,
            "is_default": addr.is_default,
            "created_at": addr.created_at.isoformat() if addr.created_at else None,
            "updated_at": addr.updated_at.isoformat() if addr.updated_at else None
        } for addr in shipping_addresses]
    
    return jsonify(response_data)
# UPDATE an existing customer
@customer_blueprint.route("/<uuid:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    try:
        data = request.get_json() or {}
        current_app.logger.info(f"Updating customer {customer_id} with data: {data}")

        customer = Customer.query.filter_by(uuid=customer_id, is_deleted=False).first()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        REQUIRED_ADDRESS_STATUSES = {"Win", "4"}

        # Determine final status (existing or incoming)
        final_status = data.get("status", customer.status)
        is_address_required = str(final_status) in REQUIRED_ADDRESS_STATUSES

        LOSE_STATUSES = {"Lose", "5"}
        if str(final_status) in LOSE_STATUSES and not data.get("reason", customer.reason):
            return jsonify({"error": "Reason is required when status is Lose"}), 400
        
        customer.is_deleted = str(final_status) in LOSE_STATUSES

        # ---------------- DUPLICATE CHECKS ----------------
        if "mobile" in data and data["mobile"]:
            mobile = str(data["mobile"]).strip()
            if mobile != customer.mobile:
                existing = Customer.query.filter(
                    Customer.mobile == mobile,
                    Customer.uuid != customer_id,
                    Customer.is_deleted == False
                ).first()
                if existing:
                    return jsonify({"error": "Customer with this mobile number already exists"}), 400

        if "gst" in data and data["gst"]:
            gst = str(data["gst"]).strip().upper()
            if gst != (customer.gst or "").upper():
                existing = Customer.query.filter(
                    func.upper(Customer.gst) == gst,
                    Customer.uuid != customer_id,
                    Customer.is_deleted == False
                ).first()
                if existing:
                    return jsonify({"error": "Customer with this GST number already exists"}), 400

        # ---------------- UPDATE BASIC FIELDS ----------------
        for field in ["first_name", "last_name", "mobile", "email", "gst", "status"]:
            if field in data:
                value = str(data[field]).strip() if data[field] is not None else None
                if field in ["first_name", "last_name"] and not value:

                   return jsonify({"error": f"Field '{field}' is required"}), 400
                setattr(customer, field, value)
        
        if "reason" in data:
            customer.reason = str(data["reason"]).strip() if data["reason"] is not None else None


       # ---------------- BILLING ADDRESS VALIDATION ----------------
        # has_billing_updates = any(field in data for field in ["address1", "city", "state", "country", "pin"])
        has_billing_updates = any(field in data for field in [
        "billing_address1",
        "billing_address2",
        "billing_city",
        "billing_state",
        "billing_country",
        "billing_pin"
        ])
        if is_address_required and has_billing_updates:
            customer.address1 = data.get("billing_address1", customer.address1)
            customer.address2 = data.get("billing_address2", customer.address2)
            customer.city = data.get("billing_city", customer.city)
            customer.state = data.get("billing_state", customer.state)
            customer.country = data.get("billing_country", customer.country)
            customer.pin = data.get("billing_pin", customer.pin)

        # ---------------- SHIPPING UPDATE ----------------
        # Check if we're adding/updating shipping addresses

        # has_shipping_updates = ("shipping_addresses" in data or  any(k.startswith("shipping_") for k in data) or any(k in data for k in ["shipping_city", "shipping_state", "shipping_country", "shipping_pin", "shipping_address1"]))
        has_shipping_updates = (
            "shipping_addresses" in data or
            any(k in data for k in [
                "shipping_address1",
                "shipping_city",
                "shipping_state",
                "shipping_country",
                "shipping_pin"
            ])
        )
        
        # Initialize shipping_list
        shipping_list = []
        
        if has_shipping_updates:
            # Get existing shipping count and list
            existing_shipping = Shipping.query.filter_by(customer_id=customer.uuid).all()
            existing_shipping_count = len(existing_shipping)
            existing_uuids = {str(ship.uuid) for ship in existing_shipping}
            
            if "shipping_addresses" in data:
                # For array format, only take the first 3 addresses if there are more than 3
                shipping_list = data["shipping_addresses"][:3]
                
                # If we're adding new addresses (not just updating existing ones)
                new_addresses = [addr for addr in shipping_list if "uuid" not in addr or addr["uuid"] not in existing_uuids]
                if new_addresses and existing_shipping_count + len(new_addresses) > 3:
                    # Calculate how many addresses we need to remove
                    to_remove = (existing_shipping_count + len(new_addresses)) - 3
                    if to_remove > 0:
                        # Find and remove the oldest shipping addresses
                        oldest_shippings = Shipping.query.filter_by(
                            customer_id=customer.uuid
                        ).order_by(Shipping.created_at.asc()).limit(to_remove).all()
                        
                        for old_ship in oldest_shippings:
                            # Delete the shipping record (no need to delete address record anymore)
                            db.session.delete(old_ship)
                        db.session.commit()
            
            elif any(k.startswith('shipping_') for k in data):
                # Flat format - treat as a single new address
                if existing_shipping_count >= 3:
                    # Find and delete the oldest shipping address
                    oldest_shipping = Shipping.query.filter_by(
                        customer_id=customer.uuid
                    ).order_by(Shipping.created_at.asc()).first()
                            
                    if oldest_shipping:
                        # Delete the shipping record (no need to delete address record anymore)
                        db.session.delete(oldest_shipping)
                        db.session.commit()
                
                # Convert flat shipping address to list format
                shipping_list = [{
                    "address1": data.get("shipping_address1"),
                    "address2": data.get("shipping_address2"),
                    "city": data.get("shipping_city"),
                    "state": data.get("shipping_state"),
                    "country": data.get("shipping_country"),
                    "pin": data.get("shipping_pin"),
                    "is_default": data.get("is_default_shipping", False)
                }]

            def is_valid_shipping_payload(ship):
                required_fields = {
                    "address1": ship.get("address1"),
                    "city": ship.get("city"),
                    "state": ship.get("state"),
                    "country": ship.get("country"),
                    "pin": ship.get("pin"),
                    "address_type": ship.get("address_type", "home")  # Default to 'home' if not provided
                }
                
                # Check required fields
                missing_fields = [field for field, value in required_fields.items() if not value and field != "address2"]
                if missing_fields:
                    current_app.logger.error(f"Missing required shipping fields: {', '.join(missing_fields)}")
                    return False
                
                # Validate address_type
                if required_fields["address_type"] not in ["home", "work", "other"]:
                    current_app.logger.error(f"Invalid address_type: {required_fields['address_type']}")
                    return False       
                return True
        
      # Process shipping addresses

        if "shipping_addresses" in data and isinstance(data["shipping_addresses"], list):
            try:
                # Get existing shipping addresses
                existing_shipping = {str(addr.uuid): addr for addr in Shipping.query.filter_by(customer_id=customer.uuid).all()}
                processed_uuids = set()
                
                # Count how many addresses will be marked as default in the update
                default_count = sum(1 for ship_data in data["shipping_addresses"] if ship_data.get('is_default', False))
                
                # If more than one default is being set, return error
                if default_count > 1:
                    return jsonify({"error": "Only one shipping address can be marked as default"}), 400
                
                # Process each shipping address from the request
                for ship_data in data["shipping_addresses"]:
                    ship_uuid = ship_data.get("uuid")
                    
                    # Get address data with proper defaults
                    address_data = {
                        'address1': ship_data.get('address1', '').strip(),
                        'city': ship_data.get('city', '').strip(),
                        'state': ship_data.get('state', '').strip(),
                        'country': ship_data.get('country', '').strip(),
                        'pin': ship_data.get('pin', '').strip(),
                        'address_type': ship_data.get('address_type', 'home').lower(),
                        'is_default': bool(ship_data.get('is_default', False))
                    }
                    
                    # Validate required fields
                    required_fields = ['address1', 'city', 'state', 'country', 'pin']
                    missing_fields = [field for field in required_fields if not address_data[field]]
                    if missing_fields:
                        db.session.rollback()
                        return jsonify({"error": f"Missing required shipping address fields: {', '.join(missing_fields)}"}), 400
                    
                    # Validate address type
                    if address_data['address_type'] not in ['home', 'work', 'other']:
                        db.session.rollback()
                        return jsonify({"error": "Invalid address type. Must be 'home', 'work', or 'other'"}), 400
                    
                    # Check for duplicate address types
                    # if any(addr.uuid != ship_uuid and addr.address_type == address_data['address_type'] 
                    #       for addr in existing_shipping.values()):
                    #     db.session.rollback()
                    #     return jsonify({"error": f"Address type '{address_data['address_type']}' already exists"}), 400
                    
                    if ship_uuid and ship_uuid in existing_shipping:
                        # Update existing shipping address
                        shipping = existing_shipping[ship_uuid]
                        
                        # If this address is being set as default, unset all other defaults first
                        if address_data['is_default']:
                            Shipping.query.filter(
                                Shipping.customer_id == customer.uuid,
                                Shipping.uuid != ship_uuid,
                                Shipping.is_default == True
                            ).update({"is_default": False}, synchronize_session=False)
                        
                        for field in ['address1', 'city', 'state', 'country', 'pin', 'address_type']:
                            setattr(shipping, field, address_data[field])
                        shipping.is_default = address_data['is_default']
                        set_updated_fields(shipping)
                        processed_uuids.add(ship_uuid)
                        
                    else:
                        # Check address limit
                        if len(existing_shipping) - len(processed_uuids) + len([s for s in data["shipping_addresses"] if 'uuid' not in s]) > 3:
                            db.session.rollback()
                            return jsonify({"error": "Maximum of 3 shipping addresses allowed per customer"}), 400
                        
                        # Create new shipping address
                        # If this address is being set as default, unset all other defaults first
                        if address_data['is_default']:
                            Shipping.query.filter(
                                Shipping.customer_id == customer.uuid,
                                Shipping.is_default == True
                            ).update({"is_default": False}, synchronize_session=False)
                        
                        shipping = Shipping(
                            customer_id=customer.uuid,
                            **address_data,
                            business_id=getattr(g, 'business_id', None)
                        )
                        set_created_fields(shipping)
                        set_business(shipping)
                        db.session.add(shipping)
                        db.session.flush()
                        processed_uuids.add(str(shipping.uuid))
                
                # Delete any addresses not included in the request
                for uuid, addr in list(existing_shipping.items()):
                    if uuid not in processed_uuids:
                        db.session.delete(addr)
                
                db.session.flush()
                
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Error processing shipping addresses: {str(e)}", exc_info=True)
                return jsonify({"error": f"Failed to process shipping addresses: {str(e)}"}), 400
                current_app.logger.error(f"Error processing shipping address: {str(e)}")
                return jsonify({"error": f"Failed to process shipping address: {str(e)}"}), 400
        
        # After processing all shipping addresses, ensure at least one default exists if there are addresses
        if shipping_list:
            has_default = Shipping.query.filter_by(
                customer_id=customer.uuid,
                is_default=True
            ).first()
            
            if not has_default and shipping_list:  # If no default but we have addresses, set the first one as default
                first_shipping = Shipping.query.filter_by(
                    customer_id=customer.uuid
                ).order_by(Shipping.created_at.asc()).first()
                
                if first_shipping:
                    first_shipping.is_default = True
                    set_updated_fields(first_shipping)

        try:
            # Clean up any orphaned addresses before committing
            cleaned_count = clean_orphaned_addresses()
            if cleaned_count > 0:
                current_app.logger.info(f"Cleaned up {cleaned_count} orphaned addresses")
            
            db.session.commit()
            
            # Verify shipping was created
            if 'shipping' in locals() and not shipping.uuid:
                raise Exception("Shipping record was not created")
                
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating customer: {str(e)}")
            return jsonify({"error": "Failed to update customer due to an internal error"}), 500

        # ---------------- RESPONSE ----------------
        # Get the default shipping address (if any)
        default_shipping = Shipping.query.filter_by(
            customer_id=customer.uuid,
            is_default=True
        ).first()
        
        # Prepare the base response with customer details
        response = {
            "uuid": str(customer.uuid),
            "customer_id": str(customer.uuid),
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "mobile": customer.mobile,
            "email": customer.email,
            "gst": customer.gst,
            "status": customer.status,
            # Billing address at root level
            "address1": customer.address1,
            "address2": customer.address2,
            "city": customer.city,
            "state": customer.state,
            "country": customer.country,
            "pin": customer.pin,
        }
        
        # Add shipping address fields at root level if default shipping exists
        if default_shipping:
            response.update({
                "shipping_address1": default_shipping.address1,
                "shipping_city": default_shipping.city,
                "shipping_state": default_shipping.state,
                "shipping_country": default_shipping.country,
                "shipping_pin": default_shipping.pin,
                "shipping_address_type": default_shipping.address_type,
                "is_default_shipping": default_shipping.is_default
            })

        return jsonify(response), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating customer: {str(e)}", exc_info=True)
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
       

