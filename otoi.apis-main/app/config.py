import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "mysecret")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URI", "postgresql://postgres:Admin@localhost:5432/otoidb")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "myjwtsecret")

    SWAGGER = {
        "title": "OTOI REST API",
        "uiversion": 3,
        "openapi": "3.0.2",
        "description": "API documentation for the OTOI REST API",
        "version": "1.0.0"
    }