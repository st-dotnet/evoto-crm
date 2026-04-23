import os
from datetime import timedelta

class Config:
    # Environment
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    PORT = int(os.environ.get("PORT", 8080))

    # Security keys — no hardcoded fallbacks; must be set in .env
    SECRET_KEY = os.environ.get("SECRET_KEY")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_DAYS", 1)))

    # Database — no hardcoded credentials in code
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Frontend URL for password reset links
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Asset Storage
    # Corrected: Move UP one level from 'app' directory to reach the root static folder
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    UPLOAD_BASE_PATH = os.path.join(BASE_DIR, 'static', 'uploads')
    BUSINESS_ASSETS_FOLDER = os.path.join(UPLOAD_BASE_PATH, 'business')
    ITEM_IMAGES_FOLDER = os.path.join(BASE_DIR, 'static', 'itemImages')

    SWAGGER = {
        "title": "OTOI REST API",
        "uiversion": 3,
        "openapi": "3.0.2",
        "description": "API documentation for the OTOI REST API",
        "version": "1.0.0"
    }
    