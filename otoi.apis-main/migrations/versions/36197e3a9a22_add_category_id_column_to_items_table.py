"""Add category_id column to items table

Revision ID: 36197e3a9a22
Revises: 5a6b7c8d9e0f
Create Date: 2025-12-26 17:52:09.320643

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '36197e3a9a22'
down_revision = '5a6b7c8d9e0f'
branch_labels = None
depends_on = None


def has_table(table_name, connection):
    """Check if a table exists"""
    inspector = sa.inspect(connection)
    return table_name in inspector.get_table_names()

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
    
    # Drop item_category table if it exists
    if has_table('item_category', conn):
        op.drop_table('item_category')
    
    # First handle the item_categories table updates
    with op.batch_alter_table('item_categories', schema=None) as batch_op:
        inspector = sa.inspect(conn)
        
        # Ensure uuid column exists and is populated
        if has_column('item_categories', 'uuid', conn):
            # Generate UUIDs for any null values
            conn.execute(sa.text("""
                UPDATE item_categories 
                SET uuid = gen_random_uuid() 
                WHERE uuid IS NULL
            """))
            
            # Make uuid non-nullable
            batch_op.alter_column('uuid',
                   existing_type=sa.UUID(),
                   nullable=False,
                   server_default=sa.text('gen_random_uuid()'))
        
        # Handle created_at column
        if has_column('item_categories', 'created_at', conn):
            batch_op.alter_column('created_at',
                   existing_type=postgresql.TIMESTAMP(),
                   nullable=False,
                   existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        
        # Create foreign keys if they don't exist
        if not has_foreign_key('item_categories', 'fk_item_categories_created_by', conn):
            batch_op.create_foreign_key(
                'fk_item_categories_created_by',
                'users',
                ['created_by'],
                ['id'],
                ondelete='SET NULL'
            )
        
        if not has_foreign_key('item_categories', 'fk_item_categories_updated_by', conn):
            batch_op.create_foreign_key(
                'fk_item_categories_updated_by',
                'users',
                ['updated_by'],
                ['id'],
                ondelete='SET NULL'
            )
        
        # Handle primary key migration from id to uuid
        pk_constraint = inspector.get_pk_constraint('item_categories')
        if pk_constraint and 'id' in pk_constraint.get('constrained_columns', []):
            # Drop the old primary key
            batch_op.drop_constraint('item_categories_pkey', type_='primary')
        
        # Create new primary key on uuid if it doesn't exist
        if not (pk_constraint and 'uuid' in pk_constraint.get('constrained_columns', [])):
            batch_op.create_primary_key('item_categories_pkey', ['uuid'])
        
        # Drop the id column if it exists and is not being used as a foreign key
        if has_column('item_categories', 'id', conn):
            # Check if there are any foreign keys referencing this column
            fks = inspector.get_foreign_keys('item_categories')
            id_referenced = any('id' in fk.get('constrained_columns', []) for fk in fks)
            
            if not id_referenced:
                batch_op.drop_column('id')

    # Handle item_types table updates
    with op.batch_alter_table('item_types', schema=None) as batch_op:
        if has_column('item_types', 'created_at', conn):
            batch_op.alter_column('created_at',
                   existing_type=postgresql.TIMESTAMP(),
                   nullable=False,
                   existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        
        # Add foreign keys with explicit names
        if not has_foreign_key('item_types', 'fk_item_types_created_by', conn):
            batch_op.create_foreign_key(
                'fk_item_types_created_by',
                'users',
                ['created_by'],
                ['id'],
                ondelete='SET NULL'
            )
        
        if not has_foreign_key('item_types', 'fk_item_types_updated_by', conn):
            batch_op.create_foreign_key(
                'fk_item_types_updated_by',
                'users',
                ['updated_by'],
                ['id'],
                ondelete='SET NULL'
            )
    
    # Now handle items table updates
    with op.batch_alter_table('items', schema=None) as batch_op:
        # Add category_id column if it doesn't exist
        if not has_column('items', 'category_id', conn):
            batch_op.add_column(sa.Column('category_id', sa.UUID(), nullable=True))
        
        # Add is_deleted column if it doesn't exist
        if not has_column('items', 'is_deleted', conn):
            batch_op.add_column(sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default=sa.text('false')))
        
        # Make opening_stock nullable if it isn't already
        if has_column('items', 'opening_stock', conn):
            batch_op.alter_column('opening_stock',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=True)
        
        # Create foreign key constraints if they don't exist
        if not has_foreign_key('items', 'fk_items_category_id', conn):
            batch_op.create_foreign_key(
                'fk_items_category_id',
                'item_categories',
                ['category_id'],
                ['uuid'],
                ondelete='CASCADE'
            )
        
        if not has_foreign_key('items', 'fk_items_item_type_id', conn):
            batch_op.create_foreign_key(
                'fk_items_item_type_id',
                'item_types',
                ['item_type_id'],
                ['id'],
                ondelete='CASCADE'
            )
        
        if not has_foreign_key('items', 'fk_items_measuring_unit_id', conn):
            batch_op.create_foreign_key(
                'fk_items_measuring_unit_id',
                'measuring_units',
                ['measuring_unit_id'],
                ['id'],
                ondelete='CASCADE'
            )
        
        # If we have data, we need to populate the category_id
        # This is a simplified example - you might need to adjust based on your data model
        if has_column('items', 'category_name', conn) and has_column('item_categories', 'name', conn):
            conn.execute(sa.text("""
                UPDATE items i
                SET category_id = ic.uuid
                FROM item_categories ic
                WHERE i.category_name = ic.name
            """))

    with op.batch_alter_table('measuring_units', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        batch_op.create_foreign_key(None, 'users', ['created_by'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key(None, 'users', ['updated_by'], ['id'], ondelete='SET NULL')

    # ### end Alembic commands ###


def downgrade():
    conn = op.get_bind()
    
    with op.batch_alter_table('measuring_units', schema=None) as batch_op:
        # Only drop constraints if they exist
        if has_foreign_key('measuring_units', 'fk_measuring_units_created_by', conn):
            batch_op.drop_constraint('fk_measuring_units_created_by', type_='foreignkey')
        if has_foreign_key('measuring_units', 'fk_measuring_units_updated_by', conn):
            batch_op.drop_constraint('fk_measuring_units_updated_by', type_='foreignkey')
        
        # Only alter if the column exists
        if has_column('measuring_units', 'created_at', conn):
            batch_op.alter_column('created_at',
                   existing_type=postgresql.TIMESTAMP(),
                   nullable=True,
                   existing_server_default=sa.text('CURRENT_TIMESTAMP'))

    with op.batch_alter_table('items', schema=None) as batch_op:
        # Drop foreign key constraints if they exist
        if has_foreign_key('items', 'fk_items_category_id', conn):
            batch_op.drop_constraint('fk_items_category_id', type_='foreignkey')
        if has_foreign_key('items', 'fk_items_item_type_id', conn):
            batch_op.drop_constraint('fk_items_item_type_id', type_='foreignkey')
        if has_foreign_key('items', 'fk_items_measuring_unit_id', conn):
            batch_op.drop_constraint('fk_items_measuring_unit_id', type_='foreignkey')
        
        # Only alter if the column exists
        if has_column('items', 'opening_stock', conn):
            batch_op.alter_column('opening_stock',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   nullable=False)
        
        # Only drop columns if they exist
        if has_column('items', 'is_deleted', conn):
            batch_op.drop_column('is_deleted')
        if has_column('items', 'category_id', conn):
            batch_op.drop_column('category_id')

    with op.batch_alter_table('item_types', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.alter_column('created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))

    with op.batch_alter_table('item_categories', schema=None) as batch_op:
        # Only add id column if it doesn't exist
        if not has_column('item_categories', 'id', conn):
            batch_op.add_column(sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False))
        
        # Drop foreign key constraints if they exist
        if has_foreign_key('item_categories', 'fk_item_categories_created_by', conn):
            batch_op.drop_constraint('fk_item_categories_created_by', type_='foreignkey')
        if has_foreign_key('item_categories', 'fk_item_categories_updated_by', conn):
            batch_op.drop_constraint('fk_item_categories_updated_by', type_='foreignkey')
        
        # Only alter if the column exists
        if has_column('item_categories', 'created_at', conn):
            batch_op.alter_column('created_at',
                   existing_type=postgresql.TIMESTAMP(),
                   nullable=True,
                   existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        
        # Only alter uuid if it exists
        if has_column('item_categories', 'uuid', conn):
            batch_op.alter_column('uuid',
               existing_type=sa.UUID(),
               nullable=True,
               existing_server_default=sa.text('gen_random_uuid()'))

    op.create_table('item_category',
    sa.Column('uuid', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('created_by', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('updated_by', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('uuid', name='item_category_pkey')
    )
    # ### end Alembic commands ###
