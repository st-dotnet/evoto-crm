from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect

# revision identifiers, used by Alembic.
revision = '655b587305b9'
down_revision = 'b18a842d5e10'
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

def column_exists(conn, table_name, column_name):
    inspector = inspect(conn)
    columns = [column['name'] for column in inspector.get_columns(table_name)]
    return column_name in columns

def table_exists(conn, table_name):
    inspector = inspect(conn)
    return table_name in inspector.get_table_names()

def index_exists(conn, table_name, index_name):
    inspector = inspect(conn)
    indexes = inspector.get_indexes(table_name)
    return any(index['name'] == index_name for index in indexes)

def upgrade():
    conn = op.get_bind()
    
    # First, check and drop the mobile unique constraint if it exists
    if constraint_exists(conn, 'customers_mobile_key', 'customers'):
        with op.batch_alter_table('customers', schema=None) as batch_op:
            batch_op.drop_constraint('customers_mobile_key', type_='unique')
    
    # Check if the constraint already exists before creating it
    if not constraint_exists(conn, 'uq_customers_lead_id', 'customers'):
        with op.batch_alter_table('customers', schema=None) as batch_op:
            batch_op.create_unique_constraint('uq_customers_lead_id', ['lead_id'])

    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.alter_column('category_id',
                       existing_type=sa.UUID(),
                       nullable=False)

    # Check and drop leads_mobile_key if it exists
    if constraint_exists(conn, 'leads_mobile_key', 'leads'):
        with op.batch_alter_table('leads', schema=None) as batch_op:
            batch_op.drop_constraint('leads_mobile_key', type_='unique')

    if not table_exists(conn, 'shippings'):
        op.create_table('shippings',
            sa.Column('uuid', sa.UUID(), nullable=False),
            sa.Column('customer_id', sa.UUID(), nullable=False),
            sa.Column('address_id', sa.UUID(), nullable=True),
            sa.Column('lead_address_id', sa.UUID(), nullable=True),
            sa.Column('is_default', sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(['address_id'], ['addresses.uuid'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['customer_id'], ['customers.uuid'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['lead_address_id'], ['lead_addresses.uuid'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('uuid')
        )
        op.create_index('one_default_shipping_per_customer', 'shippings', ['customer_id'], unique=True, 
                       postgresql_where=sa.text('is_default = true'))
    else:
        # Table exists, add columns if they don't exist
        if not column_exists(conn, 'shippings', 'customer_id'):
            op.add_column('shippings', sa.Column('customer_id', sa.UUID(), nullable=False))
        if not column_exists(conn, 'shippings', 'address_id'):
            op.add_column('shippings', sa.Column('address_id', sa.UUID(), nullable=True))
        if not column_exists(conn, 'shippings', 'lead_address_id'):
            op.add_column('shippings', sa.Column('lead_address_id', sa.UUID(), nullable=True))
        if not column_exists(conn, 'shippings', 'is_default'):
            op.add_column('shippings', sa.Column('is_default', sa.Boolean(), nullable=False))
        
        # Add foreign keys if they don't exist
        if not constraint_exists(conn, 'fk_shippings_customer', 'shippings'):
            op.create_foreign_key('fk_shippings_customer', 'shippings', 'customers', ['customer_id'], ['uuid'], ondelete='CASCADE')
        if not constraint_exists(conn, 'fk_shippings_address', 'shippings'):
            op.create_foreign_key('fk_shippings_address', 'shippings', 'addresses', ['address_id'], ['uuid'], ondelete='CASCADE')
        if not constraint_exists(conn, 'fk_shippings_lead_address', 'shippings'):
            op.create_foreign_key('fk_shippings_lead_address', 'shippings', 'lead_addresses', ['lead_address_id'], ['uuid'], ondelete='CASCADE')
        
        # Create index if it doesn't exist
        if not index_exists(conn, 'shippings', 'one_default_shipping_per_customer'):
            op.create_index('one_default_shipping_per_customer', 'shippings', ['customer_id'], unique=True, 
                          postgresql_where=sa.text('is_default = true'))

def downgrade():
    conn = op.get_bind()
    
    if table_exists(conn, 'shippings'):
        # Drop foreign keys if they exist
        if constraint_exists(conn, 'fk_shippings_address', 'shippings'):
            op.drop_constraint('fk_shippings_address', 'shippings', type_='foreignkey')
        if constraint_exists(conn, 'fk_shippings_lead_address', 'shippings'):
            op.drop_constraint('fk_shippings_lead_address', 'shippings', type_='foreignkey')
        if constraint_exists(conn, 'fk_shippings_customer', 'shippings'):
            op.drop_constraint('fk_shippings_customer', 'shippings', type_='foreignkey')
        
        # Drop index if it exists
        if index_exists(conn, 'shippings', 'one_default_shipping_per_customer'):
            op.drop_index('one_default_shipping_per_customer', table_name='shippings')
        
        # Drop the table
        op.drop_table('shippings')

    with op.batch_alter_table('leads', schema=None) as batch_op:
        if not constraint_exists(conn, 'leads_mobile_key', 'leads'):
            batch_op.create_unique_constraint('leads_mobile_key', ['mobile'], postgresql_nulls_not_distinct=False)

    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.alter_column('category_id',
                       existing_type=sa.UUID(),
                       nullable=True)

    with op.batch_alter_table('customers', schema=None) as batch_op:
        if constraint_exists(conn, 'uq_customers_lead_id', 'customers'):
            batch_op.drop_constraint('uq_customers_lead_id', type_='unique')
        if not constraint_exists(conn, 'customers_mobile_key', 'customers'):
            batch_op.create_unique_constraint('customers_mobile_key', ['mobile'], postgresql_nulls_not_distinct=False)