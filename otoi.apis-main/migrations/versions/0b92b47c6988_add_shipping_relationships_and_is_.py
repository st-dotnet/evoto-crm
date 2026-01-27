"""Add shipping relationships and is_default column

Revision ID: 0b92b47c6988
Revises: 655b587305b9
Create Date: 2026-01-19 17:22:06.405301

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

# revision identifiers, used by Alembic.
revision = '0b92b47c6988'
down_revision = '655b587305b9'
branch_labels = None
depends_on = None

def constraint_exists(conn, constraint_name, table_name):
    result = conn.execute(
        text("""
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = :table_name 
        AND constraint_name = :constraint_name
        """),
        {'table_name': table_name, 'constraint_name': constraint_name}
    ).scalar()
    return result is not None

def upgrade():
    conn = op.get_bind()
    
    # Only drop the constraint if it exists
    if constraint_exists(conn, 'customers_mobile_key', 'customers'):
        with op.batch_alter_table('customers', schema=None) as batch_op:
            batch_op.drop_constraint('customers_mobile_key', type_='unique')

    # Get existing columns
    inspector = inspect(conn)
    existing_columns = [col['name'] for col in inspector.get_columns('shippings')]
    
    # Only add columns that don't exist
    with op.batch_alter_table('shippings', schema=None) as batch_op:
        if 'is_default' not in existing_columns:
            batch_op.add_column(sa.Column('is_default', sa.Boolean(), nullable=True))
        if 'customer_id' not in existing_columns:
            batch_op.add_column(sa.Column('customer_id', sa.UUID(), nullable=True))
        if 'address_id' not in existing_columns:
            batch_op.add_column(sa.Column('address_id', sa.UUID(), nullable=True))
        if 'lead_address_id' not in existing_columns:
            batch_op.add_column(sa.Column('lead_address_id', sa.UUID(), nullable=True))

    # Create foreign key constraints if they don't exist
    if not constraint_exists(conn, 'fk_shippings_customer', 'shippings'):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.create_foreign_key('fk_shippings_customer', 'customers', ['customer_id'], ['uuid'], ondelete='CASCADE')

    if not constraint_exists(conn, 'fk_shippings_address', 'shippings'):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.create_foreign_key('fk_shippings_address', 'addresses', ['address_id'], ['uuid'], ondelete='CASCADE')

    if not constraint_exists(conn, 'fk_shippings_lead_address', 'shippings'):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.create_foreign_key('fk_shippings_lead_address', 'lead_addresses', ['lead_address_id'], ['uuid'], ondelete='CASCADE')

    # Create index if it doesn't exist
    if not any(index['name'] == 'one_default_shipping_per_customer' 
              for index in inspector.get_indexes('shippings')):
        op.create_index('one_default_shipping_per_customer', 'shippings', ['customer_id'], 
                       unique=True, postgresql_where=sa.text('is_default = true'))

def downgrade():
    conn = op.get_bind()
    
    # Drop index if it exists
    if any(index['name'] == 'one_default_shipping_per_customer' 
          for index in inspect(conn).get_indexes('shippings')):
        op.drop_index('one_default_shipping_per_customer', table_name='shippings')

    # Drop foreign key constraints if they exist
    if constraint_exists(conn, 'fk_shippings_lead_address', 'shippings'):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.drop_constraint('fk_shippings_lead_address', type_='foreignkey')

    if constraint_exists(conn, 'fk_shippings_address', 'shippings'):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.drop_constraint('fk_shippings_address', type_='foreignkey')

    if constraint_exists(conn, 'fk_shippings_customer', 'shippings'):
        with op.batch_alter_table('shippings', schema=None) as batch_op:
            batch_op.drop_constraint('fk_shippings_customer', type_='foreignkey')

    # Drop columns if they exist
    inspector = inspect(conn)
    columns = [column['name'] for column in inspector.get_columns('shippings')]
    
    with op.batch_alter_table('shippings', schema=None) as batch_op:
        if 'is_default' in columns:
            batch_op.drop_column('is_default')
        if 'customer_id' in columns:
            batch_op.drop_column('customer_id')
        if 'address_id' in columns:
            batch_op.drop_column('address_id')
        if 'lead_address_id' in columns:
            batch_op.drop_column('lead_address_id')

    # Recreate the mobile key constraint if it was dropped
    if not constraint_exists(conn, 'customers_mobile_key', 'customers'):
        with op.batch_alter_table('customers', schema=None) as batch_op:
            batch_op.create_unique_constraint('customers_mobile_key', ['mobile'], postgresql_nulls_not_distinct=False)