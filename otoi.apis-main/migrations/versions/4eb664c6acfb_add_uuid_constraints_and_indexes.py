"""Add UUID constraints and indexes

Revision ID: 4eb664c6acfb
Revises: c863d5ff8724
Create Date: 2026-01-20 18:14:57.892056

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4eb664c6acfb'
down_revision = 'c863d5ff8724'
branch_labels = None
depends_on = None


def upgrade():
    # Create unique constraint on users.uuid
    op.create_unique_constraint('uq_users_uuid', 'users', ['uuid'])
    
    # Create indexes for better performance
    op.create_index('ix_users_uuid', 'users', ['uuid'])
    op.create_index('ix_users_created_by_uuid', 'users', ['created_by_uuid'])
    op.create_index('ix_users_updated_by_uuid', 'users', ['updated_by_uuid'])
    
    # Add foreign key constraints for UUID columns
    op.create_foreign_key('fk_users_created_by_uuid', 'users', 'users', 
                         ['created_by_uuid'], ['uuid'])
    op.create_foreign_key('fk_users_updated_by_uuid', 'users', 'users', 
                         ['updated_by_uuid'], ['uuid'])
    
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.create_index(f'ix_{table}_created_by_uuid', table, ['created_by_uuid'])
        op.create_index(f'ix_{table}_updated_by_uuid', table, ['updated_by_uuid'])
        op.create_foreign_key(f'fk_{table}_created_by_uuid', table, 'users', 
                             ['created_by_uuid'], ['uuid'])
        op.create_foreign_key(f'fk_{table}_updated_by_uuid', table, 'users', 
                             ['updated_by_uuid'], ['uuid'])
    
    # Add foreign key for user_business
    op.create_index('ix_user_business_user_uuid', 'user_business', ['user_uuid'])
    op.create_foreign_key('fk_user_business_user_uuid', 'user_business', 'users', 
                         ['user_uuid'], ['uuid'])


def downgrade():
    # Drop foreign keys
    op.drop_constraint('fk_users_created_by_uuid', 'users', type_='foreignkey')
    op.drop_constraint('fk_users_updated_by_uuid', 'users', type_='foreignkey')
    
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.drop_constraint(f'fk_{table}_created_by_uuid', table, type_='foreignkey')
        op.drop_constraint(f'fk_{table}_updated_by_uuid', table, type_='foreignkey')
        op.drop_index(f'ix_{table}_created_by_uuid', table)
        op.drop_index(f'ix_{table}_updated_by_uuid', table)
    
    op.drop_constraint('fk_user_business_user_uuid', 'user_business', type_='foreignkey')
    op.drop_index('ix_user_business_user_uuid', 'user_business')
    
    # Drop indexes and constraint
    op.drop_index('ix_users_uuid', 'users')
    op.drop_index('ix_users_created_by_uuid', 'users')
    op.drop_index('ix_users_updated_by_uuid', 'users')
    op.drop_constraint('uq_users_uuid', 'users', type_='unique')
