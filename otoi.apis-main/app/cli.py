from flask import Flask

from app.seed import (
    seed_data,
    create_database,
)


def register_cli(app: Flask):
    """
    Register custom Flask CLI commands.
    """

    @app.cli.command("create-database")
    def create_db_command():
        """Create the database if it does not exist."""
        create_database()
        print("Database created successfully.")

    @app.cli.command("seed-data")
    def seed_data_command():
        """
        Seed the database with default data.
        WARNING: This is destructive (drops and recreates tables).
        """
        seed_data()
        print("Data seeded successfully.")
