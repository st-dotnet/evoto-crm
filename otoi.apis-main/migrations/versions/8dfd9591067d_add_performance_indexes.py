"""add_performance_indexes

Revision ID: 8dfd9591067d
Revises: 99bf63f925e2
Create Date: 2026-02-25 17:21:29.608891

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8dfd9591067d'
down_revision = '99bf63f925e2'
branch_labels = None
depends_on = None


def upgrade():

    # lead_addresses — FK indexes (KEEP)
    op.create_index(
        'idx_lead_addresses_lead_id',
        'lead_addresses',
        ['lead_id']
    )

    op.create_index(
        'idx_lead_addresses_address_id',
        'lead_addresses',
        ['address_id']
    )

    # Main CRM listing index (status + sorting)
    op.create_index(
        'idx_leads_active_status_created',
        'leads',
        ['status', 'created_at'],
        postgresql_where=sa.text('is_deleted = false')
    )
    # Active customers filter
    op.create_index(
        "idx_customers_active",
        "customers",
        ["is_deleted"],
        postgresql_where=sa.text("is_deleted = false"),
    )

    # Fast pagination without status filter
    op.create_index(
        'idx_leads_active_created',
        'leads',
        ['created_at'],
        postgresql_where=sa.text('is_deleted = false')
    )
    # Fast pagination for customers
    op.create_index(
        "idx_customers_active_created",
        "customers",
        ["created_at"],
        postgresql_where=sa.text("is_deleted = false"),
    )

    # Shipping FK lookup
    op.create_index(
        "idx_shippings_customer_id",
        "shippings",
        ["customer_id"],
    )

    # Production-grade name search (TRIGRAM)
    op.execute("""
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
    """)

    op.execute("""
        CREATE INDEX idx_leads_fullname_trgm
        ON leads
        USING gin (LOWER(first_name || ' ' || last_name) gin_trgm_ops)
        WHERE is_deleted = false;
    """)

def downgrade():

    op.drop_index('idx_lead_addresses_lead_id', table_name='lead_addresses')
    op.drop_index('idx_lead_addresses_address_id', table_name='lead_addresses')
    op.drop_index('idx_customers_active', table_name='customers')
    op.drop_index('idx_customers_active_created', table_name='customers')
    op.drop_index('idx_shippings_customer_id', table_name='shippings')
    op.drop_index('idx_leads_active_status_created', table_name='leads')
    op.drop_index('idx_leads_active_created', table_name='leads')
    op.execute("DROP INDEX IF EXISTS idx_leads_fullname_trgm")
                 
