# from app.extensions import db
# from app.models.quotation import QuotationItem, Quotation
# from app.models import Item, Customer
# from flask import Blueprint, jsonify, request
# from uuid import UUID
# from sqlalchemy.exc import IntegrityError
# from sqlalchemy import or_, func

# quotation_item_blueprint = Blueprint("quotation_item", __name__, url_prefix="/quotation-items")


# @quotation_item_blueprint.route("/", methods=["GET"])
# def get_quotation_items():
#     """
#     Get all quotation items with pagination, search, and sorting.
#     ---
#     tags:
#       - Quotation Items
#     parameters:
#       - name: query
#         in: query
#         required: false
#         schema:
#           type: string
#         description: Search term for item name, description, customer name, or quotation number
#       - name: quotation_id
#         in: query
#         required: false
#         schema:
#           type: string
#           format: uuid
#         description: Filter by quotation UUID
#       - name: page
#         in: query
#         required: false
#         schema:
#           type: integer
#         description: Page number (default: 1)
#       - name: items_per_page
#         in: query
#         required: false
#         schema:
#           type: integer
#         description: Items per page (default: 5)
#       - name: sort
#         in: query
#         required: false
#         schema:
#           type: string
#         description: Sort field (default: created_at)
#       - name: order
#         in: query
#         required: false
#         schema:
#           type: string
#         description: Sort order: asc or desc (default: desc)
#       - name: dropdown
#         in: query
#         required: false
#         schema:
#           type: boolean
#         description: Return simplified format for dropdowns
#     responses:
#       200:
#         description: A paginated list of quotation items.
#         content:
#           application/json:
#             schema:
#               type: object
#               properties:
#                 data:
#                   type: array
#                   items:
#                     type: object
#                 pagination:
#                   type: object
#                   properties:
#                     total:
#                       type: integer
#                     items_per_page:
#                       type: integer
#                     current_page:
#                       type: integer
#                     last_page:
#                       type: integer
#     """
#     try:
#         # Start with base query including joins for related data
#         query = QuotationItem.query.join(Quotation, QuotationItem.quotation_id == Quotation.uuid)\
#                                   .join(Item, QuotationItem.item_id == Item.id, isouter=True)\
#                                   .join(Customer, Quotation.customer_id == Customer.uuid, isouter=True)

#         # Filter by quotation_id if provided
#         if "quotation_id" in request.args:
#             quotation_id_value = request.args.get("quotation_id", "").strip()
#             if quotation_id_value:
#                 try:
#                     quotation_uuid = UUID(quotation_id_value)
#                     query = query.filter(QuotationItem.quotation_id == quotation_uuid)
#                 except ValueError:
#                     return jsonify({"error": "Invalid quotation_id format"}), 400

#         # Search query filter
#         if "query" in request.args:
#             query_value = request.args.get("query", "").strip()
#             if query_value:
#                 query = query.filter(
#                     or_(
#                         Item.item_name.ilike(f"%{query_value}%") if Item else False,
#                         QuotationItem.description.ilike(f"%{query_value}%"),
#                         QuotationItem.uuid.ilike(f"%{query_value}%"),
#                         func.concat(Customer.first_name, " ", Customer.last_name).ilike(f"%{query_value}%") if Customer else False,
#                         Quotation.quotation_number.ilike(f"%{query_value}%") if Quotation else False
#                     )
#                 )

#         # Sorting
#         sort = request.args.get("sort", "created_at")  # Default sort by created_at
#         order = request.args.get("order", "desc").upper()  # Default order is 'desc'

#         for field in sort.split(","):
#             if field == "quantity":
#                 if order == "desc":
#                     query = query.order_by(db.desc(QuotationItem.quantity))
#                 else:
#                     query = query.order_by(QuotationItem.quantity)
#             elif field == "unit_price":
#                 if order == "desc":
#                     query = query.order_by(db.desc(QuotationItem.unit_price))
#                 else:
#                     query = query.order_by(QuotationItem.unit_price)
#             elif field == "total_price":
#                 if order == "desc":
#                     query = query.order_by(db.desc(QuotationItem.total_price))
#                 else:
#                     query = query.order_by(QuotationItem.total_price)
#             elif field == "item_name":
#                 if Item:
#                     if order == "desc":
#                         query = query.order_by(db.desc(Item.item_name))
#                     else:
#                         query = query.order_by(Item.item_name)
#             elif field == "customer_name":
#                 if Customer:
#                     if order == "desc":
#                         query = query.order_by(db.desc(func.concat(Customer.first_name, " ", Customer.last_name)))
#                     else:
#                         query = query.order_by(func.concat(Customer.first_name, " ", Customer.last_name))
#             elif field == "quotation_number":
#                 if Quotation:
#                     if order == "desc":
#                         query = query.order_by(db.desc(Quotation.quotation_number))
#                     else:
#                         query = query.order_by(Quotation.quotation_number)
#             else:
#                 # Handle other fields
#                 if field.startswith("-"):
#                     query = query.order_by(db.desc(getattr(QuotationItem, field[1:], "created_at")))
#                 else:
#                     query = query.order_by(getattr(QuotationItem, field, "created_at"))

