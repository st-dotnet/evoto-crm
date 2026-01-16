import os
from flask import Flask
from flask_cors import CORS
from app.routes.auth import auth_blueprint
from app.routes.user import user_blueprint, user_profile_blueprint
from app.routes.role import roles_blueprint
from app.routes.person import lead_blueprint
from app.routes.item_category import item_category_blueprint
from app.routes.measuring_unit import measuring_unit_blueprint
from app.routes.item_image import item_image_blueprint
from app.routes.active_type import active_type_blueprint, status_list_blueprint
from app.routes.customer import customer_blueprint
from app.routes.vendor import vendor_blueprint
from app.routes.csv_import import csv_import_bp
from app.routes.item import item_blueprint
from app.routes.barcode import barcode_blueprint



def register_blueprints(app):
    """Register all blueprints with /api prefixes."""
    app.register_blueprint(auth_blueprint, url_prefix="/api/auth")
    app.register_blueprint(user_profile_blueprint, url_prefix="/api/user")
    app.register_blueprint(user_blueprint, url_prefix="/api/users")
    app.register_blueprint(roles_blueprint, url_prefix="/api/roles")
    app.register_blueprint(lead_blueprint, url_prefix="/api/leads")
    app.register_blueprint(item_category_blueprint, url_prefix="/api/item-categories")
    app.register_blueprint(measuring_unit_blueprint, url_prefix="/api/measuring_units")
    app.register_blueprint(item_image_blueprint, url_prefix="/api/item_images")
    app.register_blueprint(active_type_blueprint, url_prefix="/api/active-types")
    app.register_blueprint(status_list_blueprint, url_prefix="/api/status-list")
    app.register_blueprint(customer_blueprint, url_prefix="/api/customers")
    app.register_blueprint(vendor_blueprint, url_prefix="/api/vendors")
    app.register_blueprint(csv_import_bp, url_prefix="/api/csv_import")
    app.register_blueprint(item_blueprint, url_prefix="/api/items")
    app.register_blueprint(barcode_blueprint, url_prefix="/api/barcode")


