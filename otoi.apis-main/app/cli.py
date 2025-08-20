from flask import Flask
from app.seed import seed_data, create_database

def register_cli(app: Flask):
    @app.cli.command("create-database")
    def create_db_command():
        """Create the database."""
        create_database(app)
        print("Database created successfully.")

    @app.cli.command("seed-data")
    def seed_data_command():
        """Seed the database with default data."""
        seed_data(app)
        print("Data seeded successfully.")