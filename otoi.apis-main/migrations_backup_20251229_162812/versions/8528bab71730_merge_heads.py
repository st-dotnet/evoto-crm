"""merge heads

Revision ID: 8528bab71730
Revises: 625bb531c61b, fix_circular_dependency
Create Date: 2025-09-01 18:49:27.736305

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8528bab71730'
down_revision = ('625bb531c61b', 'fix_circular_dependency')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
