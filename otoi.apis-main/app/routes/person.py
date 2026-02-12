from app.models.inventory import Item
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.person import Lead, LeadAddress
from app.models.customer import Customer
from app.models.active import Active, ActiveType
from app.models.common import Address
from app.utils.stamping import set_created_fields, set_updated_fields, set_business
from app.utils.lead_utils import sync_lead_to_customer
from flask import current_app
from sqlalchemy import String, cast, or_, func
from sqlalchemy.orm import joinedload
from io import BytesIO
from flask import send_file
from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation



STATUS_MAPPING = {
    1: "New",
    2: "In-Progress",
    3: "Quote Given",
    4: "Win",
    5: "Lose",
}
lead_blueprint = Blueprint("person", __name__)

@lead_blueprint.route("/", methods=["GET", "OPTIONS"])
def get_leads():
    """
    Fetch a list of leads with filtering, sorting, and pagination.
    ---
    parameters:
      - name: filter[name]
        in: query
        description: Filter by name (first_name, last_name)
        required: false
        schema:
          type: string
      - name: filter[email]
        in: query
        description: Filter by email (email)
        required: true
        schema:
          type: string
      - name: query
        in: query
        description: Search by first_name, last_name, email, gst, or mobile
        required: false
        schema:
          type: string

      - name: mobile
        in: query
        description: Filter by mobile number (partial match)
        required: false
        schema:
          type: string
      - name: exact_mobile
        in: query
        description: Exact match for mobile number
        required: false
        schema:
          type: string
      - name: exact_gst
        in: query
        description: Exact match for GST number
        required: false
        schema:
          type: string
      - name: exclude_uuid
        in: query
        description: UUID to exclude from results (for duplicate checks)
        required: false
        schema:
          type: string

      - name: sort
        in: query
        description: Comma-separated field names for sorting (e.g., 'first_name,-email')
        required: false
        schema:
          type: string

      - name: page
        in: query
        description: "Page number (default: 1)"
        required: false
        schema:
          type: integer
          default: 1

      - name: items_per_page
        in: query
        description: "Number of records per page (default: 10)"
        required: false
        schema:
          type: integer
          default: 10

    responses:
      200:
        description: A list of leads
    """
    try:
        query = Lead.query.filter_by(is_deleted=False)

        # Filtering by name/email
        if "filter[name]" in request.args:
            filter_value = request.args.get("filter[name]", "")
            query = query.filter(
                or_(
                    Lead.first_name.ilike(f"%{filter_value}%"),
                    Lead.last_name.ilike(f"%{filter_value}%"),
                    Lead.email.ilike(f"%{filter_value}%")
                )
            )

        # General query search
        if "query" in request.args:
            query_value = request.args.get("query", "")
            query = query.filter(
                or_(
                    Lead.first_name.ilike(f"%{query_value}%"),
                    Lead.last_name.ilike(f"%{query_value}%"),
                    func.concat(Lead.first_name, " ", Lead.last_name).ilike(f"%{query_value}%"),
                    Lead.email.ilike(f"%{query_value}%"),
                    Lead.gst.ilike(f"%{query_value}%"),
                    Lead.mobile.ilike(f"%{query_value}%"),
                )
            )

        # Mobile filter (partial match)
        if "mobile" in request.args:
            query = query.filter(Lead.mobile.ilike(f"%{request.args['mobile']}%"))

        # Exact filtering for duplicate checks (OR logic)
        # exact_filters = []
        # if "exact_mobile" in request.args:
        #     exact_filters.append(Lead.mobile == request.args["exact_mobile"])
        # if "exact_gst" in request.args:
        #     exact_filters.append(func.upper(Lead.gst) == request.args["exact_gst"].upper())
        # if "exact_email" in request.args:
        #     exact_filters.append(func.upper(Lead.email) == request.args["exact_email"].upper())
        
        # if exact_filters:
        #     query = query.filter(or_(*exact_filters))

        # if "exclude_uuid" in request.args:
        #     query = query.filter(Lead.uuid != request.args["exclude_uuid"])

        # Sorting
        sort = request.args.get("sort", "uuid")
        order = request.args.get("order", "asc")
        for field in sort.split(","):
            if field == "name":
                if order == "desc":
                    query = query.order_by(db.desc(func.concat(Lead.first_name, " ", Lead.last_name)))
                else:
                    query = query.order_by(func.concat(Lead.first_name, " ", Lead.last_name))
            elif field == "gst":
                query = query.order_by(db.desc(Lead.gst) if order == "desc" else Lead.gst)
            elif field == "mobile":
                query = query.order_by(db.desc(Lead.mobile) if order == "desc" else Lead.mobile)
            else:
                if field.startswith("-"):
                    query = query.order_by(db.desc(getattr(Lead, field[1:])))
                else:
                    query = query.order_by(getattr(Lead, field))

        # Load addresses (joinedload Lead → LeadAddress → Address)
        query = query.options(joinedload(Lead.lead_addresses).joinedload(LeadAddress.address))


        if "status" in request.args:
            status_value = request.args.get("status", "").strip()
            if status_value and status_value.lower() not in ["-1", "all"]:
            # Case 1: Numeric input (1,2,3...)
             if status_value.isdigit():
                query = query.filter(Lead.status == int(status_value))
             else:
                # Normalize both input and mapping
                normalized_input = status_value.lower().replace("-", "").replace(" ", "")
                for key, label in STATUS_MAPPING.items():
                    normalized_label = label.lower().replace("-", "").replace(" ", "")
                    if normalized_label == normalized_input:
                      query = query.filter(Lead.status == key)
                    break

    
        # Return all leads for dropdown if requested
        if request.args.get("dropdown") == "true":
            return jsonify([
                {
                    "uuid": str(lead.uuid),
                    "name": f"{lead.first_name} {lead.last_name}".strip()
                }
                for lead in query.all()
            ])

        # Pagination
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("items_per_page", 5))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        leads = pagination.items

        # Build response
        result = []
        for lead in leads:
            addresses = []
            for la in lead.lead_addresses:
                addresses.append({
                    "address1": la.address.address1,
                    "address2": la.address.address2,
                    "city": la.address.city,
                    "state": la.address.state,
                    "country": la.address.country,
                    "pin": la.address.pin,
                })

            result.append({
                "uuid": str(lead.uuid),
                "first_name": lead.first_name,
                "last_name": lead.last_name,
                "mobile": lead.mobile,
                "email": lead.email,
                "gst": lead.gst,
                "status": STATUS_MAPPING.get(lead.status, str(lead.status)),
                "reason": lead.reason,
                "addresses": addresses,
            })

        return jsonify({
            "pages": pagination.pages,
            "data": result,
            "pagination": {"total": pagination.total}
        })
    except Exception as e:
        db.session.rollback()
        import traceback; print("ERROR in get_leads:", traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


#TEST CASE
@lead_blueprint.route("/test", methods=["GET"])
def get_test():
     return jsonify("api work ") 

# Download  Excel Template

@lead_blueprint.route("/download-template", methods=["GET"])
def download_person_template():
    try:
        # Static lists
        statuses = ["New", "In-progress", "Quote Given", "Win", "Lose"]

        # Create workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Leads"

        # Add columns
        columns = [
            "first_name", "last_name", "mobile", "email", "gst","status", "reason",
            "address1", "address2", "city", "state", "country", "pin"
        ]
        ws.append(columns)

        # --- Hidden sheet for dropdown sources ---
        ws_hidden = wb.create_sheet("DropdownData")
        for i, value in enumerate(statuses, start=1):
            ws_hidden[f"B{i}"] = value

        # Hide the sheet
        ws_hidden.sheet_state = "hidden"

        # --- Data Validation (Status, col F) ---
        dv_status = DataValidation(
            type="list",
            formula1="=DropdownData!$B$1:$B$5",  # 5 values in column B
            allow_blank=False
        )
        ws.add_data_validation(dv_status)
        dv_status.add("F2:F1000")

        # Save to memory
        output = BytesIO()
        wb.save(output)
        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name="person_template.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": str(e)}, 500
    

