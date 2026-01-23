"""merge all heads

Revision ID: 7d3712c58cbe
Revises: 3077b3d2a098, df924863ec74
Create Date: 2026-01-16 22:59:02.937789

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7d3712c58cbe'
down_revision = ('3077b3d2a098', 'df924863ec74', 'b93c00c0af55')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
