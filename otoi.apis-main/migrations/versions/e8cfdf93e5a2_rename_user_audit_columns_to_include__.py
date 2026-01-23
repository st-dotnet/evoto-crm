"""Rename user audit columns to include _uuid suffix

Revision ID: e8cfdf93e5a2
Revises: ad3ba18174c5
Create Date: 2026-01-22 22:54:19.964352

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e8cfdf93e5a2'
down_revision = 'ad3ba18174c5'
branch_labels = None
depends_on = None


def upgrade():
    # Create new columns
    op.add_column('users', sa.Column('created_by_uuid', postgresql.UUID(), nullable=True))
    op.add_column('users', sa.Column('updated_by_uuid', postgresql.UUID(), nullable=True))
    
    # Copy data from old columns to new columns
    op.execute('''
        UPDATE users 
        SET created_by_uuid = created_by, 
            updated_by_uuid = updated_by
    ''')
    
    # Drop the old foreign key constraints
    op.drop_constraint('users_created_by_fkey', 'users', type_='foreignkey')
    op.drop_constraint('users_updated_by_fkey', 'users', type_='foreignkey')
    
    # Create new foreign key constraints
    op.create_foreign_key(
        'users_created_by_uuid_fkey',
        'users', 'users',
        ['created_by_uuid'], ['uuid']
    )
    op.create_foreign_key(
        'users_updated_by_uuid_fkey',
        'users', 'users',
        ['updated_by_uuid'], ['uuid']
    )
    
    # Drop the old columns
    op.drop_column('users', 'created_by')
    op.drop_column('users', 'updated_by')


def downgrade():
    # Add back the old columns
    op.add_column('users', sa.Column('created_by', postgresql.UUID(), nullable=True))
    op.add_column('users', sa.Column('updated_by', postgresql.UUID(), nullable=True))
    
    # Copy data back to old columns
    op.execute('''
        UPDATE users 
        SET created_by = created_by_uuid, 
            updated_by = updated_by_uuid
    ''')
    
    # Drop the new foreign key constraints
    op.drop_constraint('users_created_by_uuid_fkey', 'users', type_='foreignkey')
    op.drop_constraint('users_updated_by_uuid_fkey', 'users', type_='foreignkey')
    
    # Recreate the old foreign key constraints
    op.create_foreign_key(
        'users_created_by_fkey',
        'users', 'users',
        ['created_by'], ['uuid']
    )
    op.create_foreign_key(
        'users_updated_by_fkey',
        'users', 'users',
        ['updated_by'], ['uuid']
    )
    
    # Drop the new columns
    op.drop_column('users', 'created_by_uuid')
    op.drop_column('users', 'updated_by_uuid')