@lead_blueprint.route("/", methods=["POST"])
def create_lead():
    """ 
    Create a new lead.
    ---
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            first_name:
              type: string
            last_name:
              type: string
            mobile:
              type: string
            email:
              type: string
            gst:
              type: string
            referenced_by:
              type: string
            status:
              type: string
              example: Win
            reason:
              type: string
              description: "Required if status is Lose"
            address:
              type: object
              description: "Required if status is Win"
              properties:
                address1:
                  type: string
                address2:
                  type: string
                city:
                  type: string
                state:
                  type: string
                country:
                  type: string
                pin:
                  type: string
    responses:
      200:
        description: Lead created successfully
    """
    try:
        data = request.get_json() or {}

        # ---- BASIC VALIDATION ----
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        email = (data.get("email") or "").strip() or None
        mobile = (data.get("mobile") or "").strip() or None
        status = str(data.get("status") or "").strip()

        if not first_name or not last_name:
            return jsonify({"error": "First name and last name are required"}), 400

        if not mobile and not email:
            return jsonify({"error": "Either mobile or email is required"}), 400

        # ---- STATUS LOGIC ----
        if not status:
            return jsonify({"error": "Status type is required"}), 400  
        reason = None
        address_data = None

        if status.lower() in ["lose", "5"]:
            reason = data.get("reason")
            if not reason:
                return jsonify({"error": "Reason is required when status is Lose"}), 400

        if status.lower() in ["win", "4"]:
            address_data = {
                "address1": data.get("address1"),
                "address2": data.get("address2"),
                "city": data.get("city"),
                "state": data.get("state"),
                "country": data.get("country"),
                "pin": data.get("pin"),
            }

            if not all([address_data["city"], address_data["state"],
                        address_data["country"], address_data["pin"]]):
                return jsonify({"error": "Complete address is required when status is Win"}), 400        

        # ---- DUPLICATE MOBILE CHECK (SAFE) ----
        bypass_duplicate = data.get("bypass_duplicate", False)
        if mobile and not bypass_duplicate:
            if Lead.query.filter_by(mobile=mobile, is_deleted=False).first():
                return jsonify({"error": "A lead with this mobile already exists"}), 400

        # ---- CREATE LEAD ----
        lead = Lead(
            first_name=first_name,
            last_name=last_name,
            mobile=mobile,
            email=email,
            gst=data.get("gst"),
            referenced_by=data.get("referenced_by"),
            status=status,
            reason=reason,
        )

        # Automatically mark as deleted if status is "Lose" (5)
        if status.lower() in ["lose", "5"]:
            lead.is_deleted = True

        set_created_fields(lead)
        set_business(lead)
        db.session.add(lead)
        db.session.flush()

        # ---- ADDRESS ----
        if address_data:
            address = Address(
                address1=address_data.get("address1"),
                address2=address_data.get("address2"),
                city=address_data["city"],
                state=address_data["state"],
                country=address_data["country"],
                pin=address_data["pin"],
            )
            set_created_fields(address)
            set_business(address)
            db.session.add(address)
            db.session.flush()

            lead_address = LeadAddress(
                lead_id=lead.uuid,
                address_id=address.uuid
            )
            set_created_fields(lead_address)
            set_business(lead_address)
            db.session.add(lead_address)

        # Sync lead to customer if status is "Win"
        current_app.logger.info(f"Syncing lead {lead.uuid} with status {lead.status}")
        matched_existing_customer = False
        customer_uuid = None
        try:
            customer, matched_existing_customer = sync_lead_to_customer(lead, address_data)
            if customer:
                customer_uuid = str(customer.uuid)
                current_app.logger.info(f"Created/Updated customer {customer.uuid} for lead {lead.uuid}")
        except Exception as sync_err:
            current_app.logger.error(f"Error syncing lead to customer: {str(sync_err)}")
            # We might want to allow the lead creation to succeed even if sync fails,
            # but usually they should both succeed together. 
            # For now, let's just log and continue, or raise if it's critical.

        db.session.commit()

        return jsonify({
            "message": "Lead created successfully",
            "uuid": str(lead.uuid),
            "customer_uuid": customer_uuid,
            "customer_already_exists": bool(matched_existing_customer)
        }), 201
    
    except IntegrityError as e:
        db.session.rollback()
        err_msg = str(e.orig)
        if "uq_customers_gst" in err_msg or "leads_gst_key" in err_msg:
            return jsonify({"error": "A customer or lead with this GST number already exists"}), 400
        if "leads_mobile_key" in err_msg or "uq_leads_mobile" in err_msg:
            return jsonify({"error": "A lead with this mobile number already exists"}), 400
        if "leads_email_key" in err_msg:
            return jsonify({"error": "A lead with this email already exists"}), 400
        return jsonify({"error": "Database integrity error", "details": err_msg}), 400

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({
            "error": "Internal server error",
            "details": str(e)
        }), 500



