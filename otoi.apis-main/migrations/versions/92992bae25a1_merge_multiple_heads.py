"""merge multiple heads

Revision ID: 92992bae25a1
Revises: 296b3f1ddc8a, c17d8708afd2
Create Date: 2026-01-20 18:00:31.272178

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '92992bae25a1'
down_revision = ('296b3f1ddc8a', 'c17d8708afd2')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
