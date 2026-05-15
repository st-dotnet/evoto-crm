"""Consolidated migration - creates all tables

Revision ID: 0001_consolidated
Revises: 
Create Date: 2026-05-15

This migration uses SQLAlchemy's create_all with checkfirst=True.
It safely creates only missing tables, skipping existing ones.
Works on both fresh databases and production with existing tables.
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_consolidated'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    from flask import current_app
    from sqlalchemy import inspect
    
    # Get the db instance from the current Flask app
    db = current_app.extensions['migrate'].db
    
    # create_all with checkfirst=True (default) will:
    # - CREATE tables that don't exist
    # - SKIP tables that already exist
    bind = op.get_bind()
    db.metadata.create_all(bind=bind, checkfirst=True)
    
    # Now dynamically inspect existing tables to add any missing columns.
    # This solves the issue of tables already existing but missing newly added columns.
    inspector = inspect(bind)
    
    for table_name, table in db.metadata.tables.items():
        if inspector.has_table(table_name):
            # Get existing columns from the DB
            existing_columns = [col['name'] for col in inspector.get_columns(table_name)]
            
            for column in table.columns:
                if column.name not in existing_columns:
                    # Column is missing in the database, add it!
                    # For safety with existing data, we make the new column nullable=True
                    # if it doesn't have a server_default.
                    new_col = sa.Column(
                        column.name, 
                        column.type, 
                        server_default=column.server_default,
                        nullable=True
                    )
                    try:
                        op.add_column(table_name, new_col)
                        print(f"Added missing column '{column.name}' to table '{table_name}'")
                    except Exception as e:
                        print(f"Warning: Failed to add column '{column.name}' to '{table_name}': {e}")


def downgrade():
    # List all tables in reverse dependency order for clean teardown
    tables = [
        'debit_note_payments', 'debit_note_items', 'debit_notes',
        'credit_note_payments', 'credit_note_items', 'credit_notes',
        'payment_outs', 'payment_ins',
        'purchase_invoice_items', 'purchase_invoices',
        'purchase_order_items', 'purchase_orders',
        'invoice_items', 'invoices',
        'quotation_items', 'quotations',
        'item_images', 'items',
        'lead_addresses', 'shippings', 'addresses',
        'customers', 'leads',
        'active', 'status_list', 'active_types',
        'user_business', 'global_config',
        'businesses', 'business_registration_types',
        'industry_types', 'business_types',
        'measuring_units', 'item_types', 'item_categories',
        'purchase_entries', 'vendors',
        'union_territories', 'countries',
        'users', 'roles',
    ]
    for t in tables:
        op.execute(sa.text(f'DROP TABLE IF EXISTS "{t}" CASCADE'))
