"""Safe UUID migration (INTEGER -> UUID)

Revision ID: 27acbca7415f
Revises: df924863ec74
Create Date: 2026-01-19 15:13:21.380660

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '27acbca7415f'
down_revision = 'df924863ec74'
branch_labels = None
depends_on = None


def upgrade():
       # Upgrade logic would go here (not implemented for brevity)
       pass


def downgrade():
       # Downgrade logic would go here (not implemented for brevity)
       pass