from datetime import datetime

from flask import Flask
from sqlalchemy import create_engine, text

from app.extensions import db
from app.models.business import (
    Business,
    BusinessType,
    IndustryType,
    BusinessRegistrationType,
)
from app.models.user import User, Role
from app.models.common import Address
from app.models.active import ActiveType, Status
from app.models.inventory import MeasuringUnit, ItemType, ItemCategory


# --------------------------------------------------
# DATABASE CREATION
# --------------------------------------------------
def create_database():
    """
    Create the database if it does not exist.
    Uses SQLALCHEMY_DATABASE_URI from Flask config.
    """
    database_uri = db.engine.url.render_as_string(hide_password=False)
    base_uri = database_uri.rsplit("/", 1)[0]
    db_name = database_uri.rsplit("/", 1)[1]

    engine = create_engine(base_uri, isolation_level="AUTOCOMMIT")

    with engine.connect() as connection:
        query = text("SELECT 1 FROM pg_database WHERE datname = :db_name")
        result = connection.execute(query, {"db_name": db_name})

        if not result.fetchone():
            connection.execute(text(f'CREATE DATABASE "{db_name}"'))
            print(f"Database '{db_name}' created successfully.")
        else:
            print(f"Database '{db_name}' already exists.")


# --------------------------------------------------
# FULL (DESTRUCTIVE) SEED
# --------------------------------------------------
def seed_data():
    """
    DESTRUCTIVE seed.
    Drops all tables and recreates them.
    """
    print("Clearing database...")

    db.drop_all()
    db.create_all()

    print("Database cleared and tables recreated.")

    # ---- Roles ----
    admin_role = Role.query.filter_by(name="Admin").first()
    if not admin_role:
        admin_role = Role(name="Admin")
        db.session.add(admin_role)

    for role_name in ["Manager", "User"]:
        if not Role.query.filter_by(name=role_name).first():
            db.session.add(Role(name=role_name))

    # ---- User + Business ----
    if not User.query.filter_by(username="admin").first():
        admin = User(
            firstName="admin",
            lastName="admin",
            username="admin",
            email="info@evototechnologies.com",
            mobileNo="0000000000",
            role=admin_role,
            created_at=datetime.utcnow(),
        )
        admin.set_password("admin123")

        address = Address(
            address1="477-478 TF, SEC 35C",
            city="CHANDIGARH",
            state="CHANDIGARH",
            country="India",
            pin="160036",
        )

        business = Business(
            name="Evoto Technologies",
            phone_number="7009861539",
            email="info@evototechnologies.com",
            subscription_plan="Owner",
            created_at=datetime.utcnow(),
            address=address,
        )

        admin.businesses.append(business)

        db.session.add(admin)
        db.session.add(business)

        print("Default admin user created.")

    # ---- Active Types ----
    for name in ["Call", "Email", "In-person"]:
        if not ActiveType.query.filter_by(name=name).first():
            db.session.add(ActiveType(name=name))

    # ---- Status ----
    for name in ["New", "In-progress", "Quote Given", "Win", "Lose"]:
        if not Status.query.filter_by(name=name).first():
            db.session.add(Status(name=name))

    # ---- Business Types ----
    for name in ["Retailer", "Wholesaler", "Distributor", "Manufacturer", "Services"]:
        if not BusinessType.query.filter_by(name=name).first():
            db.session.add(BusinessType(name=name))

    # ---- Industry Types ----
    for name in ["Other", "Agriculture", "Automobile", "Consulting", "Engineering"]:
        if not IndustryType.query.filter_by(name=name).first():
            db.session.add(IndustryType(name=name))

    # ---- Registration Types ----
    for name in [
        "Private Limited Company",
        "Public Limited Company",
        "Partnership Firm",
        "Limited Liability Partnership",
    ]:
        if not BusinessRegistrationType.query.filter_by(name=name).first():
            db.session.add(BusinessRegistrationType(name=name))

    db.session.commit()
    print("Core data seeded successfully.")


# --------------------------------------------------
# SAFE SEEDERS
# --------------------------------------------------
def seed_measuring_units():
    units = ["PCS", "KG", "LITER"]

    for unit in units:
        if not MeasuringUnit.query.filter_by(name=unit).first():
            db.session.add(MeasuringUnit(name=unit))

    db.session.commit()
    print("Measuring units seeded successfully.")


def seed_item_types():
    types = [
        "Raw Material",
        "Finished Goods",
        "Semi-Finished Goods",
        "Consumables",
        "Packing Material"
    ]

    for name in types:
        if not ItemType.query.filter_by(name=name).first():
            db.session.add(ItemType(name=name))

    db.session.commit()
    print("Item types seeded successfully.")


