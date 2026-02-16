from datetime import datetime, date
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from sqlalchemy import or_, func, desc, asc, and_
from app.extensions import db
from app.models.quotation import Quotation, QuotationItem
from app.models.customer import Customer
from app.models.inventory import Item
from app.models.business import Business
from app.models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

quotation_blueprint = Blueprint("quotation", __name__)

def generate_quotation_number():
    """Generate a unique quotation number like QT-1001"""
    last_quotation = Quotation.query.order_by(Quotation.created_at.desc()).first()
    if last_quotation and last_quotation.quotation_number:
        try:
            last_num = int(last_quotation.quotation_number.split('-')[1])
            return f"QT-{last_num + 1}"
        except (IndexError, ValueError):
            pass
    return "QT-1001"


def check_and_update_quotation_status():
    """Check and update quotation status based on valid_till date"""
    today = date.today()
    
    # Find all open quotations that have expired or are expiring today
    expired_quotations = Quotation.query.filter(
        and_(
            Quotation.status == 'open',
            Quotation.valid_till <= today
        )
    ).all()
    
    updated_count = 0
    for quotation in expired_quotations:
        quotation.status = 'closed'
        updated_count += 1
    
    if updated_count > 0:
        db.session.commit()
        # print(f"DEBUG: Updated {updated_count} quotations to 'closed' status (valid_till <= {today})")
    
    return updated_count


@quotation_blueprint.route("/next-number", methods=["GET"])
def get_next_quotation_number():
    """
    Get the next available quotation number
    ---
    tags:
      - Quotations
    responses:
      200:
        description: Next quotation number
    """
    try:
        next_number = generate_quotation_number()
        return jsonify({"next_quotation_number": next_number}), 200
    except Exception as e:
        return jsonify({"error": "Failed to generate quotation number", "details": str(e)}), 500


@quotation_blueprint.route("/", methods=["POST"])
def create_quotation():
    """
    Create a new quotation
    ---
    tags:
      - Quotations
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - business_id
              - customer_id
              - quotation_date
              - total_amount
            properties:
              business_id:
                type: integer
              customer_id:
                type: string
                format: uuid
              quotation_date:
                type: string
                format: date
              valid_till:
                type: string
                format: date
              total_amount:
                type: number
              charges:
                type: object
              additional_notes:
                type: object
              items:
                type: array
    responses:
      201:
        description: Quotation created successfully
      400:
        description: Validation error
      500:
        description: Server error
    """

    data = request.get_json()
    try:
        # Generate quotation number
        quotation_number = data.get("quotation_number") or generate_quotation_number()
        
        # Build charges JSON
        charges = {
            "subtotal": data.get("subtotal", 0),
            "tax_total": data.get("total_tax", 0),
            "discount_total": data.get("total_discount", 0),
            "additional_charges_total": data.get("additional_charges_total", 0),
            "round_off": data.get("round_off", 0),
        }
        
        # Build additional_notes JSON
        additional_notes = {
            "notes": data.get("notes", ""),
            "terms_and_conditions": data.get("terms_and_conditions", ""),
            "version": 1,
        }
        
        quotation = Quotation(
            quotation_number=quotation_number,
            business_id=data["business_id"],
            customer_id=data["customer_id"],
            quotation_date=data["quotation_date"],
            valid_till=data.get("valid_till") or data.get("validity_date"),
            total_amount=data["total_amount"],
            charges=charges,
            status=data.get("status", "open"),
            additional_notes=additional_notes,
        )
        # set_created_fields(quotation, user_id=data.get("uuid"))
        db.session.add(quotation)
        db.session.flush()  # Get the UUID before committing

        # Process items
        for item_data in data.get("items", []):
            # Build discount JSON
            discount = {
                "discount_percentage": item_data.get("discount", 0),
                "discount_amount": item_data.get("discount_amount", 0),
            }
            
            # Build tax JSON
            tax = {
                "tax_percentage": item_data.get("tax", 0),
                "tax_amount": item_data.get("tax_amount", 0),
            }
            
            item = QuotationItem(
                quotation_id=quotation.uuid,
                item_id=item_data.get("item_id"),
                description=item_data.get("description"),
                quantity=item_data["quantity"],
                unit_price=item_data.get("unit_price") or item_data.get("price_per_item"),
                discount=discount,
                tax=tax,
                total_price=item_data.get("total_price") or item_data.get("amount"),
            )
            # set_created_fields(item, user_id=data.get("uuid"))
            db.session.add(item)

        db.session.commit()

        return jsonify({
            "message": "Quotation created successfully",
            "quotation_uuid": str(quotation.uuid),
            "quotation_number": quotation.quotation_number
        }), 201
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
    except KeyError as e:
        db.session.rollback()
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


