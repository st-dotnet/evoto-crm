import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "mysecret")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI", "postgresql://postgres:Admin@localhost:5432/otoidb")
    #SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI", "postgresql://evototec_tech:formless@5.189.145.124:5432/evototec_OTIO")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "myjwtsecret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_DAYS", 1)))
    
    # Mail configuration
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "st.parassharma@gmail.com")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "adzm wpmh urjc ncln")

    # Frontend URL for password reset links
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    SWAGGER = {
        "title": "OTOI REST API",
        "uiversion": 3,
        "openapi": "3.0.2",
        "description": "API documentation for the OTOI REST API",
        "version": "1.0.0"
    }
    