def seed_item_categories():
    categories = ["Grocery", "Electronics", "Stationery"]

    for name in categories:
        if not ItemCategory.query.filter_by(name=name).first():
            db.session.add(ItemCategory(name=name))

    db.session.commit()
    print("Item categories seeded successfully.")






# from app.extensions import db
# from flask import Flask 
# from app.models.business import Business
# from app.models.user import User, Role
# from app.models.common import Address
# from app.models.active import ActiveType, Status
# from app.models.business import BusinessType, IndustryType, BusinessRegistrationType
# from datetime import datetime
# from sqlalchemy import create_engine, text 
# from app.models.inventory import MeasuringUnit


# def create_database(app):
#     """
#     Create the database if it does not exist.
#     """
#     database_uri = app.config['SQLALCHEMY_DATABASE_URI']
#     base_uri = database_uri.rsplit('/', 1)[0]  # Connect to the server (without the database)
#     db_name = database_uri.rsplit('/', 1)[1]   # Extract database name

#     # Connect with AUTOCOMMIT isolation level
#     engine = create_engine(base_uri, isolation_level="AUTOCOMMIT")

#     with engine.connect() as connection:
#         try:
#             # Check if the database exists
#             query = text("SELECT 1 FROM pg_database WHERE datname = :db_name")
#             result = connection.execute(query, {"db_name": db_name})
#             if not result.fetchone():
#                 # Create the database if it doesn't exist
#                 connection.execute(text(f"CREATE DATABASE {db_name}"))
#                 print(f"Database '{db_name}' created successfully.")
#             else:
#                 print(f"Database '{db_name}' already exists.")
#         except Exception as e:
#             print(f"Error while creating database: {e}")

# def seed_data(app: Flask):
#     with app.app_context():
#         print("Clearing database...")
        
#         # Drop tables in the correct order to avoid dependency issues
#         with db.engine.connect() as conn:
#             # Disable foreign key checks
#             conn.execute(text('SET session_replication_role = \'replica\';'))
            
#             # Get all table names in the correct drop order
#             inspector = db.inspect(db.engine)
#             table_names = inspector.get_table_names()
            
#             # Drop tables in reverse order of dependencies
#             for table in reversed(table_names):
#                 try:
#                     conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
#                     print(f"Dropped table: {table}")
#                 except Exception as e:
#                     print(f"Error dropping table {table}: {e}")
            
#             # Re-enable foreign key checks
#             conn.execute(text('SET session_replication_role = \'origin\';'))
        
#         # As an extra safety, drop all metadata-managed tables and recreate to pick up new columns
#         try:
#             db.drop_all()
#             print("SQLAlchemy metadata drop_all() completed.")
#         except Exception as e:
#             print(f"drop_all error (non-fatal): {e}")

#         # Recreate all tables
#         db.create_all()
#         print("Database cleared and tables recreated.")

#         # Add a default super admin user
#         if not Role.query.filter_by(name="Admin").first():
#             admin_role = Role(name="Admin")
#             db.session.add(admin_role)
#         else:
#             admin_role = Role.query.filter_by(name="Admin").first()
#         admin = User()
#         business = Business()
#         if not User.query.filter_by(username="admin").first():
#             admin.firstName="admin"
#             admin.lastName="admin"
#             admin.username="admin"
#             admin.email="info@evototechnologies.com"
#             admin.mobileNo="0000000000"
#             admin.role = admin_role
#             admin.created_at = datetime.utcnow()
#             admin.created_by = admin.id
#             admin.set_password("admin123")  # Change password in production!

#             address = Address(address1="477-478 TF, SEC 35C", city="CHANDIGARH", state="CHANDIGARH", country="India", pin="160036")
            
#             business.name="Evoto Technologies"
#             business.phone_number="7009861539" 
#             business.email="info@evototechnologies.com"
#             business.subscription_plan="Owner"
#             business.created_at=datetime.utcnow()
#             business.created_by=admin.id
#             business.address=address

#             admin.businesses.append(business) # Add business to user

#             db.session.add(admin)
#             db.session.add(business) 
        
#             print("default user created.")
#             # Define initial roles
#             roles = ["Manager", "User"]

#             # Add roles if not already present
#             for role_name in roles:
#                 role = Role.query.filter_by(name=role_name).first()
#                 if not role:
#                     role = Role(name=role_name)
#                     db.session.add(role)
    
#             # types = ["Customer", "Vendor", "Provider", "Lead", "Employee"]
#             # for t in types:
#             #     if not PersonType.query.filter_by(name=t).first():
#             #         db.session.add(PersonType(name=t, business_id = business.id, created_at=datetime.utcnow(), created_by=admin.id))
            