@quotation_blueprint.route("/", methods=["GET"])
def get_quotations():
    """
    Get all quotations with pagination, search, and sorting.
    ---
    tags:
      - Quotations
    parameters:
      - name: search
        in: query
        required: false
        type: string
        description: Search term to filter by party name or quotation number
      - name: party_name
        in: query
        required: false
        type: string
        description: Filter by party name
      - name: quotation_number
        in: query
        required: false
        type: string
        description: Filter by quotation number
      - name: status
        in: query
        required: false
        type: string
        description: Filter by status (open, closed, etc.)
      - name: page
        in: query
        required: false
        schema:
          type: integer
        description: Page number (default: 1)
      - name: items_per_page
        in: query
        required: false
        schema:
          type: integer
        description: Items per page (default: 5)
      - name: sort
        in: query
        required: false
        schema:
          type: string
        description: Sort field (default: created_at)
      - name: order
        in: query
        required: false
        schema:
          type: string
        description: Sort order: asc or desc (default: desc)
      - name: dropdown
        in: query
        required: false
        schema:
          type: boolean
        description: Return simplified format for dropdowns
      - name: customer_dropdown_all
        in: query
        required: false
        schema:
          type: boolean
        description: Return all unique customers (party names) for dropdown
    responses:
      200:
        description: A paginated list of quotations.
    """
    try:
        # Check and update quotation status based on valid_till date
        check_and_update_quotation_status()
        
        # Log the incoming request parameters for debugging
        # print(f"DEBUG: get_quotations called with args: {dict(request.args)}")
        
        # Start with base query
        query = Quotation.query
        
        # Get search parameters
        search = request.args.get('search', '').strip()
        party_name = request.args.get('party_name', '').strip()
        quotation_number = request.args.get('quotation_number', '').strip()
        status = request.args.get('status', '').strip()
        
        # Apply search filters with priority to search parameter
        if search:
            # If search parameter is provided, use it for both party name and quotation number
            # Also handle multiple spaces by normalizing them
            normalized_search = ' '.join(search.split())
            query = query.outerjoin(Customer, Quotation.customer_id == Customer.uuid).filter(
                or_(
                    Quotation.quotation_number.ilike(f'%{search}%'),
                    Customer.first_name.ilike(f'%{search}%'),
                    Customer.last_name.ilike(f'%{search}%'),
                    func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{search}%'),
                    func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{normalized_search}%')
                )
            )
        else:
            # If no search parameter, check individual filters
            if party_name:
                # Handle multiple spaces by normalizing them
                normalized_party_name = ' '.join(party_name.split())
                query = query.outerjoin(Customer, Quotation.customer_id == Customer.uuid).filter(
                    or_(
                        Customer.first_name.ilike(f'%{party_name}%'),
                        Customer.last_name.ilike(f'%{party_name}%'),
                        func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{party_name}%'),
                        func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{normalized_party_name}%')
                    )
                )
            
            if quotation_number:
                query = query.filter(Quotation.quotation_number.ilike(f'%{quotation_number}%'))
            
            # If no filters are applied, ensure we still have the customer join for consistent behavior
            if not party_name and not quotation_number:
                query = query.outerjoin(Customer, Quotation.customer_id == Customer.uuid)

        # Apply status filter if provided
        if status and status != '':
            query = query.filter(Quotation.status == status)
           
        # Handle sorting - prioritize due date (valid_till) first, then other fields
        sort = request.args.get("sort", "valid_till")  # Default sort by valid_till (due date)
        order = request.args.get("order", "asc").upper()  # Default order is 'asc' for due dates (urgent first)

        if sort == "quotation_number":
            if order == "desc":
                query = query.order_by(db.desc(Quotation.quotation_number))
            else:
                query = query.order_by(Quotation.quotation_number)
        elif sort == "quotation_date":
            if order == "desc":
                query = query.order_by(db.desc(Quotation.quotation_date))
            else:
                query = query.order_by(Quotation.quotation_date)
        elif sort == "total_amount":
            if order == "desc":
                query = query.order_by(db.desc(Quotation.total_amount))
            else:
                query = query.order_by(Quotation.total_amount)
        elif sort == "status":
            if order == "desc":
                query = query.order_by(db.desc(Quotation.status))
            else:
                query = query.order_by(Quotation.status)
        elif sort == "valid_till":
            # Sort by due date - ascending shows urgent items first (fewest days remaining)
            if order == "desc":
                query = query.order_by(db.desc(Quotation.valid_till))
            else:
                query = query.order_by(Quotation.valid_till)
        else:
            # Handle other fields (including created_at)
            if sort.startswith("-"):
                query = query.order_by(db.desc(getattr(Quotation, sort[1:], "id")))
            else:
                query = query.order_by(getattr(Quotation, sort, "id"))

        # Return all quotations for dropdown if requested
        if request.args.get("dropdown") == "true":
            quotations = query.outerjoin(Customer, Quotation.customer_id == Customer.uuid).all()
            return jsonify([
                {
                    "uuid": str(q.uuid),
                    "quotation_number": q.quotation_number,
                    "customer_name": f"{q.customer.first_name} {q.customer.last_name}" if q.customer else None
                }
                for q in quotations
            ]), 200
        
        # Return customer names dropdown if requested
        if request.args.get("customer_dropdown") == "true":
            # Start fresh query for customer dropdown
            customer_query = Quotation.query.outerjoin(Customer, Quotation.customer_id == Customer.uuid)
            customers = customer_query.with_entities(
                Customer.uuid,
                Customer.first_name,
                Customer.last_name,
                func.concat(Customer.first_name, ' ', Customer.last_name).label('full_name')
            ).distinct().all()
            
            result = []
            for customer in customers:
                result.append({
                    "uuid": str(customer.uuid),
                    "name": customer.full_name.strip()
                })
            
            # Sort by name
            result.sort(key=lambda x: x['name'])
            return jsonify(result), 200
        
        # Return quotation numbers dropdown if requested
        if request.args.get("quotation_number_dropdown") == "true":
            # Start fresh query for quotation number dropdown
            quotation_query = Quotation.query.with_entities(
                Quotation.uuid,
                Quotation.quotation_number
            ).distinct().order_by(Quotation.quotation_number).all()
                      
            result = []
            for q in quotation_query:
                result.append({
                    "uuid": str(q.uuid),
                    "quotation_number": q.quotation_number
                })
            
            return jsonify(result), 200

        # Return all customers (party names) for dropdown if requested
        if request.args.get("customer_dropdown_all") == "true":
            # Get all unique customers from ALL quotations (not just current page)
            customer_query = Quotation.query.outerjoin(Customer, Quotation.customer_id == Customer.uuid).with_entities(
                Customer.uuid,
                Customer.first_name,
                Customer.last_name
            ).distinct().all()
            
            # Debug: Log all quotations and their customers
            all_quotations = Quotation.query.all()
            for q in all_quotations:
                customer = Customer.query.filter_by(uuid=q.customer_id).first()
                customer_name = f"{customer.first_name} {customer.last_name}" if customer else "Unknown"
            
            result = []
            for customer in customer_query:
                if customer.uuid and (customer.first_name or customer.last_name):  # Only include customers with valid UUID and name
                    full_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                    if full_name:  # Only include if name is not empty after stripping
                        result.append({
                            "uuid": str(customer.uuid),
                            "name": full_name
                        })
            
            # Sort by name alphabetically
            result.sort(key=lambda x: x['name'].lower())
            return jsonify(result), 200

        # Paginated results for main grid (same pattern as item.py)
        page = int(request.args.get("page", 1))
        # Accept both 'per_page' and 'items_per_page' for frontend compatibility
        per_page = int(request.args.get("per_page") or request.args.get("items_per_page") or 5)
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        quotations = pagination.items

        # Get customer data separately to avoid relationship issues
        customer_ids = [q.customer_id for q in quotations]
        customers = {c.uuid: c for c in Customer.query.filter(Customer.uuid.in_(customer_ids)).all()} if customer_ids else {}

        # Shape response to match frontend expectations: { data: [...], pagination: { total, ... } }
        result = []
        for q in quotations:
            result.append({
                "uuid": str(q.uuid),
                "quotation_number": q.quotation_number,
                "quotation_date": q.quotation_date.isoformat() if q.quotation_date else None,
                "valid_till": q.valid_till.isoformat() if q.valid_till else None,
                "customer_id": str(q.customer_id),
                "customer_name": f"{customers[q.customer_id].first_name} {customers[q.customer_id].last_name}" if q.customer_id in customers else None,
                "total_amount": float(q.total_amount) if q.total_amount else 0,
                "status": q.status,
                "charges": q.charges,
                "created_at": q.created_at.isoformat() if q.created_at else None,
            })

        response_data = {
            "data": result,
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

        # print(f"DEBUG: API Response - Total: {response_data['pagination']['total']}, Pages: {response_data['pagination']['last_page']}, Current Page: {response_data['pagination']['current_page']}")
                
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch quotations",
            "details": str(e)
        }), 500


