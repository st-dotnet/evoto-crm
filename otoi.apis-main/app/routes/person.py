from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.person import Person, PersonType, PersonAddress
from app.models.active import Active, ActiveType
from app.models.common import Address
from app.models.customer import Customer
from app.utils.stamping import set_created_fields, set_updated_fields, set_business
from sqlalchemy import or_, func
from sqlalchemy import event

person_blueprint = Blueprint("person", __name__, url_prefix="/persons")

@person_blueprint.route("/", methods=["GET","OPTIONS"])
def get_persons():
    """
    Fetch a list of persons with filtering, sorting, and pagination.
    ---
    parameters:
      - name: filter[name]
        in: query
        description: Filter by name (first_name, last_name)
        required: false
        schema:
          type: string
      - name:filter[name]
        in: query
        description: Filter by name (email)
        required: true
        schema:
          type: string    

      - name: query
        in: query
        description: Search by first_name, last_name, email, test, or mobile
        required: false
        schema:
          type: string
      - name: mobile
        in: query
        description: Filter by mobile number
        required: false
        schema:
          type: string
      - name: person_type
        in: query
        description: Filter by person type ID
        required: false
        schema:
          type: integer
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
        description: A list of persons
        content:
          application/json:
            schema:
              type: object
              properties:
                pages:
                  type: integer
                  description: Total pages
                pagination:
                  type: object
                  properties:
                    total:
                      type: integer
                      description: Total number of records
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: Person ID
                      first_name:
                        type: string
                        description: First name
                      last_name:
                        type: string
                        description: Last name
                      mobile:
                        type: string
                        description: Mobile number
                      email:
                        type: string
                        description: Email address
                      # test:
                      #   type: string
                      #   description: test  
                      gst:
                        type: string
                        description: GST number
                      person_type:
                        type: string
                        description: Person type
    """
    try:

      query = Person.query

      # Filtering 
      if "filter[name]" in request.args:
          filter_value = request.args.get("filter[name]", "")
          query = query.filter(
            or_(
                Person.first_name.ilike(f"%{filter_value}%"),
                Person.last_name.ilike(f"%{filter_value}%"),
                Person.email.ilike(f"%{filter_value}%")
            )
          )
      if "query" in request.args:
          query_value = request.args.get("query", "")
          query = query.filter(
            or_(
                Person.first_name.ilike(f"%{query_value}%"),
                Person.last_name.ilike(f"%{query_value}%"),
                Person.email.ilike(f"%{query_value}%"),
                Person.gst.ilike(f"%{query_value}%"),
                Person.mobile.ilike(f"%{query_value}%"),
            )
          )
              
      if "mobile" in request.args:
          query = query.filter(Person.mobile.ilike(f"%{request.args['mobile']}%"))

      if "person_type" in request.args:
          person_type_id = request.args['person_type']
          query = query.filter(Person.person_type_id == person_type_id)

      # Sorting
      sort = request.args.get("sort", "uuid")
      order = request.args.get("order", "asc")  # Extract order ('asc' or 'desc')

      for field in sort.split(","):
        if field == "name":
            # Sort by concatenated first_name and last_name
            if order == "desc":
                query = query.order_by(db.desc(func.concat(Person.first_name, " ", Person.last_name)))
            else:
                query = query.order_by(func.concat(Person.first_name, " ", Person.last_name))      
        if field == "gst":
            # Sort by concatenated first_name and last_name
            if order == "desc":
                query = query.order_by(db.desc(Person.gst))
            else:
                query = query.order_by(Person.gst)
        if field == "mobile":
            # Sort by concatenated first_name and last_name
            if order == "desc":
                query = query.order_by(db.desc(Person.mobile))
            else:
                query = query.order_by(Person.mobile)        
        else:
          # Handle other fields
          if field.startswith("-"):
              query = query.order_by(db.desc(getattr(Person, field[1:], "uuid")))
          else:
              query = query.order_by(getattr(Person, field, "uuid"))

      # Pagination
      page = int(request.args.get("page", 1))
      per_page = int(request.args.get("items_per_page", 10))
      pagination = query.paginate(page=page, per_page=per_page, error_out=False)
      persons = pagination.items

      result = [
          {
              "uuid": person.uuid,
              "first_name": person.first_name,
              "last_name": person.last_name,
              "mobile": person.mobile,
              "email": person.email,
              "gst": person.gst,
              "person_type": person.person_type.name,
              "status": person.status,
          }
          for person in persons
      ]
      return jsonify({"pages": pagination.pages, "data": result , "pagination": { "total" : pagination.total}})

    except Exception as e:
      db.session.rollback()
      print("ERROR in update_person:", str(e))
      import traceback; print(traceback.format_exc())
      return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@person_blueprint.route("/test", methods=["GET"])
