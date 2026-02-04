from app.extensions import db
from app.models.quotation import QuotationItem
from flask import Blueprint, jsonify, request
from uuid import UUID
from sqlalchemy.exc import IntegrityError

quotation_item_blueprint = Blueprint("quotation_item", __name__, url_prefix="/quotation-items")


@quotation_item_blueprint.route("/", methods=["GET"])
def get_quotation_items():
    """
    Get all quotation items.
    ---
    tags:
      - Quotation Items
    responses:
      200:
        description: A list of quotation items.
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  uuid:
                    type: string
                    format: uuid
                    description: Quotation item UUID
                  quotation_id:
                    type: string
                    format: uuid
                    description: Associated quotation UUID
                  item_id:
                    type: string
                    format: uuid
                    description: Associated item UUID
                  quantity:
                    type: integer
                    description: Quantity of the item
                  price:
                    type: number
                    format: float
                    description: Price of the item
    """
    items = QuotationItem.query.all()
    return jsonify([{
        'uuid': str(item.uuid),
        'quotation_id': str(item.quotation_id),
        'item_id': str(item.item_id),
        'quantity': item.quantity,
        'price': item.price
    } for item in items])

@quotation_item_blueprint.route("/", methods=["POST"])
def create_quotation_item():
    """
    Create a new quotation item.
    ---
    tags:
      - Quotation Items
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - quotation_id
              - item_id
              - quantity
              - price
            properties:
              quotation_id:
                type: string
                format: uuid
                description: Associated quotation UUID
              item_id:
                type: string
                format: uuid
                description: Associated item UUID
              quantity:
                type: integer
                description: Quantity of the item
              price:
                type: number
                format: float
                description: Price of the item
    responses:
      201:  
        description: Quotation item created successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                uuid:
                  type: string
                  format: uuid
                quotation_id:
                  type: string
                  format: uuid
                item_id:
                  type: string
                  format: uuid
                quantity:
                  type: integer
                price:
                  type: number
                  format: float
    """
    data = request.get_json()
    try:
        quotation_item = QuotationItem(
            quotation_id=UUID(data['quotation_id']),
            item_id=UUID(data['item_id']),
            quantity=data['quantity'],
            price=data['price']
        )
        db.session.add(quotation_item)
        db.session.commit()
        return jsonify({
            'uuid': str(quotation_item.uuid),
            'quotation_id': str(quotation_item.quotation_id),
            'item_id': str(quotation_item.item_id),
            'quantity': quotation_item.quantity,
            'price': quotation_item.price
        }), 201
    except (KeyError, ValueError):
        return jsonify({'error': 'Invalid input'}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error'}), 400
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500  
    
@quotation_item_blueprint.route("/<uuid:item_id>", methods=["GET"])
def get_quotation_item(item_id):
    """
    Get a quotation item by its UUID.
    ---
    tags:
      - Quotation Items
    parameters:
      - name: item_id
        in: path
        description: UUID of the quotation item to retrieve
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Quotation item details.
        content:
          application/json:
            schema:
              type: object
              properties:
                uuid:
                  type: string
                  format: uuid
                quotation_id:
                  type: string
                  format: uuid
                item_id:
                  type: string
                  format: uuid
                quantity:
                  type: integer
                price:
                  type: number
                  format: float
      404:
        description: Quotation item not found.
    """
    item = QuotationItem.query.get(item_id)
    if item:
        return jsonify({
            'uuid': str(item.uuid),
            'quotation_id': str(item.quotation_id),
            'item_id': str(item.item_id),
            'quantity': item.quantity,
            'price': item.price
        })
    else:
        return jsonify({'error': 'Quotation item not found'}), 404
    
@quotation_item_blueprint.route("/<uuid:item_id>", methods=["DELETE"])
def delete_quotation_item(item_id):
    """
    Delete a quotation item by its UUID.
    ---
    tags:
      - Quotation Items
    parameters:
      - name: item_id
        in: path
        description: UUID of the quotation item to delete
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Quotation item deleted successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
      404:
        description: Quotation item not found.
    """
    item = QuotationItem.query.get(item_id)
    if item:
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Quotation item deleted successfully'})
    else:
        return jsonify({'error': 'Quotation item not found'}), 404
    

@quotation_item_blueprint.route("/<uuid:item_id>", methods=["PUT"])
def update_quotation_item(item_id):
    """
    Update a quotation item by its UUID.
    ---
    tags:
      - Quotation Items
    parameters:
      - name: item_id
        in: path
        description: UUID of the quotation item to update
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              quantity:
                type: integer
                description: Updated quantity of the item
              price:
                type: number
                format: float
                description: Updated price of the item
    responses:
      200:
        description: Quotation item updated successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                uuid:
                  type: string
                  format: uuid
                quotation_id:
                  type: string
                  format: uuid
                item_id:
                  type: string
                  format: uuid
                quantity:
                  type: integer
                price:
                  type: number
                  format: float
      404:
        description: Quotation item not found.
    """
    data = request.get_json()
    item = QuotationItem.query.get(item_id)
    if item:
        if 'quantity' in data:
            item.quantity = data['quantity']
        if 'price' in data:
            item.price = data['price']
        db.session.commit()
        return jsonify({
            'uuid': str(item.uuid),
            'quotation_id': str(item.quotation_id),
            'item_id': str(item.item_id),
            'quantity': item.quantity,
            'price': item.price
        })
    else:
        return jsonify({'error': 'Quotation item not found'}), 404
    
    

         
