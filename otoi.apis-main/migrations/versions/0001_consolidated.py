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
    
    # Get the db instance from the current Flask app
    db = current_app.extensions['migrate'].db
    
    # create_all with checkfirst=True (default) will:
    # - CREATE tables that don't exist
    # - SKIP tables that already exist
    # This makes it safe for both fresh and existing databases
    bind = op.get_bind()
    db.metadata.create_all(bind=bind, checkfirst=True)


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
