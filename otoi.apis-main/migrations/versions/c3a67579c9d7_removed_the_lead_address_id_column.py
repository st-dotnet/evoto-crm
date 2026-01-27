"""Remove the lead_address_id column

Revision ID: c3a67579c9d7
Revises: 0b92b47c6988
Create Date: 2026-01-19 17:33:22.405123

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'c3a67579c9d7'
down_revision = '0b92b47c6988'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    
    # Check if the foreign key constraint exists before trying to drop it
    inspector = inspect(conn)
    fk_constraints = inspector.get_foreign_keys('shippings')
    fk_name = 'shippings_lead_address_id_fkey'
    
    # Only drop the foreign key if it exists
    if any(fk.get('name') == fk_name for fk in fk_constraints):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.drop_constraint(fk_name, type_='foreignkey')
    
    # Drop the column
    with op.batch_alter_table('shippings', schema=None) as batch_op:
        batch_op.drop_column('lead_address_id')

def downgrade():
    conn = op.get_bind()
    
    # Add the column back
    with op.batch_alter_table('shippings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('lead_address_id', sa.UUID(), nullable=True))
    
    # Recreate the foreign key constraint if it doesn't exist
    inspector = inspect(conn)
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