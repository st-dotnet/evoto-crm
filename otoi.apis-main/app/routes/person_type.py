from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import PersonType
from app.utils.stamping import set_created_fields, set_updated_fields, set_business

person_type_blueprint = Blueprint("person_type", __name__, url_prefix="/person-types")

@person_type_blueprint.route("/", methods=["GET"])
def get_person_types():
    """
    Get all person types.
    ---
    tags:
      - Person Types
    responses:
      200:
        description: A list of person types.
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: Item category ID
                  name:
                    type: string
                    description: Name of the person type
    """
    personTypes = PersonType.query.all()
    return jsonify([{'id': personType.id, 'name': personType.name} for personType in personTypes])
