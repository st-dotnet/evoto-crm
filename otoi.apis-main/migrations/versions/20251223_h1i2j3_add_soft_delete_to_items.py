"""add soft delete to items

Revision ID: h1i2j3
Revises: g7h8i9
Create Date: 2025-12-23
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "h1i2j3"
down_revision = "ed2ef03bf966"
branch_labels = None
depends_on = None


def upgrade():
    # Add soft delete column
    op.add_column(
        "items",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false"))
    )

def downgrade():
    # Remove soft delete column
    op.drop_column("items", "is_deleted")
