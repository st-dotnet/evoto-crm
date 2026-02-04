from app import create_app, db
from sqlalchemy import text, inspect

app = create_app()

with app.app_context():
    inspector = inspect(db.engine)
    
    print("Checking active_types table columns:")
    columns = [c['name'] for c in inspector.get_columns('active_types')]
    print(columns)
    
    print("Checking status_list table columns:")
    columns = [c['name'] for c in inspector.get_columns('status_list')]
    print(columns)
