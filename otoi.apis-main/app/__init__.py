from flask import Flask
from app.extensions import db, migrate, jwt
from flasgger import Swagger
from flask_cors import CORS
from app.routes import register_blueprints
from app.middleware import extract_jwt_info
from app.cli import register_cli
from dotenv import load_dotenv
from app.utils.query_profiler import init_profiler
import os

load_dotenv()

# from app.events import person_events  # IMPORTANT


import os

def create_app():
    # Use absolute path for the static folder (sibling to 'app')
    static_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static')
    app = Flask(__name__, static_folder=static_folder, static_url_path="/static")
    app.config.from_object("app.config.Config")
    
    # Disable strict slash matching to prevent 308 redirects
    app.url_map.strict_slashes = False

    # Register CLI commands
    register_cli(app)

    # Enable CORS
    # CORS(app)
    # Enable CORS for both /api/* and /static/*
    frontend_url = app.config.get("FRONTEND_URL", "http://localhost:5173")
    CORS(app, resources={
        r"/api/*": {"origins": [frontend_url]},
        r"/static/*": {"origins": [frontend_url]}
    }, supports_credentials=True, allow_headers=["Content-Type", "Authorization"], expose_headers=["Authorization"], methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])

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

    # Initialize query profiler
    init_profiler(app, slow_query_threshold=0.1)

    return app


app = create_app()
