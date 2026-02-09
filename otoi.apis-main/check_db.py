from app import create_app
from app.extensions import db

app = create_app()
with app.app_context():
    # Check if users table has firstName and lastName columns
    result = db.session.execute(db.text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('firstName', 'lastName')"))
    columns = [row[0] for row in result]
    print(f'Users table columns: {columns}')
    
    # Check if vendors table exists
    result = db.session.execute(db.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vendors')"))
    vendors_exists = result.fetchone()[0]
    print(f'Vendors table exists: {vendors_exists}')
    
    # Check if invoices table exists
    result = db.session.execute(db.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices')"))
    invoices_exists = result.fetchone()[0]
    print(f'Invoices table exists: {invoices_exists}')
