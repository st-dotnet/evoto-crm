import os
from flask import Flask, jsonify
from app import create_app
from app.seed import seed_data, create_database

# Create the Flask app via factory
app = create_app()
app.config["SQLALCHEMY_ECHO"] = True
app.config["DEBUG"] = True

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
    return jsonify({
        "status": "ok",
        "message": "Backend is running",
        "endpoints": routes
    })

# Only run DB init + seed in development
if os.getenv("FLASK_ENV") == "development":
    with app.app_context():
        create_database(app)
        seed_data(app)

# For local testing (not used in IIS, which loads run.app)
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