@lead_blueprint.route("/<uuid:lead_id>", methods=["PUT"])
def update_lead(lead_id):
    """
    Update an existing lead.
    ---
    parameters:
      - name: lead_id
        in: path
        required: true
        type: string
        format: uuid
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            first_name: { type: string }
            last_name: { type: string }
            mobile: { type: string }
            email: { type: string }
            gst: { type: string }
            status: { type: string }
            reason: { type: string }
            address1: { type: string }
            address2: { type: string }
            city: { type: string }
            state: { type: string }
            country: { type: string }
            pin: { type: string }
    responses:
      200:
        description: Lead updated successfully
    """
    try:
        data = request.get_json() or {}
        bypass_duplicate = data.get("bypass_duplicate", False)
        lead = Lead.query.filter_by(uuid=lead_id, is_deleted=False).first()
        if not lead:
            return jsonify({"error": "Lead not found"}), 404

        # ---- DUPLICATE MOBILE CHECK FOR UPDATE ----
        if "mobile" in data and data["mobile"] and not bypass_duplicate:
            mobile = str(data["mobile"]).strip()
            if mobile != lead.mobile:  # Only check if mobile is being changed
                existing = Lead.query.filter(
                    Lead.mobile == mobile,
                    Lead.uuid != lead_id,
                    Lead.is_deleted == False
                ).first()
                if existing:
                    return jsonify({"error": "A lead with this mobile already exists"}), 400

        # Consolidate updates
        lead.first_name = data.get("first_name", lead.first_name)
        lead.last_name = data.get("last_name", lead.last_name)
        # Special handling for mobile and email to allow null/empty
        if "mobile" in data:
            lead.mobile = (data.get("mobile") or "").strip() or None
        if "email" in data:
            lead.email = (data.get("email") or "").strip() or None
        lead.gst = data.get("gst", lead.gst)
        lead.status = data.get("status", lead.status)
        lead.reason = data.get("reason", lead.reason)
        lead.referenced_by = data.get("referenced_by", lead.referenced_by)
        # Automatically mark as deleted if status is set to "Lose" (5)
        if str(lead.status).strip().lower() in ["lose", "5"]:
            lead.is_deleted = True
            # Also find and delete linked customer if exists
            customer = Customer.query.filter_by(lead_id=lead.uuid).first()
            if customer:
                customer.is_deleted = True
                set_updated_fields(customer)
        data = request.get_json() or {}

        # ---- BASIC VALIDATION ----
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        email = (data.get("email") or "").strip()
        mobile = (data.get("mobile") or "").strip()
        status = str(data.get("status") or "").strip()

        # Basic validation (if name/mobile/email are being updated)
        if not lead.first_name or not lead.last_name:
            return jsonify({"error": "First name and last name are required"}), 400
        if not lead.mobile and not lead.email:
            return jsonify({"error": "Either mobile or email is required"}), 400

        # Update Lead basic fields
        lead.first_name = data.get("first_name", lead.first_name)
        lead.last_name = data.get("last_name", lead.last_name)
        lead.mobile = data.get("mobile", lead.mobile)
        lead.email = data.get("email", lead.email)
        lead.gst = data.get("gst", lead.gst)
        lead.status = data.get("status", lead.status)

        lead.reason = data.get("reason", lead.reason)
        lead.referenced_by = data.get("referenced_by", lead.referenced_by)

        status = str(lead.status).strip()

        # Handle Address if status is Win (4)
        if status.lower() in ["win", "4"]:
            address_data = {
                "address1": data.get("address1"),
                "address2": data.get("address2"),
                "city": data.get("city"),
                "state": data.get("state"),
                "country": data.get("country"),
                "pin": data.get("pin"),
            }

            # At least these must be present for Win status validation
            if not all([address_data["city"], address_data["state"],
                        address_data["country"], address_data["pin"]]):
                return jsonify({"error": "Complete address is required when status is Win"}), 400

            # Check for existing LeadAddress
            lead_address = LeadAddress.query.filter_by(lead_id=lead.uuid).first()
            if lead_address:
                # Update existing address
                addr = lead_address.address
                addr.address1 = address_data.get("address1", addr.address1)
                addr.address2 = address_data.get("address2", addr.address2)
                addr.city = address_data.get("city", addr.city)
                addr.state = address_data.get("state", addr.state)
                addr.country = address_data.get("country", addr.country)
                addr.pin = address_data.get("pin", addr.pin)
                set_updated_fields(addr)
            else:
                # Create new address and link it
                new_addr = Address(
                    address1=address_data.get("address1"),
                    address2=address_data.get("address2"),
                    city=address_data["city"],
                    state=address_data["state"],
                    country=address_data["country"],
                    pin=address_data["pin"],
                )
                set_created_fields(new_addr)
                set_business(new_addr)
                db.session.add(new_addr)
                db.session.flush()

                new_la = LeadAddress(
                    lead_id=lead.uuid,
                    address_id=new_addr.uuid
                )
                set_created_fields(new_la)
                set_business(new_la)
                db.session.add(new_la)

        # Sync lead to customer if status is "Win"
        address_data = None
        if str(lead.status).strip().lower() in ["win", "4"]:
            # Check for existing LeadAddress
            lead_address = LeadAddress.query.filter_by(lead_id=lead.uuid).first()
            if lead_address and lead_address.address:
                addr = lead_address.address
                address_data = {
                    "address1": addr.address1,
                    "address2": addr.address2,
                    "city": addr.city,
                    "state": addr.state,
                    "country": addr.country,
                    "pin": addr.pin,
                }
            
        current_app.logger.info(f"Syncing updated lead {lead.uuid} with status {lead.status}")
        sync_lead_to_customer(lead, address_data)

        set_updated_fields(lead)
        db.session.commit()
        return jsonify({"message": "Lead updated successfully"}), 200
 
    except IntegrityError as e:
        db.session.rollback()
        err_msg = str(e.orig)
        if "uq_customers_gst" in err_msg or "leads_gst_key" in err_msg:
            return jsonify({"error": "A customer or lead with this GST number already exists"}), 400
        if "leads_mobile_key" in err_msg or "uq_leads_mobile" in err_msg:
            return jsonify({"error": "A lead with this mobile number already exists"}), 400
        return jsonify({"error": "Database integrity error", "details": err_msg}), 400
 

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@lead_blueprint.route("/<uuid:lead_id>", methods=["GET"])
def get_lead_by_id(lead_id):
    """
    Fetch a single lead by ID.
    ---
    parameters:
      - name: lead_id
        in: path
        required: true
        type: string
        format: uuid
    responses:
      200:
        description: Lead details
        schema:
          type: object
          properties:
            uuid: { type: string }
            first_name: { type: string }
            last_name: { type: string }
            mobile: { type: string }
            email: { type: string }
            gst: { type: string }
            status: { type: string }
            reason: { type: string }
            addresses:
              type: array
              items:
                type: object
                properties:
                  address1: { type: string }
                  address2: { type: string }
                  city: { type: string }
                  state: { type: string }
                  country: { type: string }
                  pin: { type: string }
      404:
        description: Lead not found
    """
    lead = (
        Lead.query.filter_by(uuid=lead_id, is_deleted=False)
        .options(joinedload(Lead.lead_addresses).joinedload(LeadAddress.address))
        .first()
    )
    if not lead:
        return jsonify({"error": "Lead not found"}), 404

    addresses = [
        {
            "address1": la.address.address1,
            "address2": la.address.address2,
            "city": la.address.city,
            "state": la.address.state,
            "country": la.address.country,
            "pin": la.address.pin,
        }
        for la in lead.lead_addresses
    ]

    return jsonify({
        "uuid": str(lead.uuid),
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "mobile": lead.mobile,
        "email": lead.email,
        "gst": lead.gst,
        "status": STATUS_MAPPING.get(lead.status, str(lead.status)),
        "reason": lead.reason,
        "addresses": addresses,
    })



