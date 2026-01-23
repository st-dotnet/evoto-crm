"""merge multiple heads

Revision ID: 296b3f1ddc8a
Revises: 27acbca7415f, 3d443306a1b1, acb78ba88f17
Create Date: 2026-01-20 16:45:21.715531

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '296b3f1ddc8a'
down_revision = ('27acbca7415f', '3d443306a1b1', 'acb78ba88f17')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
