"""Drop old INTEGER id columns

Revision ID: f1c40ba4bc1c
Revises: 4eb664c6acfb
Create Date: 2026-01-20 18:57:02.849820

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1c40ba4bc1c'
down_revision = '4eb664c6acfb'
branch_labels = None
depends_on = None


def upgrade():

      # ---- DROP FK CONSTRAINTS THAT STILL DEPEND ON users.id ----

    # users self-referencing
    op.drop_constraint('users_created_by_fkey', 'users', type_='foreignkey')
    op.drop_constraint('users_updated_by_fkey', 'users', type_='foreignkey')

    # quotations
    op.drop_constraint('quotations_created_by_fkey', 'quotations', type_='foreignkey')
    op.drop_constraint('quotations_updated_by_fkey', 'quotations', type_='foreignkey')

    # quotation_items
    op.drop_constraint('quotation_items_created_by_fkey', 'quotation_items', type_='foreignkey')
    op.drop_constraint('quotation_items_updated_by_fkey', 'quotation_items', type_='foreignkey')

    # Drop old foreign key constraints first
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.drop_constraint(f'{table}_created_by_fkey', table, type_='foreignkey')
        op.drop_constraint(f'{table}_updated_by_fkey', table, type_='foreignkey')
    
    op.drop_constraint('user_business_user_id_fkey', 'user_business', type_='foreignkey')
    
    # Drop old INTEGER columns
    for table in tables_with_user_fks:
        op.drop_column(table, 'created_by')
        op.drop_column(table, 'updated_by')
    
    op.drop_column('user_business', 'user_id')
    op.drop_column('users', 'id')
    op.drop_column('users', 'created_by')
    op.drop_column('users', 'updated_by')
    
    # Drop the old sequence
    op.execute('DROP SEQUENCE IF EXISTS users_id_seq CASCADE')


def downgrade():
    # This would be complex - you'd need to recreate INTEGER columns
    # and reverse-map UUIDs back to INTEGERs
    # For safety, you might want to prevent downgrade
    raise Exception("Cannot downgrade from UUID to INTEGER - data loss would occur")
