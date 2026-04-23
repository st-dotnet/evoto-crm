"""add_quotation_performance_indexes

Revision ID: b1e2f3a4c5d6
Revises: 8dfd9591067d
Create Date: 2026-03-05 18:10:00.000000

Adds targeted performance indexes for the quotations and quotation_items tables.

Optimizations covered:
  1. quotation_items.quotation_id  — FK lookup when fetching items for a quotation
  2. quotation_items.item_id       — FK lookup used by batch IN queries for inventory items
  3. quotations.customer_id        — FK join used in every customer-name lookup / filter
  4. quotations.business_id        — FK used for multi-tenant scoping
  5. quotations.status             — Filtered heavily (open/closed/sent/…)
  6. quotations.(status, valid_till) — Composite for the bulk expiry UPDATE + due-date sort
  7. quotations.(business_id, status, valid_till)
                                   — Hot path: listing page with status filter, sorted by due date
  8. quotations.created_at         — Used by generate_quotation_number() ORDER BY
  9. Customer trigram index         — Supports ilike '%name%' searches on quotation listing
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1e2f3a4c5d6'
down_revision = '0f2054e766e7'
branch_labels = None
depends_on = None


def upgrade():
    # -----------------------------------------------------------------------
    # quotation_items — FK indexes
    # -----------------------------------------------------------------------

    # quotation_id is the primary FK used every time items are fetched for a
    # quotation (selectinload, filter_by, delete).
    op.create_index(
        'idx_quotation_items_quotation_id',
        'quotation_items',
        ['quotation_id']
    )

    # item_id is used in batch Item.query.filter(Item.id.in_(...)) calls.
    op.create_index(
        'idx_quotation_items_item_id',
        'quotation_items',
        ['item_id'],
        postgresql_where=sa.text('item_id IS NOT NULL')
    )

    # -----------------------------------------------------------------------
    # quotations — FK indexes
    # -----------------------------------------------------------------------

    # customer_id is joined on almost every listing query and the
    # customer_dropdown_all / suggestions endpoints.
    op.create_index(
        'idx_quotations_customer_id',
        'quotations',
        ['customer_id']
    )

    # business_id is used for multi-tenant scoping in all production queries.
    op.create_index(
        'idx_quotations_business_id',
        'quotations',
        ['business_id']
    )

    # -----------------------------------------------------------------------
    # quotations — status / expiry indexes
    # -----------------------------------------------------------------------

    # Single-column status index — fast equality filter (status == 'open').
    op.create_index(
        'idx_quotations_status',
        'quotations',
        ['status']
    )

    # Composite (status, valid_till) — drives the bulk expiry UPDATE:
    #   WHERE status = 'open' AND valid_till <= today
    # Also serves the default listing sort (valid_till ASC).
    op.create_index(
        'idx_quotations_status_valid_till',
        'quotations',
        ['status', 'valid_till']
    )

    # Composite (business_id, status, valid_till) — the hot listing path:
    #   WHERE business_id = ? AND status = ? ORDER BY valid_till ASC
    # PostgreSQL can satisfy the filter + sort entirely from this index.
    op.create_index(
        'idx_quotations_business_status_valid_till',
        'quotations',
        ['business_id', 'status', 'valid_till']
    )

    # -----------------------------------------------------------------------
    # quotations — sorting / number generation
    # -----------------------------------------------------------------------

    # created_at is used by generate_quotation_number() ORDER BY desc.
    op.create_index(
        'idx_quotations_created_at',
        'quotations',
        ['created_at']
    )

    # -----------------------------------------------------------------------
    # Customer full-name trigram index — supports ilike '%search%' on the
    # quotation listing's party-name search / suggestions endpoint.
    # pg_trgm should already be enabled by the previous migration
    # (8dfd9591067d), but we guard with IF NOT EXISTS to be safe.
    # -----------------------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_customers_fullname_trgm
        ON customers
        USING gin (LOWER(first_name || ' ' || last_name) gin_trgm_ops)
        WHERE is_deleted = false;
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_customers_fullname_trgm;")

    op.drop_index('idx_quotations_created_at',              table_name='quotations')
    op.drop_index('idx_quotations_business_status_valid_till', table_name='quotations')
    op.drop_index('idx_quotations_status_valid_till',       table_name='quotations')
    op.drop_index('idx_quotations_status',                  table_name='quotations')
    op.drop_index('idx_quotations_business_id',             table_name='quotations')
    op.drop_index('idx_quotations_customer_id',             table_name='quotations')
    op.drop_index('idx_quotation_items_item_id',            table_name='quotation_items')
    op.drop_index('idx_quotation_items_quotation_id',       table_name='quotation_items')
