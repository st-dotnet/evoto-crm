from flask import Flask
from app.extensions import db, migrate, jwt
from flasgger import Swagger
from flask_cors import CORS
from app.routes import register_blueprints
from app.middleware import extract_jwt_info
from app.cli import register_cli

# from app.events import person_events  # IMPORTANT


def create_app():
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    # Register CLI commands
    register_cli(app)

    # Enable CORS
    # CORS(app)
    CORS( app,resources={r"/api/*": {"origins": "*"}},supports_credentials=True,allow_headers=["Content-Type", "Authorization"],expose_headers=["Authorization"],methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],)

    # authentication barrier
    swagger_template = {
        "openapi": "3.0.3",
        "info": {
            "title": "OTOI REST API",
            "version": "1.0.0",
            "description": "API documentation for OTOI CRM"
        },
        "components": {
            "securitySchemes": {
                "OAuth2Password": {
                    "type": "oauth2",
                    "flows": {
                        "password": {
                            "tokenUrl": "/api/auth/login",
                            "scopes": {}
                        }
                    }
                }
            }
        },
        "security": [
            {"OAuth2Password": []}
        ]
    }

    swagger_config = {
        "headers": [],
        "uiversion": 3,
        "specs": [
            {
                "endpoint": 'apispec_1',
                "route": '/apispec_1.json',
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/apidocs/"
    }

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Register middleware
    app.before_request(extract_jwt_info)

    # Initialize Swagger
    Swagger(app, template=swagger_template, config=swagger_config)

    # Register blueprints
    register_blueprints(app)

    return app


app = create_app()
