"""Merge migration heads

Revision ID: acb78ba88f17
Revises: 36197e3a9a22, 78378e556695
Create Date: 2026-01-15 21:37:20.713015

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'acb78ba88f17'
down_revision = ('36197e3a9a22', '78378e556695')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
