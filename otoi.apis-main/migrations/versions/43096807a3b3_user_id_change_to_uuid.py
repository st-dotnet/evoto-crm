"""user id change to uuid

Revision ID: 43096807a3b3
Revises: 8b878d6528a6
Create Date: 2026-01-20 22:21:17.082682

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '43096807a3b3'
down_revision = '8b878d6528a6'
branch_labels = None
depends_on = None



def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
    """)

    op.execute("""
        UPDATE users
        SET id = uuid_generate_v4()
        WHERE id IS NULL;
    """)

    op.execute("""
        ALTER TABLE users
        ALTER COLUMN id SET NOT NULL;
    """)

    # ✅ FIXED PART
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey'
        ) THEN
            ALTER TABLE users
            ADD CONSTRAINT users_pkey PRIMARY KEY (id);
        END IF;
    END
    $$;
    """)

    op.execute("""
        ALTER TABLE user_business
        DROP CONSTRAINT IF EXISTS user_business_user_id_fkey;
    """)

    op.execute("""
        ALTER TABLE user_business
        ADD CONSTRAINT user_business_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id);
    """)



def downgrade():
    raise Exception("Downgrade not supported for UUID primary key migration")