@quotation_blueprint.route("/<uuid:quotation_id>", methods=["GET"])
def get_quotation(quotation_id):
    """
    Get a single quotation by ID
    ---
    tags:
      - Quotations
    parameters:
      - name: quotation_id
        in: path
        required: true
        type: string
        format: uuid
        description: Quotation UUID
    responses:
      200:
        description: Quotation details
      404:
        description: Quotation not found
    """
    try:
        # Check and update quotation status based on valid_till date
        check_and_update_quotation_status()
        
        quotation = Quotation.query.filter_by(uuid=quotation_id).first()
        if not quotation:
            return jsonify({"error": "Quotation not found"}), 404

        # Fetch quotation items
        items = QuotationItem.query.filter_by(quotation_id=quotation.uuid).all()
        items_data = []

        for item in items:
            item_info = {
                "uuid": str(item.uuid),
                "item_id": item.item_id,
                "description": item.description,
                "quantity": float(item.quantity) if item.quantity else 0,
                "unit_price": float(item.unit_price) if item.unit_price else 0,
                "discount": item.discount or {},
                "tax": item.tax or {},
                "total_price": float(item.total_price) if item.total_price else 0,
            }
            
            # Fetch product details from linked inventory item
            if item.item_id:
                inventory_item = Item.query.get(item.item_id)
                if inventory_item:
                    item_info["product_name"] = inventory_item.item_name
                    item_info["hsn_sac_code"] = inventory_item.hsn_code
                    item_info["measuring_unit_id"] = inventory_item.measuring_unit_id
            
            items_data.append(item_info)

        quotation_data = {
            "uuid": str(quotation.uuid),
            "quotation_number": quotation.quotation_number,
            "business_id": quotation.business_id,
            "customer_id": str(quotation.customer_id),
            "customer": {
                "uuid": str(quotation.customer.uuid),
                "first_name": quotation.customer.first_name,
                "last_name": quotation.customer.last_name,
                "mobile": quotation.customer.mobile,
                "email": quotation.customer.email,
            } if quotation.customer else None,
            "quotation_date": quotation.quotation_date.isoformat() if quotation.quotation_date else None,
            "valid_till": quotation.valid_till.isoformat() if quotation.valid_till else None,
            "total_amount": float(quotation.total_amount) if quotation.total_amount else 0,
            "charges": quotation.charges or {},
            "status": quotation.status,
            "additional_notes": quotation.additional_notes or {},
            "items": items_data,
            "created_at": quotation.created_at.isoformat() if quotation.created_at else None,
            "updated_at": quotation.updated_at.isoformat() if quotation.updated_at else None,
        }

        return jsonify(quotation_data), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch quotation",
            "details": str(e)
        }), 500