@lead_blueprint.route("/<lead_uuid>", methods=["DELETE"])
def delete_lead(lead_uuid):
    try:
        lead = Lead.query.filter_by(uuid=lead_uuid, is_deleted=False).first()

        if not lead:
            return jsonify({"message": "Lead not found"}), 404

        lead.is_deleted = True
        set_updated_fields(lead)
        db.session.commit()

        return jsonify({"message": "Lead soft-deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(str(e))
        return jsonify({
            "message": "Internal server error",
            "error": str(e)
        }), 500



# #Active

# @person_blueprint.route("/", methods=["GET","OPTIONS"])
# def get_active():
#     """
#     Fetch a list of persons with person_type 'active' with filtering, sorting, and pagination.
#     ---
#     tags:
#       - Actives
#     parameters:
#       - name: filter[name]
#         in: query
#         description: Filter by name (first_name or last_name)
#         required: false
#         schema:
#           type: string
#       - name: query
#         in: query
#         description: Search by first_name, last_name, email, or mobile
#         required: false
#         schema:
#           type: string
#       - name: active_type
#         in: query
#         description: Filter by person type ID
#         required: false
#         schema:
#           type: integer    
#       - name: sort
#         in: query
#         description: Comma-separated field names for sorting (e.g., 'first_name,-email')
#         required: false
#         schema:
#           type: string
#       - name: page
#         in: query
#         description: "Page number (default: 1)"
#         required: false
#         schema:
#           type: integer
#           default: 1
#       - name: items_per_page
#         in: query
#         description: "Number of records per page (default: 10)"
#         required: false
#         schema:
#           type: integer
#           default: 10
#     responses:
#       200:
#         description: A list of leads
#         content:
#           application/json:
#             schema:
#               type: object
#               properties:
#                 pages:
#                   type: integer
#                   description: Total pages
#                 pagination:
#                   type: object
#                   properties:
#                     total:
#                       type: integer
#                       description: Total number of records
#                 data:
#                   type: array
#                   items:
#                     type: object
#                     properties:
#                       LAId:
#                         type: integer
#                         description: Person ID  
#                       comment:
#                         type: string
#                         description: comment
#                       active_type:
#                         type: string
#                         description: Active type 
#                       status:
#                          type: string
#                          description: Lead status   
#       404:
#         description: No leads found
#     """
#     query = (
#         Active.query
#         .join(ActiveType)
#         .filter(ActiveType.name == "Active")
#     )

#     # Filtering
#     # if "filter[name]" in request.args:
#     #     filter_value = request.args.get("filter[name]", "")
#     #     query = query.filter(
#     #         or_(
#     #             Person.first_name.ilike(f"%{filter_value}%"),
#     #             Person.last_name.ilike(f"%{filter_value}%")
#     #         )
#     #     )
#     if "query" in request.args:
#         query_value = request.args.get("query", "")
#         query = query.filter(
#             or_(
#                 Active.LAId.ilike(f"%{query_value}%"),
#                 Active.active_type_id.ilike(f"%{query_value}%"),
#                 Active.comment.ilike(f"%{query_value}%"),
#                 Active.person_type.ilike(f"%{query_value}%")
#             )
#         )
#     # if "mobile" in request.args:
#     #     query = query.filter(Person.mobile.ilike(f"%{request.args['mobile']}%"))
   

#     # Sorting
#     sort = request.args.get("sort", "uuid")
#     for field in sort.split(","):
#         if field.startswith("-"):
#             query = query.order_by(db.desc(getattr(Person, field[1:], "uuid")))
#         else:
#             query = query.order_by(getattr(Person, field, "uuid"))

#     # Pagination
#     page = int(request.args.get("page", 1))
#     per_page = int(request.args.get("items_per_page", 10))
#     pagination = query.paginate(page=page, per_page=per_page, error_out=False)
#     actives = pagination.items

#     result = [
#         {   "LAId": actives.LAId,
#             "active_type": actives.active_type,
#             "comment": actives.comment,
#             "status": lead.status,
#         }
#         for lead in actives
#     ]
#     return jsonify({
#         "pages": pagination.pages,
#         "pagination": {"total": pagination.total},
#         "data": result
#     })




