from app import create_app
from waitress import serve

app = create_app()

if __name__ == "__main__":
    # Run Flask via Waitress instead of the Flask dev server
    serve(app, host="127.0.0.1", port=5000)
