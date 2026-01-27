"""Add shipping_id to lead_addresses table

Revision ID: 199309751da1
Revises: f3ecc8d828d1
Create Date: 2026-01-19 17:33:22.405123

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '199309751da1'
down_revision = 'f3ecc8d828d1'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Check if the table exists
    if 'shippings' in inspector.get_table_names():
        # Get all indexes for the shippings table
        indexes = [idx['name'] for idx in inspector.get_indexes('shippings')]
        
        # Only drop the index if it exists
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            if 'idx_shippings_address_id' in indexes:
                batch_op.drop_index('idx_shippings_address_id')
            if 'idx_shippings_customer_id' in indexes:
                batch_op.drop_index('idx_shippings_customer_id')
    
    # Add shipping_id to lead_addresses if it doesn't exist
    if 'lead_addresses' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('lead_addresses')]
        if 'shipping_id' not in columns:
            with op.batch_alter_table('lead_addresses', schema=None) as batch_op:
                batch_op.add_column(sa.Column('shipping_id', sa.UUID(), nullable=True))
                batch_op.create_foreign_key(
                    'fk_lead_addresses_shipping_id',
                    'shippings',
                    ['shipping_id'],
                    ['uuid'],
                    ondelete='CASCADE'
                )

def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Drop the shipping_id column if it exists
    if 'lead_addresses' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('lead_addresses')]
        if 'shipping_id' in columns:
            with op.batch_alter_table('lead_addresses', schema=None) as batch_op:
                # Drop the foreign key constraint first
                fk_constraints = inspector.get_foreign_keys('lead_addresses')
                fk_name = 'fk_lead_addresses_shipping_id'
                
                if any(fk.get('name') == fk_name for fk in fk_constraints):
                    batch_op.drop_constraint(fk_name, type_='foreignkey')
                
                # Then drop the column
                batch_op.drop_column('shipping_id')