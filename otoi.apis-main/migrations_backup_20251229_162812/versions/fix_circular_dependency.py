"""fix circular dependency

Revision ID: fix_circular_dependency
Revises: 
Create Date: 2025-09-01 11:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fix_circular_dependency'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Make business_id nullable in addresses
    op.alter_column('addresses', 'business_id',
                   existing_type=sa.INTEGER(),
                   nullable=True,
                   existing_foreign_key=('businesses', 'id'))
    
    # Drop existing foreign key constraint on businesses.address_id
    op.drop_constraint('businesses_address_id_fkey', 'businesses', type_='foreignkey')
    
    # Recreate the foreign key with DEFERRABLE
    op.create_foreign_key(
        'businesses_address_id_fkey',
        'businesses', 'addresses',
        ['address_id'], ['uuid'],
        ondelete='SET NULL',
        deferrable=True,
        initially='DEFERRED'
    )

def downgrade():
    # Revert the changes if needed
    op.drop_constraint('businesses_address_id_fkey', 'businesses', type_='foreignkey')
    
    op.create_foreign_key(
        'businesses_address_id_fkey',
        'businesses', 'addresses',
        ['address_id'], ['uuid'],
        ondelete='SET NULL'
    )
    
    op.alter_column('addresses', 'business_id',
                   existing_type=sa.INTEGER(),
                   nullable=False,
                   existing_foreign_key=('businesses', 'id'))
