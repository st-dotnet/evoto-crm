"""Populate UUID columns with generated UUIDs

Revision ID: c863d5ff8724
Revises: 92992bae25a1
Create Date: 2026-01-20 18:09:32.534390

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c863d5ff8724'
down_revision = '92992bae25a1'
branch_labels = None
depends_on = None


def upgrade():
    # Generate UUIDs for all existing users
    op.execute("""
        UPDATE users 
        SET uuid = gen_random_uuid()
        WHERE uuid IS NULL
    """)
    
    # Create a mapping table for INTEGER id -> UUID
    # This is crucial for maintaining relationships
    op.execute("""
        UPDATE users u1
        SET created_by_uuid = u2.uuid
        FROM users u2
        WHERE u1.created_by = u2.id AND u1.created_by IS NOT NULL
    """)
    
    op.execute("""
        UPDATE users u1
        SET updated_by_uuid = u2.uuid
        FROM users u2
        WHERE u1.updated_by = u2.id AND u1.updated_by IS NOT NULL
    """)
    
    # Populate UUID foreign keys in all other tables
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        # Map created_by INTEGER to created_by_uuid
        op.execute(f"""
            UPDATE {table} t
            SET created_by_uuid = u.uuid
            FROM users u
            WHERE t.created_by = u.id AND t.created_by IS NOT NULL
        """)
        
        # Map updated_by INTEGER to updated_by_uuid
        op.execute(f"""
            UPDATE {table} t
            SET updated_by_uuid = u.uuid
            FROM users u
            WHERE t.updated_by = u.id AND t.updated_by IS NOT NULL
        """)
    
    # Populate user_business
    op.execute("""
        UPDATE user_business ub
        SET user_uuid = u.uuid
        FROM users u
        WHERE ub.user_id = u.id
    """)
    
    # Make UUID columns NOT NULL where appropriate
    op.alter_column('users', 'uuid', nullable=False)
    op.alter_column('user_business', 'user_uuid', nullable=False)


def downgrade():
    # Allow NULLs again
    op.alter_column('users', 'uuid', nullable=True)
    op.alter_column('user_business', 'user_uuid', nullable=True)
    
    # Clear UUID data
    op.execute("UPDATE users SET uuid = NULL, created_by_uuid = NULL, updated_by_uuid = NULL")
    
    tables_with_user_fks = [
        'active', 'active_types', 'addresses', 'businesses',
        'item_categories', 'item_images', 'item_types', 'items',
        'lead_addresses', 'leads', 'measuring_units',
        'status_list', 'vendors'
    ]
    
    for table in tables_with_user_fks:
        op.execute(f"UPDATE {table} SET created_by_uuid = NULL, updated_by_uuid = NULL")
    
    op.execute("UPDATE user_business SET user_uuid = NULL")