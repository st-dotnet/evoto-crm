"""Remove chk_shipping_address constraint manually

Revision ID: ff106ad31655
Revises: 5bef810bed92
Create Date: 2026-01-19 20:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ff106ad31655'
down_revision = '5bef810bed92'
branch_labels = None
depends_on = None


def upgrade():
    # Manually drop the constraint
    op.execute('ALTER TABLE shippings DROP CONSTRAINT IF EXISTS chk_shipping_address')

def downgrade():
    # Recreate the constraint if needed (optional)
    op.execute('''
        ALTER TABLE shippings 
        ADD CONSTRAINT chk_shipping_address 
        CHECK ((address_id IS NOT NULL AND lead_address_id IS NULL) OR 
               (address_id IS NULL AND lead_address_id IS NOT NULL))
    ''')