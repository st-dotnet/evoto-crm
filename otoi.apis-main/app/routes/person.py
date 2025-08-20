from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.person import Person, PersonType, PersonAddress
from app.models.common import Address
from app.utils.stamping import set_created_fields, set_updated_fields, set_business
from sqlalchemy import or_, func

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
                      test:
                        type: string
                        description: test  
                      # gst:
                      #   type: string
                      #   description: GST number
                      person_type:
                        type: string
                        description: Person type
    """

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
              Person.test.ilike(f"%{query_value}%"),
              # Person.gst.ilike(f"%{query_value}%"),
              Person.mobile.ilike(f"%{query_value}%"),
          )
        )
            
    if "mobile" in request.args:
        query = query.filter(Person.mobile.ilike(f"%{request.args['mobile']}%"))

    if "person_type" in request.args:
        value = request.args['person_type']
        person_type = int(request.args['person_type'])
        query = query.filter(Person.person_type_id == person_type)

    # Sorting
    sort = request.args.get("sort", "id")
    order = request.args.get("order", "asc")  # Extract order ('asc' or 'desc')

    for field in sort.split(","):
      if field == "name":
          # Sort by concatenated first_name and last_name
          if order == "desc":
              query = query.order_by(db.desc(func.concat(Person.first_name, " ", Person.last_name)))
          else:
              query = query.order_by(func.concat(Person.first_name, " ", Person.last_name))
      if field == "test":
          # Sort by concatenated first_name and last_name
          if order == "desc":
              query = query.order_by(db.desc(Person.test))
          else:
              query = query.order_by(Person.test)        
      # if field == "gst":
      #     # Sort by concatenated first_name and last_name
      #     if order == "desc":
      #         query = query.order_by(db.desc(Person.gst))
      #     else:
      #         query = query.order_by(Person.gst)
      if field == "mobile":
          # Sort by concatenated first_name and last_name
          if order == "desc":
              query = query.order_by(db.desc(Person.mobile))
          else:
              query = query.order_by(Person.mobile)        
      else:
        # Handle other fields
        if field.startswith("-"):
            query = query.order_by(db.desc(getattr(Person, field[1:], "id")))
        else:
            query = query.order_by(getattr(Person, field, "id"))

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 10))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    persons = pagination.items

    result = [
        {
            "id": person.id,
            "first_name": person.first_name,
            "last_name": person.last_name,
            "mobile": person.mobile,
            "email": person.email,
            "test": person.test,
            # "gst": person.gst,
            "person_type": person.person_type.name,
        }
        for person in persons
    ]
    return jsonify({"pages": pagination.pages, "data": result , "pagination": { "total" : pagination.total}})

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
              test:
                type: string
                description: test
                example: test    
              # gst:
              #   type: string
              #   description: GST number (optional)
              #   example: 12345ABCDE
              referenced_by:
                type: string
                description: Referenced By (optional)
                example: Amit Jain
              person_type_id:
                type: integer
                description: ID of the person type
                example: 1
    responses:
      201:
        description: Person created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Person created successfully
                id:
                  type: integer
                  description: Created person ID
                  example: 1
      400:
        description: Invalid person type
    """
    data = request.json

    # Check if person_type_id is provided
    person_type_id = data.get("person_type_id")

    # Set default "Person Type" if not provided
    if person_type_id is None:
        # Default person type to "Lead" if creating a Lead, or "Customer" for other cases
        form_type = data.get("form_type", "person")  # Check if form type is provided
        if form_type == "lead":
            person_type = PersonType.query.filter_by(name="Lead").first()
        else:
            person_type = PersonType.query.filter_by(name="Customer").first()

        if person_type:
            person_type_id = person_type.id
        else:
            return jsonify({"error": "Invalid person type"}), 400  # If no default found, return error
        
    # Validate person type
    person_type = PersonType.query.filter_by(id=person_type_id).first()
    if not person_type:
        return jsonify({"error": "Invalid person type"}), 400

    # Create person
    person = Person(
        first_name=data["first_name"],
        last_name=data["last_name"],
        mobile=data["mobile"],
        email=data.get("email"),
        test=data["test"],
        # gst=data.get("gst"),
        person_type_id=person_type_id,
        referenced_by=data.get("referenced_by")
    )
    set_created_fields(person)
    set_business(person)
    db.session.add(person)
    db.session.commit()

    return jsonify({"message": "Person created successfully", "id": person.id}), 201

@person_blueprint.route("/<int:person_id>", methods=["PUT"])
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
              test:
                type: string
                description: test
                example: test  
              gst:
                # type: string
                # description: GST number (optional)
                # example: 12345ABCDE
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
    data = request.json

    # Fetch person
    person = Person.query.get_or_404(person_id)

    # Update fields
    person.first_name = data.get("first_name", person.first_name)
    person.last_name = data.get("last_name", person.last_name)
    person.mobile = data.get("mobile", person.mobile)
    person.email = data.get("email", person.email)
    person.test = data.get("test", person.test)
    # person.gst = data.get("gst", person.gst)
    person_type_id = data.get("person_type_id")
    person.referenced_by = data.get("referenced_by", person.referenced_by)
    if person_type_id:
        person_type = PersonType.query.filter_by(id=person_type_id).first()
        if not person_type:
            return jsonify({"error": "Invalid person type"}), 400
        person.person_type_id = person_type_id

    db.session.commit()
    return jsonify({"message": "Person updated successfully"})

@person_blueprint.route("/<int:person_id>", methods=["DELETE"])
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

    # Sorting
    sort = request.args.get("sort", "id")
    for field in sort.split(","):
        if field.startswith("-"):
            query = query.order_by(db.desc(getattr(Person, field[1:], "id")))
        else:
            query = query.order_by(getattr(Person, field, "id"))

    # Pagination
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("items_per_page", 10))
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    leads = pagination.items

    result = [
        {
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "mobile": lead.mobile,
            "email": lead.email,
        }
        for lead in leads
    ]
    return jsonify({
        "pages": pagination.pages,
        "pagination": {"total": pagination.total},
        "data": result
    })
  

@person_blueprint.route("/<int:person_id>", methods=["GET"])
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
                test:
                   type: string
                   descripton: test  
                # gst:
                #   type: string
                #   description: GST number
                person_type:
                  type: string
                  description: Person type
      404:
        description: Person not found
    """
    # Fetch person by ID
    person = Person.query.get_or_404(person_id)

    # Prepare the response
    result = {
        "id": person.id,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "mobile": person.mobile,
        "email": person.email,
        "test": person.test,
        # "gst": person.gst,
        "person_type": person.person_type.name,
    }

    return jsonify(result)


