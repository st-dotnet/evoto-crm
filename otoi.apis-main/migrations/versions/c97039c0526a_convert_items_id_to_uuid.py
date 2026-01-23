"""Convert items.id to UUID

Revision ID: c97039c0526a
Revises: 191c574fb82a
Create Date: 2026-01-21 16:12:34.531750

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c97039c0526a'
down_revision = '191c574fb82a'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    # 2. Check if UUID column exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('items')]
    
    if 'uuid' not in columns:
        # 3. Add UUID column if it doesn't exist
        op.add_column(
            "items",
            sa.Column("uuid", postgresql.UUID(as_uuid=True), nullable=True),
        )

        # 4. Backfill UUIDs
        op.execute("UPDATE items SET uuid = uuid_generate_v4();")

    # 5. Make UUID NOT NULL if it's not already
    op.alter_column("items", "uuid", nullable=False)

    # 6. Drop old primary key
    op.drop_constraint("items_pkey", "items", type_="primary")

    # 7. Create new primary key on UUID
    op.create_primary_key("items_pkey", "items", ["uuid"])

    # 8. Rename columns if needed
    op.alter_column("items", "id", new_column_name="old_id")
    
    # 9. Set default UUID generation
    op.execute(
        "ALTER TABLE items ALTER COLUMN uuid SET DEFAULT uuid_generate_v4();"
    )


def downgrade():
    # ⚠️ Downgrade is intentionally blocked
    raise RuntimeError(
        "Downgrade not supported for UUID primary key migration"
    )
