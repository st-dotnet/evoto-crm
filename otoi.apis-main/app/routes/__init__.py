from flask import Blueprint
from app.routes.auth import auth_blueprint
from app.routes.user import user_blueprint
from app.routes.person import person_blueprint
from app.routes.item import item_blueprint
from app.routes.item_category import item_category_blueprint
from app.routes.measuring_unit import measuring_unit_blueprint
from app.routes.item_image import item_image_blueprint
from app.routes.person_type import person_type_blueprint
from app.routes.active_type import active_type_blueprint
from app.routes.active_type import status_list_blueprint
from app.routes.customer import customer_blueprint
def register_blueprints(app):
    app.register_blueprint(auth_blueprint, url_prefix="/api/auth")
    app.register_blueprint(user_blueprint, url_prefix="/api/user")
    app.register_blueprint(person_blueprint, url_prefix="/api/persons")
    app.register_blueprint(item_category_blueprint, url_prefix="/api/item_categories")
    app.register_blueprint(measuring_unit_blueprint, url_prefix="/api/measuring_units")
    app.register_blueprint(item_blueprint, url_prefix="/api/items")
    app.register_blueprint(item_image_blueprint, url_prefix="/api/item_images")
    app.register_blueprint(person_type_blueprint, url_prefix="/api/person-types")
    app.register_blueprint(active_type_blueprint, url_prefix="/api/active-types")
    app.register_blueprint(status_list_blueprint, url_prefix="/api/status-list")
    app.register_blueprint(customer_blueprint, url_prefix="/api/customers")

