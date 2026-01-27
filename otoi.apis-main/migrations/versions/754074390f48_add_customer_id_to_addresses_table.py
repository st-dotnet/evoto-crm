"""Add customer_id to addresses table

Revision ID: 754074390f48
Revises: 2026_01_27_1617_add_customer_id_to_addresses
Create Date: 2026-01-27 16:57:20.395966

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect  # Add this import

# revision identifiers, used by Alembic.
revision = '754074390f48'
down_revision = '2026_01_27_1617_add_customer_id_to_addresses'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'addresses' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('addresses')]
        if 'customer_id' not in columns:
            with op.batch_alter_table('addresses', schema=None) as batch_op:
                batch_op.add_column(sa.Column('customer_id', sa.UUID(), nullable=True))
                batch_op.create_foreign_key(
                    'fk_addresses_customer_id',
                    'customers',
                    ['customer_id'],
                    ['uuid'],
                    ondelete='CASCADE'
                )

def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'addresses' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('addresses')]
        if 'customer_id' in columns:
            with op.batch_alter_table('addresses', schema=None) as batch_op:
                # Drop the foreign key constraint first
                fk_constraints = inspector.get_foreign_keys('addresses')
                fk_name = 'fk_addresses_customer_id'
                
                if any(fk.get('name') == fk_name for fk in fk_constraints):
                    batch_op.drop_constraint(fk_name, type_='foreignkey')
                
                # Then drop the column
                batch_op.drop_column('customer_id')