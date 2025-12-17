from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.person import Lead, LeadAddress
from app.models.active import Active, ActiveType
from app.models.common import Address
from app.utils.stamping import set_created_fields, set_updated_fields, set_business
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
lead_blueprint = Blueprint("person", __name__, url_prefix="/leads")

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
        description: Filter by mobile number
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
        query = Lead.query

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
                    Lead.email.ilike(f"%{query_value}%"),
                    Lead.gst.ilike(f"%{query_value}%"),
                    Lead.mobile.ilike(f"%{query_value}%"),
                )
            )

        # Mobile filter
        if "mobile" in request.args:
            query = query.filter(Lead.mobile.ilike(f"%{request.args['mobile']}%"))

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
                for k, v in {
                    "1": "New",
                    "2": "In-Progress",
                    "3": "Quote Given",
                    "4": "Win",
                    "5": "Lose",
                }.items():
                    normalized_status = v.lower().replace("-", "").replace(" ", "")
                    if normalized_status == normalized_input:
                        query = query.filter(Lead.status == int(k))
                        break



        # Pagination
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("items_per_page", 10))
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
        data = request.json
        print("=== DEBUG Incoming Data ===", data)

        status = str(data.get("status") or "").strip()
        reason = None
        address_data = None

        if status.lower() in ["lose", "5"]:
            reason = data.get("reason")
            if not reason:
                return jsonify({"error": "Reason is required when status is 'Lose'"}), 400

        if status.lower() in ["win", "4"]:
            address_data = data.get("address") or {
                "address1": data.get("address1"),
                "address2": data.get("address2"),
                "city": data.get("city"),
                "state": data.get("state"),
                "country": data.get("country"),
                "pin": data.get("pin"),
            }
            if not all(address_data.get(k) for k in ["city", "state", "country", "pin"]):
                return jsonify({"error": "Address is required when status is 'Win'"}), 400

        if Lead.query.filter_by(mobile=data["mobile"]).first():
            return jsonify({"error": "A lead with this mobile already exists"}), 400

        lead = Lead(
            first_name=data["first_name"],
            last_name=data["last_name"],
            mobile=data["mobile"],
            email=data.get("email"),
            gst=data.get("gst"),
            referenced_by=data.get("referenced_by"),
            status=status,
            reason=reason,
        )
        set_created_fields(lead)
        set_business(lead)
        db.session.add(lead)
        db.session.flush()

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

        db.session.commit()
        return jsonify({"message": "Lead created successfully", "uuid": str(lead.uuid)}), 200

    except Exception as e:
        db.session.rollback()
        import traceback; print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


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
        data = request.json
        lead = Lead.query.get_or_404(lead_id)

        lead.first_name = data.get("first_name", lead.first_name)
        lead.last_name = data.get("last_name", lead.last_name)
        lead.mobile = data.get("mobile", lead.mobile)
        lead.email = data.get("email", lead.email)
        lead.gst = data.get("gst", lead.gst)
        lead.status = data.get("status", lead.status)
        lead.reason = data.get("reason", lead.reason)

        set_updated_fields(lead)
        db.session.commit()
        return jsonify({"message": "Lead updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        import traceback; print(traceback.format_exc())
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
        Lead.query.filter_by(uuid=lead_id)
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
        "status": str(lead.status),
        "reason": lead.reason,
        "addresses": addresses,
    })


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




