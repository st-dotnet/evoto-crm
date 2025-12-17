import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify
from flask_cors import CORS   # Import CORS
from app import create_app
from app.seed import seed_data, create_database

# Create the Flask app via factory
app = create_app()
app.config["SQLALCHEMY_ECHO"] = True
app.config["DEBUG"] = True

# Enable CORS for your frontend domain
CORS(app)

# -----------------------------
# Setup Logging
# -----------------------------
if not os.path.exists("logs"):
    os.makedirs("logs")

log_file = os.path.join("logs", "app.log")

# Rotating log file: 5 MB each, keep 5 backups
file_handler = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=5)
file_handler.setLevel(logging.INFO)  # INFO, DEBUG, ERROR depending on need

formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] in %(module)s: %(message)s"
)
file_handler.setFormatter(formatter)

# Attach to Flask app's logger
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)

# Example log
app.logger.info("Application startup complete")


# Health-check route (now under /api/health)
@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check route that also lists all API endpoints"""
    routes = []
    for rule in app.url_map.iter_rules():
        # Skip internal/static routes
        if rule.endpoint == "static":
            continue
        routes.append({
            "endpoint": rule.endpoint,
            "methods": list(rule.methods),
            "url": str(rule)
        })
    app.logger.debug("Health check called")
    return jsonify({
        "status": "ok",
        "message": "Backend is running",
        "endpoints": routes
    })


# Only run DB init + seed in development
if os.getenv("FLASK_ENV") == "development":
    with app.app_context():
        try:
            create_database(app)
            seed_data(app)
            app.logger.info("Database initialized and seeded successfully")
        except Exception as e:
            app.logger.exception("Error while initializing database")


# For local testing (not used in IIS, which loads run.app)
if __name__ == "__main__":
    app.run(port=75, debug=True)