#             # print("Person types seeded.")

#             active_types = ["Call", "Email", "In-person"]
#             for a_type in active_types:
#                 if not ActiveType.query.filter_by(name=a_type).first():
#                     db.session.add(ActiveType(name=a_type))
            
#             print("Active types seeded.")

#             status_list = ["New", "In-progress", "Quote Given", "Win", "Lose"]

#             for s in status_list:
#                 if not Status.query.filter_by(name=s).first():
#                     db.session.add(Status(name=s))

#             print("Status types seeded.")

#             business_types = ["Retailer", "Wholesaler", "Distributor", "Manufacturer", "Services"]
#             for b_type in business_types:
#                 if not BusinessType.query.filter_by(name=b_type).first():
#                     db.session.add(BusinessType(name=b_type))

#             print("Business Types seeded.")

#             industry_types = ["Other", "Agriculture", "Automobile", "Consulting", "Engineering"]
#             for i_type in industry_types:
#                 if not IndustryType.query.filter_by(name=i_type).first():
#                     db.session.add(IndustryType(name=i_type))

#             print("Industry Types seeded.")

#             registration_types = [
#                 "Private Limited Company",
#                 "Public Limited Company",
#                 "Partnership Firm",
#                 "Limited Liability Partnership"
#             ]
#             for r_type in registration_types:
#                 if not BusinessRegistrationType.query.filter_by(name=r_type).first():
#                     db.session.add(BusinessRegistrationType(name=r_type))
        
#             print("Business Registration Types seeded.")

#             db.session.commit()
# from app.extensions import db
# from flask import Flask 
# from app.models.business import Business
# from app.models.user import User, Role
# from app.models.common import Address
# from app.models.active import ActiveType, Status
# from app.models.business import BusinessType, IndustryType, BusinessRegistrationType
# from app.models.inventory import MeasuringUnit 
# from datetime import datetime
# from sqlalchemy import create_engine, text 
# from app.models.inventory import MeasuringUnit



# def create_database(app):
#     """
#     Create the database if it does not exist.
#     """
#     database_uri = app.config['SQLALCHEMY_DATABASE_URI']
#     base_uri = database_uri.rsplit('/', 1)[0]
#     db_name = database_uri.rsplit('/', 1)[1]

#     engine = create_engine(base_uri, isolation_level="AUTOCOMMIT")

#     with engine.connect() as connection:
#         try:
#             query = text("SELECT 1 FROM pg_database WHERE datname = :db_name")
#             result = connection.execute(query, {"db_name": db_name})
#             if not result.fetchone():
#                 connection.execute(text(f"CREATE DATABASE {db_name}"))
#                 print(f"Database '{db_name}' created successfully.")
#             else:
#                 print(f"Database '{db_name}' already exists.")
#         except Exception as e:
#             print(f"Error while creating database: {e}")


# def seed_data(app: Flask):
#     with app.app_context():
#         print("Clearing database...")
        
#         with db.engine.connect() as conn:
#             conn.execute(text("SET session_replication_role = 'replica';"))
            
#             inspector = db.inspect(db.engine)
#             table_names = inspector.get_table_names()
            
#             for table in reversed(table_names):
#                 try:
#                     conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
#                     print(f"Dropped table: {table}")
#                 except Exception as e:
#                     print(f"Error dropping table {table}: {e}")
            
#             conn.execute(text("SET session_replication_role = 'origin';"))
        
#         try:
#             db.drop_all()
#             print("SQLAlchemy metadata drop_all() completed.")
#         except Exception as e:
#             print(f"drop_all error (non-fatal): {e}")

#         db.create_all()
#         print("Database cleared and tables recreated.")

#         # ---- Default Admin ----
#         if not Role.query.filter_by(name="Admin").first():
#             admin_role = Role(name="Admin")
#             db.session.add(admin_role)
#         else:
#             admin_role = Role.query.filter_by(name="Admin").first()

#         admin = User()
#         business = Business()

#         if not User.query.filter_by(username="admin").first():
#             admin.firstName = "admin"
#             admin.lastName = "admin"
#             admin.username = "admin"
#             admin.email = "info@evototechnologies.com"
#             admin.mobileNo = "0000000000"
#             admin.role = admin_role
#             admin.created_at = datetime.utcnow()
#             admin.created_by = admin.id
#             admin.set_password("admin123")

#             address = Address(
#                 address1="477-478 TF, SEC 35C",
#                 city="CHANDIGARH",
#                 state="CHANDIGARH",
#                 country="India",
#                 pin="160036"
#             )
            
