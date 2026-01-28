"""Rename UUID columns to original names

Revision ID: 8b878d6528a6
Revises: f1c40ba4bc1c
Create Date: 2026-01-20 20:26:39.665601

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8b878d6528a6'
down_revision = 'f1c40ba4bc1c'
branch_labels = None
depends_on = None


def upgrade():
    # Rename users columns
    op.alter_column('users', 'uuid', new_column_name='id')
    op.alter_column('users', 'created_by_uuid', new_column_name='created_by')
    op.alter_column('users', 'updated_by_uuid', new_column_name='updated_by')
    
    # Rename in all other tables
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.alter_column(table, 'created_by_uuid', new_column_name='created_by')
        op.alter_column(table, 'updated_by_uuid', new_column_name='updated_by')
    
    op.alter_column('user_business', 'user_uuid', new_column_name='user_id')
    
    # # Handle other changes from your original migration
    # with op.batch_alter_table('items', schema=None) as batch_op:
    #     batch_op.alter_column('category_id', existing_type=sa.UUID(), nullable=False)
    
    # with op.batch_alter_table('customers', schema=None) as batch_op:
    #     batch_op.drop_constraint('customers_mobile_key', type_='unique')
    #     batch_op.create_unique_constraint('uq_customers_lead_id', ['lead_id'])
    
    # with op.batch_alter_table('leads', schema=None) as batch_op:
    #     batch_op.drop_constraint('leads_mobile_key', type_='unique')


def downgrade():
    # Reverse the renames
    op.alter_column('users', 'id', new_column_name='uuid')
    op.alter_column('users', 'created_by', new_column_name='created_by_uuid')
    op.alter_column('users', 'updated_by', new_column_name='updated_by_uuid')
    
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.alter_column(table, 'created_by', new_column_name='created_by_uuid')
        op.alter_column(table, 'updated_by', new_column_name='updated_by_uuid')
    
    op.alter_column('user_business', 'user_id', new_column_name='user_uuid')