#         # Return all items for dropdown if requested
#         if request.args.get("dropdown") == "true":
#             items = query.all()
#             return jsonify([
#                 {
#                     "uuid": str(item.uuid),
#                     "item_name": item.item.item_name if item.item else "",
#                     "customer_name": f"{item.quotation.customer.first_name} {item.quotation.customer.last_name}" if item.quotation and item.quotation.customer else "",
#                     "quotation_number": item.quotation.quotation_number if item.quotation else "",
#                     "quantity": float(item.quantity),
#                     "unit_price": float(item.unit_price)
#                 }
#                 for item in items
#             ])

#         # Paginated results for the main grid
#         page = int(request.args.get("page", 1))
#         per_page = int(request.args.get("items_per_page", 5))
#         pagination = query.paginate(page=page, per_page=per_page, error_out=False)
#         items = pagination.items

#         # Shape response to match frontend expectations: { data: [...], pagination: { total, ... } }
#         result = []
#         for item in items:
#             result.append({
#                 "uuid": str(item.uuid),
#                 "quotation_id": str(item.quotation_id),
#                 "item_id": str(item.item_id) if item.item_id else None,
#                 "item_name": item.item.item_name if item.item else None,
#                 "description": item.description or "",
#                 "quantity": float(item.quantity),
#                 "unit_price": float(item.unit_price),
#                 "discount": item.discount or {},
#                 "tax": item.tax or {},
#                 "total_price": float(item.total_price),
#                 "customer_name": f"{item.quotation.customer.first_name} {item.quotation.customer.last_name}" if item.quotation and item.quotation.customer else None,
#                 "quotation_number": item.quotation.quotation_number if item.quotation else None,
#                 "created_at": item.created_at.isoformat() if item.created_at else None,
#                 "updated_at": item.updated_at.isoformat() if item.updated_at else None
#             })

#         response_data = {
#             "data": result,
#             "pagination": {
#                 "total": pagination.total,
#                 "items_per_page": per_page,
#                 "current_page": page,
#                 "last_page": pagination.pages,
#                 "from": (
#                     (pagination.page - 1) * per_page + 1 if pagination.total > 0 else 0
#                 ),
#                 "to": min(pagination.page * per_page, pagination.total),
#                 "prev_page_url": None,
#                 "next_page_url": None,
#                 "first_page_url": None,
#             },
#         }
                
#         return jsonify(response_data)

#     except Exception as e:
#         print(f"Error in get_quotation_items: {str(e)}")
#         return jsonify({
#             "error": "Failed to fetch quotation items",
#             "details": str(e)
#         }), 500

# @quotation_item_blueprint.route("/", methods=["POST"])
# def create_quotation_item():
#     """
#     Create a new quotation item.
#     ---
#     tags:
#       - Quotation Items
#     requestBody:
#       required: true
#       content:
#         application/json:
#           schema:
#             type: object
#             required:
#               - quotation_id
#               - item_id
#               - quantity
#               - price
#             properties:
#               quotation_id:
#                 type: string
#                 format: uuid
#                 description: Associated quotation UUID
#               item_id:
#                 type: string
#                 format: uuid
#                 description: Associated item UUID
#               quantity:
#                 type: integer
#                 description: Quantity of the item
#               price:
#                 type: number
#                 format: float
#                 description: Price of the item
#     responses:
#       201:  
#         description: Quotation item created successfully.
#         content:
#           application/json:
#             schema:
#               type: object
#               properties:
#                 uuid:
#                   type: string
#                   format: uuid
#                 quotation_id:
#                   type: string
#                   format: uuid
#                 item_id:
#                   type: string
#                   format: uuid
#                 quantity:
#                   type: integer
#                 price:
#                   type: number
#                   format: float
#     """
#     data = request.get_json()
#     try:
#         quotation_item = QuotationItem(
#             quotation_id=UUID(data['quotation_id']),
#             item_id=UUID(data['item_id']),
#             quantity=data['quantity'],
#             price=data['price']
#         )
#         db.session.add(quotation_item)
#         db.session.commit()
#         return jsonify({
#             'uuid': str(quotation_item.uuid),
#             'quotation_id': str(quotation_item.quotation_id),
#             'item_id': str(quotation_item.item_id),
#             'quantity': quotation_item.quantity,
#             'price': quotation_item.price
#         }), 201
#     except (KeyError, ValueError):
#         return jsonify({'error': 'Invalid input'}), 400
#     except IntegrityError:
#         db.session.rollback()
#         return jsonify({'error': 'Database integrity error'}), 400
    
