"""add category_id to items

Revision ID: 5a6b7c8d9e0f
Revises: 184aa5100921
Create Date: 2025-12-26 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '5a6b7c8d9e0f'
down_revision = '184aa5100921'
branch_labels = None
depends_on = None


def has_column(table_name, column_name, connection):
    """Check if a column exists in a table"""
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def has_foreign_key(table_name, fk_name, connection):
    """Check if a foreign key exists in a table"""
    inspector = sa.inspect(connection)
    fks = inspector.get_foreign_keys(table_name)
    return any(fk['name'] == fk_name for fk in fks)

def upgrade():
    conn = op.get_bind()
    
    # Add category_id column if it doesn't exist
    if not has_column('items', 'category_id', conn):
        with op.batch_alter_table('items', schema=None) as batch_op:
            batch_op.add_column(sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Populate category_id by joining with item_categories on category_name
    if has_column('items', 'category_name', conn) and has_column('item_categories', 'uuid', conn):
        conn.execute("""
            UPDATE items i
            SET category_id = ic.uuid
            FROM item_categories ic
            WHERE i.category_name = ic.name
        """)
    
    # Make the column NOT NULL and add foreign key constraint
    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.alter_column('category_id', nullable=False)
        
        if not has_foreign_key('items', 'fk_items_category', conn):
            batch_op.create_foreign_key(
                'fk_items_category',
                'item_categories',
                ['category_id'],
                ['uuid'],
                ondelete='SET NULL'
            )

def downgrade():
    # Drop the foreign key constraint and then the column if they exist
    with op.batch_alter_table('items', schema=None) as batch_op:
        conn = op.get_bind()
        
        if has_foreign_key('items', 'fk_items_category', conn):
            batch_op.drop_constraint('fk_items_category', type_='foreignkey')
            
        if has_column('items', 'category_id', conn):
            batch_op.drop_column('category_id')
