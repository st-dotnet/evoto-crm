from flask import Flask
from app.extensions import db, migrate, jwt
from flasgger import Swagger
from flask_cors import CORS
from app.routes import register_blueprints
from app.middleware import extract_jwt_info  # Import middleware
from app.cli import register_cli
from app.events import person_events   # <-- IMPORTANT

def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    # Register CLI commands
    register_cli(app)

    # Enable CORS
    CORS(app)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Register middleware
    app.before_request(extract_jwt_info)

    # Initialize Swagger
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": 'apispec_1',
                "route": '/apispec_1.json',
                "rule_filter": lambda rule: True,   # include all endpoints
                "model_filter": lambda tag: True,   # include all models
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/apidocs/"
    }
    Swagger(app, config=swagger_config)


    # Register blueprints
    register_blueprints(app)


    return app