def get_test():
     return jsonify("api work ")

@person_blueprint.route("/", methods=["POST"])
def create_person():
    """
    Create a new person.
    ---
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              first_name: {type: string}
              last_name: {type: string}
              mobile: {type: string}
              email: {type: string}
              gst: {type: string}
              referenced_by: {type: string}
              person_type_id: {type: integer}
              status: {type: string, example: Win}
              reason: {type: string, description: Required if status=Lose}
              address:
                type: object
                description: Required if status=Win
                properties:
                  address1: {type: string}
                  address2: {type: string}
                  city: {type: string}
                  state: {type: string}
                  country: {type: string}
                  pin: {type: string}
    responses:
      200:
        description: Person created successfully
    """
    try:
        data = request.json
        print("=== DEBUG Incoming Data ===", data)

        # Validate person type
        person_type = PersonType.query.filter_by(id=data.get("person_type_id")).first()
        if not person_type:
            return jsonify({"error": "Invalid person type"}), 400

        status = str(data.get("status") or "").strip()
        # Default status for new Leads if not provided
        if (not status) and person_type and (person_type.name.lower() == "customer"):
            status = "1"  # New
        reason = None
        address_data = None

        # Validation for Lose
        if status.lower() in ["lose", "5"]:  # adjust if 4 = lose
            reason = data.get("reason")
            if not reason:
                return jsonify({"error": "Reason is required when status is 'Lose'"}), 400

        # Validation for Win → must provide address
        if status.lower() in ["win", "4"]:  # adjust if 4 = win
            address_data = data.get("address") or {
                "address1": data.get("address1") or data.get("addregst"),
                "address2": data.get("address2"),
                "city": data.get("city"),
                "state": data.get("state"),
                "country": data.get("country"),
                "pin": data.get("pin"),
            }
            if not all(address_data.get(k) for k in ["city", "state", "country", "pin"]):
                return jsonify({"error": "Address (city, state, country, pin) is required when status is 'Win'"}), 400

        # Duplicate check
        if Person.query.filter_by(mobile=data["mobile"]).first():
            return jsonify({"error": "A person with this mobile already exists"}), 400

        # Create Person
        person = Person(
            first_name=data["first_name"],
            last_name=data["last_name"],
            mobile=data["mobile"],
            email=data.get("email"),
            gst=data.get("gst"),
            person_type_id=data["person_type_id"],
            referenced_by=data.get("referenced_by"),
            status=status,
            reason=reason,
        )
        set_created_fields(person)
        set_business(person)
        db.session.add(person)
        db.session.flush()  # get UUID or ID

        # Save Address if present
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

            # Link table
            person_address = PersonAddress(
                person_id=person.uuid,   # or person.id if int FK
                address_id=address.uuid  # or address.id if int FK
            )
            set_created_fields(person_address)
            set_business(person_address)
            db.session.add(person_address)

        db.session.commit()
        return jsonify({"message": "Person created successfully", "uuid": str(person.uuid)}), 200

    except Exception as e:
        db.session.rollback()
        print("ERROR in create_person:", str(e))
        import traceback; print(traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@person_blueprint.route("/<uuid:person_id>", methods=["PUT"])
def update_person(person_id):
    """
    Update an existing person's details.
    ---
    parameters:
      - name: person_id
        in: path
        description: ID of the person to update
        required: true
        schema:
          type: integer
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              first_name:
                type: string
                description: First name of the person
                example: John
              last_name:
                type: string
                description: Last name of the person
                example: Doe
              mobile:
                type: string
                description: Mobile number
                example: 1234567890
              email:
                type: string
                description: Email address (optional)
                example: john.doe@example.com 
              gst:
                type: string
                description: GST number (optional)
                example: 12345ABCDE
              person_type_id:
                type: integer
                description: ID of the person type (optional)
                example: 1
    responses:
      200:
        description: Person updated successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Person updated successfully
      400:
        description: Invalid person type
      404:
        description: Person not found
    """
    try:
        data = request.json

        # Fetch person
        person = Person.query.get_or_404(person_id)

        # Update fields
        person.first_name = data.get("first_name", person.first_name)
        person.last_name = data.get("last_name", person.last_name)
        person.mobile = data.get("mobile", person.mobile)
        person.email = data.get("email", person.email)
        person.gst = data.get("gst", person.gst)
        person.referenced_by = data.get("referenced_by", person.referenced_by)

        # Validate person type
        if "person_type_id" in data and data["person_type_id"]:
            person_type = PersonType.query.filter_by(id=data["person_type_id"]).first()
            if not person_type:
                return jsonify({"error": "Invalid person type"}), 400
            person.person_type_id = data["person_type_id"]

        # Handle status
        status = str(data.get("status") or person.status or "").strip()
        person.status = status

        reason = None
        address_data = None

        # Lose → reason required
        if status.lower() in ["lose", "5"]:  # adjust if 4 = Lose
            reason = data.get("reason")
            if not reason:
                return jsonify({"error": "Reason is required when status is 'Lose'"}), 400
            person.reason = reason
        else:
            person.reason = data.get("reason", person.reason)

        # Win → must have address
        if status.lower() in ["win", "4"]:  # adjust if 1 = Win
            address_data = data.get("address") or {
                "address1": data.get("address1"),
                "address2": data.get("address2"),
                "city": data.get("city"),
                "state": data.get("state"),
                "country": data.get("country"),
                "pin": data.get("pin"),
            }
            if not all(address_data.get(k) for k in ["city", "state", "country", "pin"]):
                return jsonify({"error": "Address (city, state, country, pin) is required when status is 'Win'"}), 400

            # Check if person already has an address linked
            existing_link = PersonAddress.query.filter_by(person_id=person.uuid).first()
            if existing_link:
                address = Address.query.get(existing_link.address_id)
                if address:
                    address.address1 = address_data.get("address1", address.address1)
                    address.address2 = address_data.get("address2", address.address2)
                    address.city = address_data.get("city", address.city)
                    address.state = address_data.get("state", address.state)
                    address.country = address_data.get("country", address.country)
                    address.pin = address_data.get("pin", address.pin)
            else:
                # Create new address + link
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

                person_address = PersonAddress(
                    person_id=person.uuid,   # or person.id if int FK
                    address_id=address.uuid  # or address.id if int FK
                )
                set_created_fields(person_address)
                set_business(person_address)
                db.session.add(person_address)

        db.session.commit()
        return jsonify({"message": "Person updated successfully"}), 200

    except Exception as e:
        db.session.rollback()
        print("ERROR in update_person:", str(e))
        import traceback; print(traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@person_blueprint.route("/<uuid:person_id>", methods=["DELETE"])
def delete_person(person_id):
    """
    Delete a person by ID.
    ---
    parameters:
      - name: person_id
        in: path
        description: ID of the person to delete
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Person deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Person deleted successfully
      404:
        description: Person not found
    """
    person = Person.query.get_or_404(person_id)
    db.session.delete(person)
    db.session.commit()

    return jsonify({"message": "Person deleted successfully"})

@person_blueprint.route("/leads", methods=["GET","OPTIONS"])
def get_leads():
    """
    Fetch a list of persons with person_type 'Lead' with filtering, sorting, and pagination.
    ---
    tags:
      - Leads
    parameters:
      - name: filter[name]
        in: query
        description: Filter by name (first_name or last_name)
        required: false
        schema:
          type: string
      - name: query
        in: query
        description: Search by first_name, last_name, email, or mobile
        required: false
        schema:
          type: string
      - name: mobile
        in: query
        description: Filter by mobile number
        required: false
        schema:
          type: string
      - name: person_type
        in: query
        description: Filter by person type ID
        required: false
        schema:
          type: integer    
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
        content:
          application/json:
            schema:
              type: object
              properties:
                pages:
                  type: integer
                  description: Total pages
                pagination:
                  type: object
                  properties:
                    total:
                      type: integer
                      description: Total number of records
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: Person ID  
                      first_name:
                        type: string
                        description: First name
                      last_name:
                        type: string
                        description: Last name
                      mobile:
                        type: string
                        description: Mobile number
                      email:
                        type: string
                        description: Email address
                      person_type:
                        type: string
                        description: Person type  
      404:
        description: No leads found
    """
    query = (
        Person.query
        .join(PersonType)
        .filter(PersonType.name == "Lead")
    )

    # Filtering
    if "filter[name]" in request.args:
        filter_value = request.args.get("filter[name]", "")
        query = query.filter(
            or_(
                Person.first_name.ilike(f"%{filter_value}%"),
                Person.last_name.ilike(f"%{filter_value}%")
            )
        )
    if "query" in request.args:
        query_value = request.args.get("query", "")
        query = query.filter(
            or_(
                Person.first_name.ilike(f"%{query_value}%"),
                Person.last_name.ilike(f"%{query_value}%"),
                Person.email.ilike(f"%{query_value}%"),
                Person.mobile.ilike(f"%{query_value}%")
            )
        )
    if "mobile" in request.args:
        query = query.filter(Person.mobile.ilike(f"%{request.args['mobile']}%"))
    if "status" in request.args:
        status_value = request.args.get("status", "").strip()
        if status_value and status_value != "-1":
            code_to_text = {
                "1": "New",
                "2": "In-Progress",
                "3": "Quote-Given",
                "4": "Win",
                "5": "Lose",
            }
            mapped_text = code_to_text.get(status_value)
            if mapped_text:
                query = query.filter(
                    or_(
                        Person.status == status_value,
                        Person.status.ilike(mapped_text)
                    )
                )
            else:
                # If a text value is sent directly, filter by it (case-insensitive)
                query = query.filter(Person.status.ilike(status_value))
   

    # Sorting
    sort = request.args.get("sort", "uuid")
    for field in sort.split(","):
        if field.startswith("-"):
            query = query.order_by(db.desc(getattr(Person, field[1:], "uuid")))
        else:
            query = query.order_by(getattr(Person, field, "uuid"))

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 10))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    leads = pagination.items

    result = [
        {   "uuid": lead.uuid,
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "mobile": lead.mobile,
            "email": lead.email,
            "gst": lead.gst,
            "person_type": lead.person_type.name,
            "status": lead.status
        }
        for lead in leads
    ]
    return jsonify({
        "pages": pagination.pages,
        "pagination": {"total": pagination.total},
        "data": result
    })