#             business.name = "Evoto Technologies"
#             business.phone_number = "7009861539"
#             business.email = "info@evototechnologies.com"
#             business.subscription_plan = "Owner"
#             business.created_at = datetime.utcnow()
#             business.created_by = admin.id
#             business.address = address

#             admin.businesses.append(business)

#             db.session.add(admin)
#             db.session.add(business)

#             print("default user created.")

#             # ---- Roles ----
#             for role_name in ["Manager", "User"]:
#                 if not Role.query.filter_by(name=role_name).first():
#                     db.session.add(Role(name=role_name))

#             # ---- Active Types ----
#             for a_type in ["Call", "Email", "In-person"]:
#                 if not ActiveType.query.filter_by(name=a_type).first():
#                     db.session.add(ActiveType(name=a_type))
#             print("Active types seeded.")

#             # ---- Status ----
#             for s in ["New", "In-progress", "Quote Given", "Win", "Lose"]:
#                 if not Status.query.filter_by(name=s).first():
#                     db.session.add(Status(name=s))
#             print("Status types seeded.")

#             # ---- Measuring Units (✅ ONLY ADDITION) ----
#             for unit in ["PCS", "KG", "LITER"]:
#                 if not MeasuringUnit.query.filter_by(name=unit).first():
#                     db.session.add(MeasuringUnit(name=unit))
#             print("Measuring units seeded.")

#             # ---- Business Types ----
#             for b_type in ["Retailer", "Wholesaler", "Distributor", "Manufacturer", "Services"]:
#                 if not BusinessType.query.filter_by(name=b_type).first():
#                     db.session.add(BusinessType(name=b_type))
#             print("Business Types seeded.")

#             # ---- Industry Types ----
#             for i_type in ["Other", "Agriculture", "Automobile", "Consulting", "Engineering"]:
#                 if not IndustryType.query.filter_by(name=i_type).first():
#                     db.session.add(IndustryType(name=i_type))
#             print("Industry Types seeded.")

#             # ---- Registration Types ----
#             for r_type in [
#                 "Private Limited Company",
#                 "Public Limited Company",
#                 "Partnership Firm",
#                 "Limited Liability Partnership"
#             ]:
#                 if not BusinessRegistrationType.query.filter_by(name=r_type).first():
#                     db.session.add(BusinessRegistrationType(name=r_type))
#             print("Business Registration Types seeded.")

#             db.session.commit()

# from app.extensions import db
# from flask import Flask 
# from app.models.business import Business
# from app.models.user import User, Role
# from app.models.common import Address
# from app.models.active import ActiveType, Status
# from app.models.business import BusinessType, IndustryType, BusinessRegistrationType
# from datetime import datetime
# from sqlalchemy import create_engine, text 
# from app.models.inventory import MeasuringUnit, ItemType, ItemCategory


# def create_database(app):
#     """
#     Create the database if it does not exist.
#     """
#     database_uri = app.config['SQLALCHEMY_DATABASE_URI']
#     base_uri = database_uri.rsplit('/', 1)[0]  # Connect to the server (without the database)
#     db_name = database_uri.rsplit('/', 1)[1]   # Extract database name

#     # Connect with AUTOCOMMIT isolation level
#     engine = create_engine(base_uri, isolation_level="AUTOCOMMIT")

#     with engine.connect() as connection:
#         try:
#             # Check if the database exists
#             query = text("SELECT 1 FROM pg_database WHERE datname = :db_name")
#             result = connection.execute(query, {"db_name": db_name})
#             if not result.fetchone():
#                 # Create the database if it doesn't exist
#                 connection.execute(text(f"CREATE DATABASE {db_name}"))
#                 print(f"Database '{db_name}' created successfully.")
#             else:
#                 print(f"Database '{db_name}' already exists.")
#         except Exception as e:
#             print(f"Error while creating database: {e}")


# def seed_data(app: Flask):
#     with app.app_context():
#         print("Clearing database...")
        
#         # Drop tables in the correct order to avoid dependency issues
#         with db.engine.connect() as conn:
#             # Disable foreign key checks
#             conn.execute(text('SET session_replication_role = \'replica\';'))
            
#             # Get all table names in the correct drop order
#             inspector = db.inspect(db.engine)
#             table_names = inspector.get_table_names()
            
#             # Drop tables in reverse order of dependencies
#             for table in reversed(table_names):
#                 try:
#                     conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
#                     print(f"Dropped table: {table}")
#                 except Exception as e:
#                     print(f"Error dropping table {table}: {e}")
            
