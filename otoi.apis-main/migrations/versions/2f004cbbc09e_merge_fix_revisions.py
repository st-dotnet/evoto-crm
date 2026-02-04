"""merge fix revisions

Revision ID: 2f004cbbc09e
Revises: 4b65c45c91ab, f0e3fcaa1238
Create Date: 2026-02-03 20:22:28.610550

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2f004cbbc09e'
down_revision = ('4b65c45c91ab', 'f0e3fcaa1238')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
