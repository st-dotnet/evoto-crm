"""Add isActive column to users table

Revision ID: a660f550908d
Revises: e8cfdf93e5a2
Create Date: 2026-01-22 23:02:04.469447

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a660f550908d'
down_revision = 'e8cfdf93e5a2'
branch_labels = None
depends_on = None


def upgrade():
    # Add isActive column with default value True
    op.add_column('users', 
                 sa.Column('isActive', sa.Boolean(), 
                          server_default=sa.true(),
                          nullable=False))


def downgrade():
    # Drop the isActive column
    op.drop_column('users', 'isActive')