from flask import Blueprint
from app.routes.auth import auth_blueprint
from app.routes.user import user_blueprint
from app.routes.person import person_blueprint
from app.routes.item import item_blueprint
from app.routes.item_category import item_category_blueprint
from app.routes.measuring_unit import measuring_unit_blueprint
from app.routes.item_image import item_image_blueprint
from app.routes.person_type import person_type_blueprint

def register_blueprints(app):
    app.register_blueprint(auth_blueprint, url_prefix="/auth")
    app.register_blueprint(user_blueprint, url_prefix="/user")
    app.register_blueprint(person_blueprint, url_prefix="/persons")
    app.register_blueprint(item_category_blueprint, url_prefix="/item_categories")
    app.register_blueprint(measuring_unit_blueprint, url_prefix="/measuring_units")
    app.register_blueprint(item_blueprint, url_prefix="/items")
    app.register_blueprint(item_image_blueprint, url_prefix="/item_images")
    app.register_blueprint(person_type_blueprint, url_prefix="/person-types")

