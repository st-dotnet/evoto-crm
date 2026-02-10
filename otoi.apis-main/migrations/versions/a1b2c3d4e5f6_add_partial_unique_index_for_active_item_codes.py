"""add partial unique index for active item codes

Revision ID: a1b2c3d4e5f6
Revises: h1i2j3
Create Date: 2026-02-10

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "h1i2j3"
branch_labels = None
depends_on = None


def upgrade():
    # First, remove the unique constraint from item_code column
    # This requires recreating the table without the unique constraint
    op.execute("""
        ALTER TABLE items 
        DROP CONSTRAINT IF EXISTS items_item_code_key
    """)
    
    # Create partial unique index that only applies to active (non-deleted) items
    op.execute("""
        CREATE UNIQUE INDEX unique_active_item_code 
        ON items(item_code) 
        WHERE is_deleted = false AND item_code IS NOT NULL
    """)


def downgrade():
    # Drop the partial unique index
    op.drop_index('unique_active_item_code', table_name='items')
    
    # Recreate the original unique constraint
    op.execute("""
        ALTER TABLE items 
        ADD CONSTRAINT items_item_code_key UNIQUE (item_code)
    """)
