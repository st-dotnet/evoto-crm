"""convert-id-to-UUID

Revision ID: 184aa5100921
Revises: h1i2j3
Create Date: 2025-12-26 16:06:23.044997

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '184aa5100921'
down_revision = 'h1i2j3'
branch_labels = None
depends_on = None


def has_column(table_name, column_name, connection):
    """Check if a column exists in a table"""
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def has_primary_key(table_name, connection):
    """Check if a table has a primary key"""
    inspector = sa.inspect(connection)
    return bool(inspector.get_pk_constraint(table_name).get('constrained_columns'))

def upgrade():
    conn = op.get_bind()
    
    # Only add UUID column if it doesn't exist
    if not has_column('item_categories', 'uuid', conn):
        with op.batch_alter_table('item_categories', schema=None) as batch_op:
            batch_op.add_column(sa.Column('uuid', sa.UUID(), nullable=True))
    
    # Generate UUIDs for existing rows that don't have one
    conn.execute('UPDATE item_categories SET uuid = gen_random_uuid() WHERE uuid IS NULL')
    
    # Now alter the column to be NOT NULL and set up the primary key
    with op.batch_alter_table('item_categories', schema=None) as batch_op:
        # Check if we need to alter the column
        inspector = sa.inspect(conn)
        col_info = next((col for col in inspector.get_columns('item_categories') 
                        if col['name'] == 'uuid'), None)
        
        if col_info and col_info.get('nullable', True):
            batch_op.alter_column('uuid', nullable=False)
            
        # Only create foreign keys if they don't exist
        fk_created_by_exists = any(
            fk['referred_table'] == 'users' and 'created_by' in fk['constrained_columns']
            for fk in inspector.get_foreign_keys('item_categories')
        )
        fk_updated_by_exists = any(
            fk['referred_table'] == 'users' and 'updated_by' in fk['constrained_columns']
            for fk in inspector.get_foreign_keys('item_categories')
        )
        
        if not fk_created_by_exists:
            batch_op.create_foreign_key(
                'fk_item_categories_created_by',
                'users',
                ['created_by'],
                ['id'],
                ondelete='SET NULL'
            )
            
        if not fk_updated_by_exists:
            batch_op.create_foreign_key(
                'fk_item_categories_updated_by',
                'users',
                ['updated_by'],
                ['id'],
                ondelete='SET NULL'
            )
        
        # Only drop the old primary key if it exists and is on the 'id' column
        pk_constraint = inspector.get_pk_constraint('item_categories')
        if pk_constraint.get('constrained_columns') == ['id']:
            batch_op.drop_constraint('item_categories_pkey', type_='primary')
            
        # Only drop the id column if it exists
        if has_column('item_categories', 'id', conn):
            batch_op.drop_column('id')
            
        # Only create the new primary key if it doesn't exist
        if not has_primary_key('item_categories', conn):
            batch_op.create_primary_key('item_categories_pkey', ['uuid'])

    with op.batch_alter_table('item_types', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        batch_op.create_foreign_key(None, 'users', ['updated_by'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key(None, 'users', ['created_by'], ['id'], ondelete='SET NULL')

    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.alter_column('category_id',
               existing_type=sa.INTEGER(),
               type_=sa.UUID(),
               existing_nullable=False)
        batch_op.alter_column('opening_stock',
               existing_type=sa.DOUBLE_PRECISION(precision=53),
               nullable=True)
        batch_op.alter_column('is_deleted',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
        batch_op.create_foreign_key(None, 'item_categories', ['category_id'], ['uuid'], ondelete='CASCADE')
        batch_op.create_foreign_key(None, 'item_types', ['item_type_id'], ['id'], ondelete='CASCADE')
        batch_op.create_foreign_key(None, 'measuring_units', ['measuring_unit_id'], ['id'], ondelete='CASCADE')

    with op.batch_alter_table('measuring_units', schema=None) as batch_op:
        batch_op.alter_column('created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        batch_op.create_foreign_key(None, 'users', ['created_by'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key(None, 'users', ['updated_by'], ['id'], ondelete='SET NULL')

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # First, add back the id column
    with op.batch_alter_table('item_categories', schema=None) as batch_op:
        # Drop the primary key constraint first
        batch_op.drop_constraint('item_categories_pkey', type_='primary')
        # Add back the id column
        batch_op.add_column(sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False))
        # Set a default value for id (this will be updated later)
        batch_op.execute('UPDATE item_categories SET id = nextval(\'item_categories_id_seq\')')
        # Set the primary key
        batch_op.create_primary_key('item_categories_pkey', ['id'])
        # Drop foreign key constraints
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.alter_column('created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        # Drop the uuid column
        batch_op.drop_column('uuid')

    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.alter_column('is_deleted',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('false'))
        batch_op.alter_column('opening_stock',
               existing_type=sa.DOUBLE_PRECISION(precision=53),
               nullable=False)
        # Convert UUID to integer for category_id
        batch_op.alter_column('category_id',
               existing_type=sa.UUID(),
               type_=sa.INTEGER(),
               postgresql_using='1',  # This is a placeholder, you might need a better conversion
               existing_nullable=False)
        
        # Recreate the foreign key constraint
        batch_op.create_foreign_key(None, 'item_categories', ['category_id'], ['id'], ondelete='CASCADE')

    with op.batch_alter_table('item_types', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.alter_column('created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))

    with op.batch_alter_table('measuring_units', schema=None) as batch_op:
        batch_op.add_column(sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False))
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.alter_column('created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
        batch_op.drop_column('uuid')

    # ### end Alembic commands ###