@quotation_blueprint.route("/<uuid:quotation_id>", methods=["PUT"])
def update_quotation(quotation_id):
    """
    Update a quotation with items
    ---
    tags:
      - Quotations
    parameters: 
      - name: quotation_id
        in: path
        required: true
        type: string
        format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              quotation_date:
                type: string
                format: date
              valid_till:
                type: string
                format: date
              total_amount:
                type: number
              status:
                type: string
              charges:
                type: object
              additional_notes:
                type: object
              items:
                type: array
    responses:
      200:
        description: Quotation updated successfully
      400:  
        description: Validation error
      404:
        description: Quotation not found
      500:  
        description: Server error

    """
    data = request.get_json()
    quotation = Quotation.query.get_or_404(quotation_id)

    try:
        # -----------------------------
        # Update quotation basic fields
        # -----------------------------
        quotation.quotation_date = data.get("quotation_date", quotation.quotation_date)
        quotation.valid_till = data.get("valid_till") or data.get("validity_date") or quotation.valid_till
        quotation.total_amount = data.get("total_amount", quotation.total_amount)
        quotation.status = data.get("status", quotation.status)

        # -----------------------------
        # Update charges JSON
        # -----------------------------
        quotation.charges = {
            "subtotal": data.get("subtotal", quotation.charges.get("subtotal", 0)),
            "tax_total": data.get("total_tax", quotation.charges.get("tax_total", 0)),
            "discount_total": data.get("total_discount", quotation.charges.get("discount_total", 0)),
            "additional_charges_total": data.get(
                "additional_charges_total",
                quotation.charges.get("additional_charges_total", 0),
            ),
            "round_off": data.get("round_off", quotation.charges.get("round_off", 0)),
        }

        # -----------------------------
        # Update additional_notes JSON
        # -----------------------------
        additional_notes = quotation.additional_notes or {}
        additional_notes["notes"] = data.get("notes", additional_notes.get("notes", ""))
        additional_notes["terms_and_conditions"] = data.get(
            "terms_and_conditions",
            additional_notes.get("terms_and_conditions", ""),
        )
        additional_notes["version"] = additional_notes.get("version", 0) + 1
        quotation.additional_notes = additional_notes

        # -----------------------------
        # Update quotation items
        # Strategy: delete + reinsert
        # -----------------------------
        QuotationItem.query.filter_by(quotation_id=quotation.uuid).delete()

        for item_data in data.get("items", []):
            discount = {
                "discount_percentage": item_data.get("discount", 0),
                "discount_amount": item_data.get("discount_amount", 0),
            }

            tax = {
                "tax_percentage": item_data.get("tax", 0),
                "tax_amount": item_data.get("tax_amount", 0),
            }

            item = QuotationItem(
                quotation_id=quotation.uuid,
                item_id=item_data.get("item_id"),
                description=item_data.get("description"),
                quantity=item_data["quantity"],
                unit_price=item_data.get("unit_price") or item_data.get("price_per_item"),
                discount=discount,
                tax=tax,
                total_price=item_data.get("total_price") or item_data.get("amount"),
            )
            db.session.add(item)

        db.session.commit()

        return jsonify({
            "message": "Quotation updated successfully",
            "quotation_uuid": str(quotation.uuid),
            "quotation_number": quotation.quotation_number
        }), 200

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"error": "Integrity error", "details": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An error occurred", "details": str(e)}), 500
    

    

