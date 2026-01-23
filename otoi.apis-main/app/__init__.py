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
    #
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)



    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # Register middleware
    app.before_request(extract_jwt_info)

    # Initialize Swagger
    Swagger(app)

    # Register blueprints
    register_blueprints(app)

    return app


app = create_app()
