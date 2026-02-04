from app import create_app, db
from sqlalchemy import text, inspect

app = create_app()

with app.app_context():
    inspector = inspect(db.engine)
    
    print("Checking businesses table columns:")
    columns = [c['name'] for c in inspector.get_columns('businesses')]
    print(columns)
    
    print("Checking users table columns:")
    columns = [c['name'] for c in inspector.get_columns('users')]
    print(columns)
