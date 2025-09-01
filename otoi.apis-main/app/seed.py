from app.extensions import db
from flask import Flask 
from app.models.business import Business
from app.models.user import User, Role
from app.models.common import Address
from app.models.person import PersonType
from app.models.active import ActiveType, Status
from app.models.business import BusinessType, IndustryType, BusinessRegistrationType
from datetime import datetime
from sqlalchemy import create_engine, text 

def create_database(app):
    """
    Create the database if it does not exist.
    """
    database_uri = app.config['SQLALCHEMY_DATABASE_URI']
    base_uri = database_uri.rsplit('/', 1)[0]  # Connect to the server (without the database)
    db_name = database_uri.rsplit('/', 1)[1]   # Extract database name

    # Connect with AUTOCOMMIT isolation level
    engine = create_engine(base_uri, isolation_level="AUTOCOMMIT")

    with engine.connect() as connection:
        try:
            # Check if the database exists
            query = text("SELECT 1 FROM pg_database WHERE datname = :db_name")
            result = connection.execute(query, {"db_name": db_name})
            if not result.fetchone():
                # Create the database if it doesn't exist
                connection.execute(text(f"CREATE DATABASE {db_name}"))
                print(f"Database '{db_name}' created successfully.")
            else:
                print(f"Database '{db_name}' already exists.")
        except Exception as e:
            print(f"Error while creating database: {e}")

def seed_data(app: Flask):
    with app.app_context():

        print("Clearing database...")
        db.drop_all()  # Drop all tables
        db.create_all()  # Recreate all tables
        print("Database cleared and tables recreated.")

        # Add a default super admin user
        if not Role.query.filter_by(name="Admin").first():
            admin_role = Role(name="Admin")
            db.session.add(admin_role)
        else:
            admin_role = Role.query.filter_by(name="Admin").first()
        admin = User()
        business = Business()
        if not User.query.filter_by(username="admin").first():
            admin.username="admin"
            admin.email="info@evototechnologies.com"
            admin.role = admin_role
            admin.created_at = datetime.utcnow()
            admin.created_by = admin.id
            admin.set_password("admin123")  # Change password in production!

            address = Address(address1="477-478 TF, SEC 35C", city="CHANDIGARH", state="CHANDIGARH", country="India", pin="160036")
            
            business.name="Evoto Technologies"
            business.phone_number="7009861539" 
            business.email="info@evototechnologies.com"
            business.subscription_plan="Owner"
            business.created_at=datetime.utcnow()
            business.created_by=admin.id
            business.address=address

            admin.businesses.append(business) # Add business to user

            db.session.add(admin)
            db.session.add(business) 
        
            print("default user created.")
            # Define initial roles
            roles = ["Manager", "User"]

            # Add roles if not already present
            for role_name in roles:
                role = Role.query.filter_by(name=role_name).first()
                if not role:
                    role = Role(name=role_name)
                    db.session.add(role)
    
            types = ["Customer", "Vendor", "Provider", "Lead", "Employee"]
            for t in types:
                if not PersonType.query.filter_by(name=t).first():
                    db.session.add(PersonType(name=t, business_id = business.id, created_at=datetime.utcnow(), created_by=admin.id))
            
            print("Person types seeded.")

            active_types = ["Call", "Email", "In-person"]
            for a_type in active_types:
                if not ActiveType.query.filter_by(name=a_type).first():
                    db.session.add(ActiveType(name=a_type))
            
            print("Active types seeded.")

            status_list = ["New", "In-progress", "Quote Given", "Win", "Lose"]

            for s in status_list:
                if not Status.query.filter_by(name=s).first():
                    db.session.add(Status(name=s))

            print("Status types seeded.")

            business_types = ["Retailer", "Wholesaler", "Distributor", "Manufacturer", "Services"]
            for b_type in business_types:
                if not BusinessType.query.filter_by(name=b_type).first():
                    db.session.add(BusinessType(name=b_type))

            print("Business Types seeded.")

            industry_types = ["Other", "Agriculture", "Automobile", "Consulting", "Engineering"]
            for i_type in industry_types:
                if not IndustryType.query.filter_by(name=i_type).first():
                    db.session.add(IndustryType(name=i_type))

            print("Industry Types seeded.")

            registration_types = [
                "Private Limited Company",
                "Public Limited Company",
                "Partnership Firm",
                "Limited Liability Partnership"
            ]
            for r_type in registration_types:
                if not BusinessRegistrationType.query.filter_by(name=r_type).first():
                    db.session.add(BusinessRegistrationType(name=r_type))
        
            print("Business Registration Types seeded.")

            db.session.commit()