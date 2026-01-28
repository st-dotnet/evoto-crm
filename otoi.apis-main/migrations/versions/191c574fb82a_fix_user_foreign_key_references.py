"""fix_user_foreign_key_references

Revision ID: 191c574fb82a
Revises: 43096807a3b3
Create Date: 2026-01-20 23:42:04.833495

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '191c574fb82a'
down_revision = '43096807a3b3'
branch_labels = None
depends_on = None


def upgrade():
    # Use raw SQL for more control over the migration process
    conn = op.get_bind()
    
    # STEP 1: Drop all foreign key constraints that reference users.id
    # Using CASCADE where needed
    
    # Drop FK constraints from active table
    conn.execute(sa.text("ALTER TABLE active DROP CONSTRAINT IF EXISTS active_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE active DROP CONSTRAINT IF EXISTS active_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from active_types table
    conn.execute(sa.text("ALTER TABLE active_types DROP CONSTRAINT IF EXISTS active_types_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE active_types DROP CONSTRAINT IF EXISTS active_types_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from addresses table
    conn.execute(sa.text("ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from businesses table
    conn.execute(sa.text("ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from item_categories table
    conn.execute(sa.text("ALTER TABLE item_categories DROP CONSTRAINT IF EXISTS item_categories_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE item_categories DROP CONSTRAINT IF EXISTS item_categories_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from item_images table
    conn.execute(sa.text("ALTER TABLE item_images DROP CONSTRAINT IF EXISTS item_images_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE item_images DROP CONSTRAINT IF EXISTS item_images_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from item_types table
    conn.execute(sa.text("ALTER TABLE item_types DROP CONSTRAINT IF EXISTS item_types_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE item_types DROP CONSTRAINT IF EXISTS item_types_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from items table
    conn.execute(sa.text("ALTER TABLE items DROP CONSTRAINT IF EXISTS items_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE items DROP CONSTRAINT IF EXISTS items_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from lead_addresses table
    conn.execute(sa.text("ALTER TABLE lead_addresses DROP CONSTRAINT IF EXISTS lead_addresses_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE lead_addresses DROP CONSTRAINT IF EXISTS lead_addresses_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from leads table
    conn.execute(sa.text("ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from measuring_units table
    conn.execute(sa.text("ALTER TABLE measuring_units DROP CONSTRAINT IF EXISTS measuring_units_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE measuring_units DROP CONSTRAINT IF EXISTS measuring_units_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from status_list table
    conn.execute(sa.text("ALTER TABLE status_list DROP CONSTRAINT IF EXISTS status_list_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE status_list DROP CONSTRAINT IF EXISTS status_list_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from user_business table
    conn.execute(sa.text("ALTER TABLE user_business DROP CONSTRAINT IF EXISTS user_business_user_id_fkey CASCADE"))
    
    # Drop FK constraints from vendors table
    conn.execute(sa.text("ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_updated_by_fkey CASCADE"))
    
    # Drop FK constraints from users table itself (self-referencing)
    conn.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_created_by_uuid CASCADE"))
    conn.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_updated_by_uuid CASCADE"))
    conn.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_created_by_fkey CASCADE"))
    conn.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_updated_by_fkey CASCADE"))
    
    # Drop unique constraint and indexes from users table
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_updated_by_uuid CASCADE"))
    conn.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_uuid CASCADE"))
    
    # Drop other indexes
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_active_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_active_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_active_types_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_active_types_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_addresses_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_addresses_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_businesses_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_businesses_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_categories_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_categories_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_images_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_images_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_types_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_item_types_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_items_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_items_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_lead_addresses_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_lead_addresses_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_leads_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_leads_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_measuring_units_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_measuring_units_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_status_list_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_status_list_updated_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_user_business_user_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_vendors_created_by_uuid CASCADE"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_vendors_updated_by_uuid CASCADE"))
    
    # STEP 2: Rename users.id to users.uuid (the primary key)
    conn.execute(sa.text("ALTER TABLE users RENAME COLUMN id TO uuid"))
    
    # Rename created_by and updated_by columns in users table
    conn.execute(sa.text("ALTER TABLE users RENAME COLUMN created_by TO created_by_uuid"))
    conn.execute(sa.text("ALTER TABLE users RENAME COLUMN updated_by TO updated_by_uuid"))

    # STEP 3: Now create all the foreign key constraints referencing users.uuid
    conn.execute(sa.text("ALTER TABLE active ADD CONSTRAINT active_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE active ADD CONSTRAINT active_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE active_types ADD CONSTRAINT active_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE active_types ADD CONSTRAINT active_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE addresses ADD CONSTRAINT addresses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE addresses ADD CONSTRAINT addresses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE businesses ADD CONSTRAINT businesses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE businesses ADD CONSTRAINT businesses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE item_categories ADD CONSTRAINT item_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE item_categories ADD CONSTRAINT item_categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE item_images ADD CONSTRAINT item_images_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE item_images ADD CONSTRAINT item_images_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE item_types ADD CONSTRAINT item_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE item_types ADD CONSTRAINT item_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE items ADD CONSTRAINT items_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE items ADD CONSTRAINT items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE lead_addresses ADD CONSTRAINT lead_addresses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE lead_addresses ADD CONSTRAINT lead_addresses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE leads ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE leads ADD CONSTRAINT leads_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE measuring_units ADD CONSTRAINT measuring_units_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE measuring_units ADD CONSTRAINT measuring_units_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE status_list ADD CONSTRAINT status_list_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE status_list ADD CONSTRAINT status_list_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    conn.execute(sa.text("ALTER TABLE user_business ADD CONSTRAINT user_business_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uuid)"))
    
    conn.execute(sa.text("ALTER TABLE users ADD CONSTRAINT fk_users_created_by_uuid FOREIGN KEY (created_by_uuid) REFERENCES users(uuid)"))
    conn.execute(sa.text("ALTER TABLE users ADD CONSTRAINT fk_users_updated_by_uuid FOREIGN KEY (updated_by_uuid) REFERENCES users(uuid)"))
    
    conn.execute(sa.text("ALTER TABLE vendors ADD CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    conn.execute(sa.text("ALTER TABLE vendors ADD CONSTRAINT vendors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    # Handle quotation tables - convert INTEGER to UUID and add FK
    # First check if quotations and quotation_items tables exist and have these columns
    result = conn.execute(sa.text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'quotations' AND column_name IN ('created_by', 'updated_by')
    """))
    quotation_cols = result.fetchall()
    
    if quotation_cols:
        # Check if columns are INTEGER type
        for col in quotation_cols:
            if col[1] == 'integer':
                # Set columns to NULL first since we can't convert INT to UUID directly with existing data
                conn.execute(sa.text(f"UPDATE quotations SET {col[0]} = NULL"))
        
        # Alter column types
        conn.execute(sa.text("ALTER TABLE quotations ALTER COLUMN created_by TYPE UUID USING NULL"))
        conn.execute(sa.text("ALTER TABLE quotations ALTER COLUMN updated_by TYPE UUID USING NULL"))
        conn.execute(sa.text("ALTER TABLE quotations ADD CONSTRAINT quotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
        conn.execute(sa.text("ALTER TABLE quotations ADD CONSTRAINT quotations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))
    
    result = conn.execute(sa.text("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name IN ('created_by', 'updated_by')
    """))
    quotation_item_cols = result.fetchall()
    
    if quotation_item_cols:
        for col in quotation_item_cols:
            if col[1] == 'integer':
                conn.execute(sa.text(f"UPDATE quotation_items SET {col[0]} = NULL"))
        
        conn.execute(sa.text("ALTER TABLE quotation_items ALTER COLUMN created_by TYPE UUID USING NULL"))
        conn.execute(sa.text("ALTER TABLE quotation_items ALTER COLUMN updated_by TYPE UUID USING NULL"))
        conn.execute(sa.text("ALTER TABLE quotation_items ADD CONSTRAINT quotation_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(uuid) ON DELETE SET NULL"))
        conn.execute(sa.text("ALTER TABLE quotation_items ADD CONSTRAINT quotation_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(uuid) ON DELETE SET NULL"))


def downgrade():
    conn = op.get_bind()
    
    # Reverse the column renames
    conn.execute(sa.text("ALTER TABLE users RENAME COLUMN uuid TO id"))
    conn.execute(sa.text("ALTER TABLE users RENAME COLUMN created_by_uuid TO created_by"))
    conn.execute(sa.text("ALTER TABLE users RENAME COLUMN updated_by_uuid TO updated_by"))
    
    # Note: Full downgrade would require recreating all the old foreign keys
    # This is a simplified version
