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
    
    # Check if constraint exists before dropping it
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    constraints = inspector.get_foreign_keys('businesses')
    
    # Drop existing foreign key constraint on businesses.address_id if it exists
    for constraint in constraints:
        if constraint['name'] in ['businesses_address_id_fkey', 'fk_rails_b8a842d5e10_addresses']:
            op.drop_constraint(constraint['name'], 'businesses', type_='foreignkey')
            break
    
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
    # Check if constraint exists before dropping it
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    constraints = inspector.get_foreign_keys('businesses')
    
    # Revert the changes if needed
    for constraint in constraints:
        if constraint['name'] == 'businesses_address_id_fkey':
            op.drop_constraint('businesses_address_id_fkey', 'businesses', type_='foreignkey')
            break
    
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
