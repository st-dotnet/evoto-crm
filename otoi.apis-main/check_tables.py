import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set environment variables
os.environ["DATABASE_URI"] = "postgresql://postgres:root@localhost:5433/test"

try:
    from app import create_app
    from app.extensions import db

    app = create_app()
    with app.app_context():
        # Check if quotations table exists
        result = db.session.execute(db.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quotations')"))
        quotations_exists = result.fetchone()[0]
        print(f'Quotations table exists: {quotations_exists}')
        
        # Check if invoice_items table exists
        result = db.session.execute(db.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoice_items')"))
        invoice_items_exists = result.fetchone()[0]
        print(f'Invoice_items table exists: {invoice_items_exists}')
        
        # Check if vendors table exists
        result = db.session.execute(db.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vendors')"))
        vendors_exists = result.fetchone()[0]
        print(f'Vendors table exists: {vendors_exists}')
        
        # Check if invoices table exists
        result = db.session.execute(db.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices')"))
        invoices_exists = result.fetchone()[0]
        print(f'Invoices table exists: {invoices_exists}')
        
        # List all tables
        result = db.session.execute(db.text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
        tables = [row[0] for row in result]
        print(f'All tables: {tables}')
        
except Exception as e:
    print(f"Error: {e}")
    print("This might be due to missing dependencies or database connection issues.")
