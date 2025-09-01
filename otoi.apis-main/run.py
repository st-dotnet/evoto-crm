from flask import Flask 
from app import create_app
from app.seed import seed_data, create_database
import os

app = create_app()
app.config["SQLALCHEMY_ECHO"] = True

if os.getenv("FLASK_ENV") == "development":
    with app.app_context():
        create_database(app)
        seed_data(app)

if __name__ == "__main__":
    app.run(host='127.0.0.1', port=5050, debug=True)