@quotation_blueprint.route("/<uuid:quotation_id>", methods=["DELETE"])
def delete_quotation(quotation_id):
    """
    Delete a quotation
    ---
    tags:
      - Quotations
    parameters:
      - name: quotation_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Quotation deleted successfully
      404:
        description: Quotation not found
    """
    quotation = Quotation.query.get_or_404(quotation_id)
    customer_name = None
    
    # Get customer name for debugging before deletion
    if quotation.customer_id:
        customer = Customer.query.filter_by(uuid=quotation.customer_id).first()
        if customer:
            customer_name = f"{customer.first_name} {customer.last_name}"
    
    try:
        db.session.delete(quotation)
        db.session.commit()
        
        # Check if customer has any remaining quotations
        remaining_quotations = Quotation.query.filter_by(customer_id=quotation.customer_id).count()
        
        return jsonify({
            "message": "Quotation deleted successfully",
            "customer_name": customer_name,
            "remaining_quotations": remaining_quotations
        }), 200
    except Exception as e:
        db.session.rollback()
        # print(f"ERROR: Failed to delete quotation {quotation_id}: {str(e)}")
        return jsonify({"error": "An error occurred", "details": str(e)}), 500


@quotation_blueprint.route("/quotation-dropdown", methods=["GET"])
def get_quotation_dropdown():
    """
    Get all quotations with quotation numbers and customer names for dropdown
    ---
    tags:
      - Quotations
    responses:
      200:
        description: List of quotations with numbers and customer names
    """
    try:
        # Get all quotations with customer names
        quotations = Quotation.query.outerjoin(Customer, Quotation.customer_id == Customer.uuid).all()
        
        result = []
        for quotation in quotations:
            customer_name = ""
            if quotation.customer:
                customer_name = f"{quotation.customer.first_name} {quotation.customer.last_name}".strip()
            
            result.append({
                "uuid": str(quotation.uuid),
                "quotation_number": quotation.quotation_number,
                "customer_name": customer_name,
                "display_name": f"{quotation.quotation_number} - {customer_name}" if customer_name else quotation.quotation_number
            })
        
        # Sort by quotation number
        result.sort(key=lambda x: x['quotation_number'])
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({
            "error": "Failed to fetch quotation dropdown",
            "details": str(e)
        }), 500