@person_blueprint.route("/<uuid:person_id>", methods=["GET"])
def get_person_by_id(person_id):
    """
    Fetch a single person by their ID.
    ---
    tags:
      - Persons
    parameters:
      - name: person_id
        in: path
        description: ID of the person to fetch
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Details of the person
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  description: Person ID
                first_name:
                  type: string
                  description: First name
                last_name:
                  type: string
                  description: Last name
                mobile:
                  type: string
                  description: Mobile number
                email:
                  type: string
                  description: Email address
                # test:
                #    type: string
                #    descripton: test  
                gst:
                  type: string
                  description: GST number
                person_type:
                  type: string
                  description: Person type
      404:
        description: Person not found
    """
    # Fetch person by UUID
    person = Person.query.filter_by(uuid=person_id).first()
    if not person:
        return jsonify({"error": "Person not found"}), 404

    # Prepare the response
    result = {
        "uuid": person.uuid,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "mobile": person.mobile,
        "email": person.email,
        "gst": person.gst,
        "person_type": person.person_type.name,
    }

    return jsonify(result)


#Active

@person_blueprint.route("/", methods=["GET","OPTIONS"])
def get_active():
    """
    Fetch a list of persons with person_type 'active' with filtering, sorting, and pagination.
    ---
    tags:
      - Actives
    parameters:
      - name: filter[name]
        in: query
        description: Filter by name (first_name or last_name)
        required: false
        schema:
          type: string
      - name: query
        in: query
        description: Search by first_name, last_name, email, or mobile
        required: false
        schema:
          type: string
      - name: active_type
        in: query
        description: Filter by person type ID
        required: false
        schema:
          type: integer    
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
        content:
          application/json:
            schema:
              type: object
              properties:
                pages:
                  type: integer
                  description: Total pages
                pagination:
                  type: object
                  properties:
                    total:
                      type: integer
                      description: Total number of records
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      LAId:
                        type: integer
                        description: Person ID  
                      comment:
                        type: string
                        description: comment
                      active_type:
                        type: string
                        description: Active type 
                      status:
                         type: string
                         description: Lead status   
      404:
        description: No leads found
    """
    query = (
        Active.query
        .join(ActiveType)
        .filter(ActiveType.name == "Active")
    )

    # Filtering
    # if "filter[name]" in request.args:
    #     filter_value = request.args.get("filter[name]", "")
    #     query = query.filter(
    #         or_(
    #             Person.first_name.ilike(f"%{filter_value}%"),
    #             Person.last_name.ilike(f"%{filter_value}%")
    #         )
    #     )
    if "query" in request.args:
        query_value = request.args.get("query", "")
        query = query.filter(
            or_(
                Active.LAId.ilike(f"%{query_value}%"),
                Active.active_type_id.ilike(f"%{query_value}%"),
                Active.comment.ilike(f"%{query_value}%"),
                Active.person_type.ilike(f"%{query_value}%")
            )
        )
    # if "mobile" in request.args:
    #     query = query.filter(Person.mobile.ilike(f"%{request.args['mobile']}%"))
   

    # Sorting
    sort = request.args.get("sort", "uuid")
    for field in sort.split(","):
        if field.startswith("-"):
            query = query.order_by(db.desc(getattr(Person, field[1:], "uuid")))
        else:
            query = query.order_by(getattr(Person, field, "uuid"))

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 10))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    actives = pagination.items

    result = [
        {   "LAId": actives.LAId,
            "active_type": actives.active_type,
            "comment": actives.comment,
            "status": lead.status,
        }
        for lead in actives
    ]
    return jsonify({
        "pages": pagination.pages,
        "pagination": {"total": pagination.total},
        "data": result
    })




