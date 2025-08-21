from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import ActiveType
from app.models import Status
from app.utils.stamping import set_created_fields, set_updated_fields, set_business

active_type_blueprint = Blueprint("active_type", __name__, url_prefix="/active-types")

@active_type_blueprint.route("/", methods=["GET"])
def get_active_types():
    """
    Get all active types.
    ---
    tags:
      - Active Types
    responses:
      200:
        description: A list of active types.
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
                    description: Name of the active type
    """
    activeTypes = ActiveType.query.all()
    return jsonify([{'id': activeType.id, 'name': activeType.name} for activeType in activeTypes])


status_list_blueprint = Blueprint("status_list", __name__, url_prefix="/status-list")

@status_list_blueprint.route("/", methods=["GET"])
def get_active_types():
    """
    Get all active types.
    ---
    tags:
      - Active Types
    responses:
      200:
        description: A list of active types.
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
                    description: Name of the active type
    """
    status = Status.query.all()
    return jsonify([{'id': status.id, 'name': status.name} for status in status])
