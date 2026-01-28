"""Add customer_id to addresses table

Revision ID: 2026_01_27_1617_add_customer_id_to_addresses
Revises: 199309751da1
Create Date: 2026-01-27 16:17:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '2026_01_27_1617_add_customer_id_to_addresses'
down_revision = '199309751da1'
branch_labels = None
depends_on = None

def get_connection():
    return op.get_bind()

def constraint_exists(conn, constraint_name, table_name='addresses'):
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

def column_exists(conn, column_name, table_name='addresses'):
    result = conn.execute(
        text("""
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = :table_name 
        AND column_name = :column_name
        """),
        {'table_name': table_name, 'column_name': column_name}
    ).scalar()
    return result is not None

def upgrade():
    conn = get_connection()
    
    # Add customer_id column if it doesn't exist
    if not column_exists(conn, 'customer_id'):
        op.add_column('addresses', sa.Column('customer_id', sa.UUID(), nullable=True))
    
    # Add foreign key constraint if it doesn't exist
    if not constraint_exists(conn, 'fk_addresses_customer'):
        op.create_foreign_key(
            'fk_addresses_customer',
            'addresses', 'customers',
            ['customer_id'], ['uuid'],
            ondelete='SET NULL'
        )

def downgrade():
    conn = get_connection()
    
    # Drop foreign key constraint if it exists
    if constraint_exists(conn, 'fk_addresses_customer'):
        op.drop_constraint('fk_addresses_customer', 'addresses', type_='foreignkey')
    
    # Drop column if it exists
    if column_exists(conn, 'customer_id'):
        op.drop_column('addresses', 'customer_id')