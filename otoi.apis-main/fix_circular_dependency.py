from app import create_app
from app.extensions import db

app = create_app()

def fix_circular_dependency():
    with app.app_context():
        # Make business_id nullable in addresses table
        db.engine.execute("""
        ALTER TABLE addresses 
        ALTER COLUMN business_id DROP NOT NULL;
        """)
        
        # Drop the existing foreign key constraint
        db.engine.execute("""
        ALTER TABLE businesses 
        DROP CONSTRAINT IF EXISTS businesses_address_id_fkey;
        """)
        
        # Recreate the foreign key constraint with DEFERRABLE
        db.engine.execute("""
        ALTER TABLE businesses 
        ADD CONSTRAINT businesses_address_id_fkey 
        FOREIGN KEY (address_id) 
        REFERENCES addresses(uuid) 
        ON DELETE SET NULL 
        DEFERRABLE INITIALLY DEFERRED;
        """)
        
        print("Successfully fixed circular dependency between businesses and addresses")

if __name__ == "__main__":
    fix_circular_dependency()
