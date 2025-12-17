from sqlalchemy import text
from app import create_app, db
from app.models.inventory import Item, ItemType, ItemCategory, MeasuringUnit, ItemImage

def init_db():
    app = create_app()
    with app.app_context():
        print("Dropping all tables...")
        # Drop all tables with CASCADE using SQLAlchemy 2.0+ syntax
        with db.engine.connect() as conn:
            conn.execute(text('DROP SCHEMA IF EXISTS public CASCADE'))
            conn.execute(text('CREATE SCHEMA public'))
            conn.commit()
        
        print("Creating all tables...")
        db.create_all()
        
        # Add default data
        print("Adding default data...")
        item_types = [
            ItemType(name="Product"),
            ItemType(name="Service"),
            ItemType(name="Raw Material")
        ]
        
        categories = [
            ItemCategory(name="Electronics"),
            ItemCategory(name="Groceries"),
            ItemCategory(name="Office Supplies")
        ]
        
        units = [
            MeasuringUnit(name="PCS"),
            MeasuringUnit(name="KG"),
            MeasuringUnit(name="LTR"),
            MeasuringUnit(name="MTR")
        ]
         
        # Add all to session and commit
        db.session.add_all(item_types + categories + units)
        db.session.commit()
        
        print("\nDatabase initialized successfully!")
        print("\nItem Types:", [t.name for t in ItemType.query.all()])
        print("Categories:", [c.name for c in ItemCategory.query.all()])
        print("Units:", [u.name for u in MeasuringUnit.query.all()])
        print("\nYou can now start your Flask application.")

if __name__ == "__main__":
    init_db()