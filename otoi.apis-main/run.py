from flask import Flask, request
from app import create_app
from app.seed import seed_data, create_database
import os
from flask_cors import CORS

# Flask mounted under "/backend"
app = create_app()
CORS(app)
app.config["SQLALCHEMY_ECHO"] = True
app.config["DEBUG"] = False  # disable debug for IIS

# Important: tell Flask to expect /backend prefix
@app.before_request
def strip_backend_prefix():
    if request.path.startswith("/backend"):
        request.environ["SCRIPT_NAME"] = "/backend"

# Only create/seed DB in dev
if os.getenv("FLASK_ENV") == "development":
    with app.app_context():
        create_database(app)
        seed_data(app)

# Local run
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
