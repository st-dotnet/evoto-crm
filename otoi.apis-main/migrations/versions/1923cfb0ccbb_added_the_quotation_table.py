"""Added the quotation table

Revision ID: 1923cfb0ccbb
Revises: 27ab3962863c
Create Date: 2026-01-19 17:33:22.405123

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '1923cfb0ccbb'
down_revision = '27ab3962863c'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if the table already exists
    if 'quotations' not in inspector.get_table_names():
        op.create_table('quotations',
            sa.Column('uuid', sa.UUID(), nullable=False),
            sa.Column('business_id', sa.Integer(), nullable=False),
            sa.Column('customer_id', sa.UUID(), nullable=False),
            sa.Column('billing_address_id', sa.UUID(), nullable=False),
            sa.Column('shipping_address_id', sa.UUID(), nullable=False),
            sa.Column('quotation_date', sa.Date(), nullable=False),
            sa.Column('valid_till', sa.Date(), nullable=True),
            sa.Column('subtotal', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('tax_total', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('discount_total', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('additional_charges_total', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('round_off', sa.Numeric(precision=12, scale=2), nullable=True),
            sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('created_by', sa.UUID(), nullable=True),
            sa.Column('updated_by', sa.UUID(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['billing_address_id'], ['addresses.uuid'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['created_by'], ['users.uuid'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['customer_id'], ['customers.uuid'], ),
            sa.ForeignKeyConstraint(['shipping_address_id'], ['addresses.uuid'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['updated_by'], ['users.uuid'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('uuid')
        )

def downgrade():
    # Only drop the table if it exists
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'quotations' in inspector.get_table_names():
        op.drop_table('quotations')