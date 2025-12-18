from flask import Flask
from app.seed import (
    seed_data,
    create_database,
    seed_measuring_units,
    seed_item_types,
    seed_item_categories
)


def register_cli(app: Flask):

    @app.cli.command("create-database")
    def create_db_command():
        """Create the database."""
        with app.app_context():
            create_database()
        print("Database created successfully.")

    @app.cli.command("seed-data")
    def seed_data_command():
        """Seed the database with default data (DESTRUCTIVE)."""
        with app.app_context():
            seed_data()
        print("Data seeded successfully.")

    @app.cli.command("seed-measuring-units")
    def seed_measuring_units_command():
        """Seed measuring units only (SAFE)."""
        with app.app_context():
            seed_measuring_units()
        print("Measuring units seeded successfully.")

    @app.cli.command("seed-item-types")
    def seed_item_types_command():
        """Seed item types only (SAFE)."""
        with app.app_context():
            seed_item_types()
        print("Item types seeded successfully.")

    @app.cli.command("seed-item-categories")
    def seed_item_categories_command():
        """Seed item categories only (SAFE)."""
        with app.app_context():
            seed_item_categories()
        print("Item categories seeded successfully.")

# from flask import Flask
# from app.seed import seed_data, create_database


# def register_cli(app: Flask):

#     @app.cli.command("create-database")
#     def create_db_command():
#         """Create the database."""
#         with app.app_context():
#             create_database(app)
#         print("Database created successfully.")

#     @app.cli.command("seed-data")
#     def seed_data_command():
#         """Seed ALL database data (DESTRUCTIVE)."""
#         with app.app_context():
#             seed_data(app)
#         print("All data seeded successfully.")


#     @app.cli.command("seed-measuring-units")
#     def seed_measuring_units_command():
#         """
#         Alias command.
#         Internally calls seed-data.
#         """
#         with app.app_context():
#             seed_data(app)
#         print("Measuring units seeded successfully.")

#     @app.cli.command("seed-item-types")
#     def seed_item_types_command():
#         """
#         Alias command.
#         Internally calls seed-data.
#         """
#         with app.app_context():
#             seed_data(app)
#         print("Item types seeded successfully.")

#     @app.cli.command("seed-item-categories")
#     def seed_item_categories_command():
#         """
#         Alias command.
#         Internally calls seed-data.
#         """
#         with app.app_context():
#             seed_data(app)
#         print("Item categories seeded successfully.")