@quotation_blueprint.route("/suggestions", methods=["GET"])
@cross_origin()
def get_suggestions():
    """
    Get search suggestions for party names or quotation numbers
    ---
    tags:
      - Quotations
    parameters:
      - name: type
        in: query
        required: true
        type: string
        enum: [party_name, quotation_number]
        description: Type of suggestions to fetch
      - name: q
        in: query
        required: true
        type: string
        description: Search term for suggestions
      - name: limit
        in: query
        required: false
        type: integer
        default: 10
        description: Maximum number of suggestions to return
    responses:
      200:
        description: List of suggestions
        schema:
          type: object
          properties:
            success:
              type: boolean
            data:
              type: array
              items:
                type: string
      400:
        description: Bad request
      500:
        description: Server error
    """
    try:
        search_type = request.args.get('type')
        search_term = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 10))
        
        if not search_type or search_type not in ['party_name', 'quotation_number']:
            return jsonify({
                'success': False,
                'error': 'Invalid search type. Must be party_name or quotation_number'
            }), 400
        
        if not search_term:
            return jsonify({
                'success': True,
                'data': []
            }), 200
        
        if search_type == 'party_name':
            # Get unique customer names from quotations
            customers = Quotation.query.outerjoin(Customer, Quotation.customer_id == Customer.uuid).with_entities(
                Customer.uuid,
                Customer.first_name,
                Customer.last_name,
                func.concat(Customer.first_name, ' ', Customer.last_name).label('full_name')
            ).filter(
                or_(
                    Customer.first_name.ilike(f'%{search_term}%'),
                    Customer.last_name.ilike(f'%{search_term}%'),
                    func.concat(Customer.first_name, ' ', Customer.last_name).ilike(f'%{search_term}%')
                )
            ).distinct().limit(limit).all()
            
            suggestions = []
            for customer in customers:
                full_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                if full_name:
                    suggestions.append(full_name)
            
            # Sort alphabetically and remove duplicates
            suggestions = sorted(list(set(suggestions)))
            
        elif search_type == 'quotation_number':
            # Get quotation numbers
            quotations = Quotation.query.filter(
                Quotation.quotation_number.ilike(f'%{search_term}%')
            ).with_entities(
                Quotation.quotation_number
            ).distinct().limit(limit).all()
            
            suggestions = [q.quotation_number for q in quotations if q.quotation_number]
            # Sort numerically (extract number part)
            suggestions.sort(key=lambda x: int(x.split('-')[1]) if '-' in x and x.split('-')[1].isdigit() else x)
        
        return jsonify({
            'success': True,
            'data': suggestions[:limit]  # Ensure we don't exceed limit
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Failed to fetch suggestions',
            'details': str(e)
        }), 500
