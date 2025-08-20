from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import MeasuringUnit
from app.utils.stamping import set_created_fields, set_updated_fields

measuring_unit_blueprint = Blueprint("measuring_unit", __name__, url_prefix="/measuring-units")

@measuring_unit_blueprint.route("/", methods=["GET"])
def get_measuring_units():
    """
    Get all measuring units.
    ---
    tags:
      - Measuring Units
    responses:
      200:
        description: A list of measuring units.
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: Measuring unit ID
                  name:
                    type: string
                    description: Name of the measuring unit
    """
    units = MeasuringUnit.query.all()
    return jsonify([{'id': unit.id, 'name': unit.name} for unit in units])


@measuring_unit_blueprint.route("/", methods=["POST"])
def create_measuring_unit():
    """
    Create a new measuring unit.
    ---
    tags:
      - Measuring Units
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                description: Name of the measuring unit
    responses:
      201:
        description: Measuring unit created successfully.
    """
    data = request.json
    unit = MeasuringUnit(name=data['name'])
    set_created_fields(unit)
    db.session.add(unit)
    db.session.commit()
    return jsonify({'message': 'Measuring unit created successfully'}), 201


@measuring_unit_blueprint.route("/<int:id>", methods=["PUT"])
def update_measuring_unit(id):
    """
    Update an existing measuring unit.
    ---
    tags:
      - Measuring Units
    parameters:
      - name: id
        in: path
        description: ID of the measuring unit to update
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
              name:
                type: string
                description: Updated name of the measuring unit
    responses:
      200:
        description: Measuring unit updated successfully.
    """
    data = request.json
    unit = MeasuringUnit.query.get_or_404(id)
    unit.name = data['name']
    set_updated_fields(unit)
    db.session.commit()
    return jsonify({'message': 'Measuring unit updated successfully'})


@measuring_unit_blueprint.route("/<int:id>", methods=["DELETE"])
def delete_measuring_unit(id):
    """
    Delete a measuring unit.
    ---
    tags:
      - Measuring Units
    parameters:
      - name: id
        in: path
        description: ID of the measuring unit to delete
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Measuring unit deleted successfully.
    """
    unit = MeasuringUnit.query.get_or_404(id)
    db.session.delete(unit)
    db.session.commit()
    return jsonify({'message': 'Measuring unit deleted successfully'})