"""Convert items.id to UUID

Revision ID: c97039c0526a
Revises: 191c574fb82a
Create Date: 2026-01-21 16:12:34.531750

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c97039c0526a'
down_revision = '191c574fb82a'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    # 2. Add temporary UUID column
    op.add_column(
        "items",
        sa.Column("uuid", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 3. Backfill UUIDs
    op.execute("UPDATE items SET uuid = uuid_generate_v4();")

    # 4. Make UUID NOT NULL
    op.alter_column("items", "uuid", nullable=False)

    # 5. Drop old primary key
    op.drop_constraint("items_pkey", "items", type_="primary")

    # 6. Create new primary key on UUID
    op.create_primary_key("items_pkey", "items", ["uuid"])

    # 7. Rename columns
    op.alter_column("items", "id", new_column_name="old_id")
    op.alter_column("items", "uuid", new_column_name="uuid")

    # 8. Set default UUID generation
    op.execute(
        "ALTER TABLE items ALTER COLUMN id SET DEFAULT uuid_generate_v4();"
    )


def downgrade():
    # ⚠️ Downgrade is intentionally blocked
    raise RuntimeError(
        "Downgrade not supported for UUID primary key migration"
    )
