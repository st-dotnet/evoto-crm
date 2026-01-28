import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "mysecret")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI", "postgresql://postgres:Sss1234!@localhost:5432/otoidb")
    #SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI", "postgresql://evototec_tech:formless@5.189.145.124:5432/evototec_OTIO")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "myjwtsecret")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_DAYS", 1)))
    
    SWAGGER = {
        "title": "OTOI REST API",
        "uiversion": 3,
        "openapi": "3.0.2",
        "description": "API documentation for the OTOI REST API",
        "version": "1.0.0"
    }

    