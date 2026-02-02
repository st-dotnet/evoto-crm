"""Merge heads after removing person_types/shipping

Revision ID: 7a101c356b7d
Revises: 5a661308d049, 6daa1d1dd9b9, 84023d37756f
Create Date: 2026-01-15 19:00:50.921502
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7a101c356b7d'
down_revision = ('5a661308d049', '6daa1d1dd9b9', '84023d37756f')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