#     except Exception as e:
#         db.session.rollback()
#         return jsonify({'error': str(e)}), 500  
    
# @quotation_item_blueprint.route("/<uuid:item_id>", methods=["GET"])
# def get_quotation_item(item_id):
#     """
#     Get a quotation item by its UUID.
#     ---
#     tags:
#       - Quotation Items
#     parameters:
#       - name: item_id
#         in: path
#         description: UUID of the quotation item to retrieve
#         required: true
#         schema:
#           type: string
#           format: uuid
#     responses:
#       200:
#         description: Quotation item details.
#         content:
#           application/json:
#             schema:
#               type: object
#               properties:
#                 uuid:
#                   type: string
#                   format: uuid
#                 quotation_id:
#                   type: string
#                   format: uuid
#                 item_id:
#                   type: string
#                   format: uuid
#                 quantity:
#                   type: integer
#                 price:
#                   type: number
#                   format: float
#       404:
#         description: Quotation item not found.
#     """
#     item = QuotationItem.query.get(item_id)
#     if item:
#         return jsonify({
#             'uuid': str(item.uuid),
#             'quotation_id': str(item.quotation_id),
#             'item_id': str(item.item_id),
#             'quantity': item.quantity,
#             'price': item.price
#         })
#     else:
#         return jsonify({'error': 'Quotation item not found'}), 404
    
# @quotation_item_blueprint.route("/<uuid:item_id>", methods=["DELETE"])
# def delete_quotation_item(item_id):
#     """
#     Delete a quotation item by its UUID.
#     ---
#     tags:
#       - Quotation Items
#     parameters:
#       - name: item_id
#         in: path
#         description: UUID of the quotation item to delete
#         required: true
#         schema:
#           type: string
#           format: uuid
#     responses:
#       200:
#         description: Quotation item deleted successfully.
#         content:
#           application/json:
#             schema:
#               type: object
#               properties:
#                 message:
#                   type: string
#       404:
#         description: Quotation item not found.
#     """
#     item = QuotationItem.query.get(item_id)
#     if item:
#         db.session.delete(item)
#         db.session.commit()
#         return jsonify({'message': 'Quotation item deleted successfully'})
#     else:
#         return jsonify({'error': 'Quotation item not found'}), 404
    

# @quotation_item_blueprint.route("/<uuid:item_id>", methods=["PUT"])
# def update_quotation_item(item_id):
#     """
#     Update a quotation item by its UUID.
#     ---
#     tags:
#       - Quotation Items
#     parameters:
#       - name: item_id
#         in: path
#         description: UUID of the quotation item to update
#         required: true
#         schema:
#           type: string
#           format: uuid
#     requestBody:
#       required: true
#       content:
#         application/json:
#           schema:
#             type: object
#             properties:
#               quantity:
#                 type: integer
#                 description: Updated quantity of the item
#               price:
#                 type: number
#                 format: float
#                 description: Updated price of the item
#     responses:
#       200:
#         description: Quotation item updated successfully.
#         content:
#           application/json:
#             schema:
#               type: object
#               properties:
#                 uuid:
#                   type: string
#                   format: uuid
#                 quotation_id:
#                   type: string
#                   format: uuid
#                 item_id:
#                   type: string
#                   format: uuid
#                 quantity:
#                   type: integer
#                 price:
#                   type: number
#                   format: float
#       404:
#         description: Quotation item not found.
#     """
#     data = request.get_json()
#     item = QuotationItem.query.get(item_id)
#     if item:
#         if 'quantity' in data:
#             item.quantity = data['quantity']
#         if 'price' in data:
#             item.price = data['price']
#         db.session.commit()
#         return jsonify({
#             'uuid': str(item.uuid),
#             'quotation_id': str(item.quotation_id),
#             'item_id': str(item.item_id),
#             'quantity': item.quantity,
#             'price': item.price
#         })
#     else:
#         return jsonify({'error': 'Quotation item not found'}), 404
    
    

         
 