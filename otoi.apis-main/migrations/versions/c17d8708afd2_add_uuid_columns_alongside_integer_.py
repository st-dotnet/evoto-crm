"""Add UUID columns alongside INTEGER columns

Revision ID: c17d8708afd2
Revises: df924863ec74
Create Date: <generated_date>

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c17d8708afd2'
down_revision = 'df924863ec74'
branch_labels = None
depends_on = None


def upgrade():
    # Add new UUID columns to users table
    op.add_column('users', sa.Column('uuid', postgresql.UUID(), nullable=True))
    op.add_column('users', sa.Column('created_by_uuid', postgresql.UUID(), nullable=True))
    op.add_column('users', sa.Column('updated_by_uuid', postgresql.UUID(), nullable=True))
    
    # Add new UUID columns to all tables with user foreign keys
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.add_column(table, sa.Column('created_by_uuid', postgresql.UUID(), nullable=True))
        op.add_column(table, sa.Column('updated_by_uuid', postgresql.UUID(), nullable=True))
    
    # Add UUID column to user_business
    op.add_column('user_business', sa.Column('user_uuid', postgresql.UUID(), nullable=True))


def downgrade():
    # Drop UUID columns
    op.drop_column('users', 'uuid')
    op.drop_column('users', 'created_by_uuid')
    op.drop_column('users', 'updated_by_uuid')
    
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.drop_column(table, 'created_by_uuid')
        op.drop_column(table, 'updated_by_uuid')
    
    op.drop_column('user_business', 'user_uuid')