from datetime import datetime

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
from app.models.inventory import MeasuringUnit, ItemType


# --------------------------------------------------
# DATABASE CREATION
# --------------------------------------------------
def create_database():
    """
    Create the database if it does not exist.
    Uses SQLALCHEMY_DATABASE_URI from Flask config.
    """
    database_uri = db.engine.url.render_as_string(hide_password=False)
    base_uri, db_name = database_uri.rsplit("/", 1)

    engine = create_engine(base_uri, isolation_level="AUTOCOMMIT")

    with engine.connect() as connection:
        exists = connection.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": db_name},
        ).fetchone()

        if not exists:
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

    # ---- Admin User + Business ----
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
        )

        business.addresses.append(address)
        admin.businesses.append(business)

        db.session.add_all([admin, business])
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

    # ---- Measuring Units ----
    for name in ["PCS", "KG", "LITER"]:
        if not MeasuringUnit.query.filter_by(name=name).first():
            db.session.add(MeasuringUnit(name=name))

    # ---- Item Types ----
    for name in ["Product", "Service"]:
        if not ItemType.query.filter_by(name=name).first():
            db.session.add(ItemType(name=name))        

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
