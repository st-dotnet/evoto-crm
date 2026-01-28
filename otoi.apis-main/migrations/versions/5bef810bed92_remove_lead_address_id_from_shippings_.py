"""Remove lead_address_id from shippings table

Revision ID: 5bef810bed92
Revises: a8298da99cb7
Create Date: 2026-01-19 17:33:22.405123

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '5bef810bed92'
down_revision = 'a8298da99cb7'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Get all foreign keys for the shippings table
    fk_constraints = inspector.get_foreign_keys('shippings')
    fk_name = 'shippings_lead_address_id_fkey'
    
    # Only drop the foreign key if it exists
    if any(fk.get('name') == fk_name for fk in fk_constraints):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.drop_constraint(fk_name, type_='foreignkey')
    
    # Drop the column if it exists
    columns = [col['name'] for col in inspector.get_columns('shippings')]
    if 'lead_address_id' in columns:
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.drop_column('lead_address_id')

def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Add the column back if it doesn't exist
    columns = [col['name'] for col in inspector.get_columns('shippings')]
    if 'lead_address_id' not in columns:
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.add_column(sa.Column('lead_address_id', sa.UUID(), nullable=True))
    
    # Recreate the foreign key constraint if it doesn't exist
    fk_constraints = inspector.get_foreign_keys('shippings')
    fk_name = 'shippings_lead_address_id_fkey'
    
    if not any(fk.get('name') == fk_name for fk in fk_constraints):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.create_foreign_key(
                fk_name,
                'lead_addresses',
                ['lead_address_id'],
                ['uuid'],
                ondelete='CASCADE'
            )