#             # Re-enable foreign key checks
#             conn.execute(text('SET session_replication_role = \'origin\';'))
        
#         # As an extra safety, drop all metadata-managed tables and recreate to pick up new columns
#         try:
#             db.drop_all()
#             print("SQLAlchemy metadata drop_all() completed.")
#         except Exception as e:
#             print(f"drop_all error (non-fatal): {e}")

#         # Recreate all tables
#         db.create_all()
#         print("Database cleared and tables recreated.")

#         # Add a default super admin user
#         if not Role.query.filter_by(name="Admin").first():
#             admin_role = Role(name="Admin")
#             db.session.add(admin_role)
#         else:
#             admin_role = Role.query.filter_by(name="Admin").first()

#         admin = User()
#         business = Business()

#         if not User.query.filter_by(username="admin").first():
#             admin.firstName = "admin"
#             admin.lastName = "admin"
#             admin.username = "admin"
#             admin.email = "info@evototechnologies.com"
#             admin.mobileNo = "0000000000"
#             admin.role = admin_role
#             admin.created_at = datetime.utcnow()
#             admin.created_by = admin.id
#             admin.set_password("admin123")  # Change password in production!

#             address = Address(
#                 address1="477-478 TF, SEC 35C",
#                 city="CHANDIGARH",
#                 state="CHANDIGARH",
#                 country="India",
#                 pin="160036"
#             )
            
#             business.name = "Evoto Technologies"
#             business.phone_number = "7009861539" 
#             business.email = "info@evototechnologies.com"
#             business.subscription_plan = "Owner"
#             business.created_at = datetime.utcnow()
#             business.created_by = admin.id
#             business.address = address

#             admin.businesses.append(business)

#             db.session.add(admin)
#             db.session.add(business) 
        
#             print("default user created.")

#             roles = ["Manager", "User"]
#             for role_name in roles:
#                 role = Role.query.filter_by(name=role_name).first()
#                 if not role:
#                     db.session.add(Role(name=role_name))

#             active_types = ["Call", "Email", "In-person"]
#             for a_type in active_types:
#                 if not ActiveType.query.filter_by(name=a_type).first():
#                     db.session.add(ActiveType(name=a_type))
            
#             print("Active types seeded.")

#             status_list = ["New", "In-progress", "Quote Given", "Win", "Lose"]
#             for s in status_list:
#                 if not Status.query.filter_by(name=s).first():
#                     db.session.add(Status(name=s))

#             print("Status types seeded.")

#             business_types = ["Retailer", "Wholesaler", "Distributor", "Manufacturer", "Services"]
#             for b_type in business_types:
#                 if not BusinessType.query.filter_by(name=b_type).first():
#                     db.session.add(BusinessType(name=b_type))

#             print("Business Types seeded.")

#             industry_types = ["Other", "Agriculture", "Automobile", "Consulting", "Engineering"]
#             for i_type in industry_types:
#                 if not IndustryType.query.filter_by(name=i_type).first():
#                     db.session.add(IndustryType(name=i_type))

#             print("Industry Types seeded.")

#             registration_types = [
#                 "Private Limited Company",
#                 "Public Limited Company",
#                 "Partnership Firm",
#                 "Limited Liability Partnership"
#             ]
#             for r_type in registration_types:
#                 if not BusinessRegistrationType.query.filter_by(name=r_type).first():
#                     db.session.add(BusinessRegistrationType(name=r_type))
        
#             print("Business Registration Types seeded.")

#             db.session.commit()

# def seed_measuring_units(app: Flask):
#     """
#     Seed measuring units safely without deleting existing data.
#     """
#     units = ["PCS", "KG", "LITER"]

#     for unit in units:
#         existing_unit = db.session.query(MeasuringUnit).filter_by(name=unit).first()
#         if not existing_unit:
#             db.session.add(MeasuringUnit(name=unit))

#     db.session.commit()
#     print("Measuring units seeded successfully.")

# def seed_item_types(app: Flask):
#     """
#     Seed item types safely without deleting existing data.
#     """
#     item_types = ["Product", "Service"]

#     for name in item_types:
#         if not ItemType.query.filter_by(name=name).first():
#             db.session.add(ItemType(name=name))

#     db.session.commit()
#     print("Item types seeded successfully.")

# def seed_item_categories():
#     categories = ["Grocery", "Electronics", "Stationery"]

#     for name in categories:
#         if not ItemCategory.query.filter_by(name=name).first():
#             db.session.add(ItemCategory(name=name))

#     db.session.commit()
#     print("Item categories seeded successfully.")





#I only need to seed the measuring units beacuse rest of the data is already seeded.