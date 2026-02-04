from app import create_app, db
from sqlalchemy import text, inspect

app = create_app()

with app.app_context():
    inspector = inspect(db.engine)
    
    print("Checking active table columns:")
    columns = [c['name'] for c in inspector.get_columns('active')]
    print(columns)
