"""Fix items id to UUID

Revision ID: 8f2fbc78f5f4
Revises: c97039c0526a
Create Date: 2026-01-21 16:43:29.033493

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '8f2fbc78f5f4'
down_revision = 'c97039c0526a'
branch_labels = None
depends_on = None


def constraint_exists(table_name, constraint_name, connection):
    # Use text() for raw SQL and proper parameter binding
    from sqlalchemy import text
    result = connection.execute(
        text("""
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_name = :table_name AND constraint_name = :constraint_name
        """),
        {"table_name": table_name, "constraint_name": constraint_name}
    )
    return result.scalar() is not None


def upgrade():
    # =================================================================
    # PHASE 1: Add new UUID columns alongside existing INTEGER columns
    # =================================================================
    
    print("Phase 1: Adding UUID columns...")
    
    # Get database connection
    conn = op.get_bind()
    
    # Add UUID column to items table if it doesn't exist
    op.add_column('items', sa.Column('uuid_new', postgresql.UUID(as_uuid=True), nullable=True))
    
    # Add UUID column to item_images if it doesn't exist
    op.add_column('item_images', sa.Column('item_uuid_new', postgresql.UUID(as_uuid=True), nullable=True))
    
    # =================================================================
    # PHASE 2: Generate UUIDs and populate the new columns
    # =================================================================
    
    print("Phase 2: Generating and populating UUIDs...")
    
    # Generate UUIDs for all existing items
    op.execute("""
        UPDATE items 
        SET uuid_new = gen_random_uuid() 
        WHERE uuid_new IS NULL
    """)
    
    # Map the INTEGER item_id to UUID in item_images
    op.execute("""
        UPDATE item_images img
        SET item_uuid_new = i.uuid_new
        FROM items i
        WHERE img.item_id = i.old_id
    """)
    
    # Make uuid_new NOT NULL in items table
    op.alter_column('items', 'uuid_new', nullable=False)
    
    # =================================================================
    # PHASE 3: Create indexes and unique constraints on UUID columns
    # =================================================================
    
    print("Phase 3: Creating indexes and constraints...")
    
    # Create unique constraint on items.uuid_new
    op.create_unique_constraint('uq_items_uuid_new', 'items', ['uuid_new'])
    
    # Create index for performance
    op.create_index('ix_items_uuid_new', 'items', ['uuid_new'])
    
    # =================================================================
    # PHASE 4: Drop old foreign key constraints
    # =================================================================
    
    print("Phase 4: Dropping old foreign key constraints...")
    
    # Only drop the constraint if it exists
    if constraint_exists('item_images', 'item_images_item_id_fkey', conn):
        op.drop_constraint('item_images_item_id_fkey', 'item_images', type_='foreignkey')
    else:
        print("Constraint 'item_images_item_id_fkey' does not exist, skipping...")
    
    # =================================================================
    # PHASE 5: Create new UUID foreign key constraints
    # =================================================================
    
    print("Phase 5: Creating new UUID foreign key constraints...")
    
    # Create FK from item_images.item_uuid_new to items.uuid_new
    op.create_foreign_key(
        'fk_item_images_item_uuid_new', 
        'item_images', 
        'items', 
        ['item_uuid_new'], 
        ['uuid_new'],
        ondelete='CASCADE'
    )
    
    # =================================================================
    # PHASE 6: Drop old INTEGER columns and PRIMARY KEY
    # =================================================================
    
    print("Phase 6: Dropping old INTEGER columns...")
    
    # Drop old INTEGER column from item_images first
    op.drop_column('item_images', 'item_id')
    
    # Drop PRIMARY KEY constraint on items.old_id
    op.drop_constraint('items_pkey', 'items', type_='primary')
    
    # Drop old INTEGER id column from items
    op.drop_column('items', 'old_id')
    
    # Drop old sequence if it exists
    op.execute('DROP SEQUENCE IF EXISTS items_id_seq CASCADE')
    
    # =================================================================
    # PHASE 7: Rename UUID columns to original names
    # =================================================================
    
    print("Phase 7: Renaming UUID columns to original names...")
    
    # Rename items.uuid_new to items.id
    op.alter_column('items', 'uuid_new', new_column_name='id')
    
    # Rename in item_images
    op.alter_column('item_images', 'item_uuid_new', new_column_name='item_id')
    
    # =================================================================
    # PHASE 8: Create new PRIMARY KEY on items.id (now UUID)
    # =================================================================
    
    print("Phase 8: Creating new PRIMARY KEY and finalizing...")
    
    # Create new primary key on items.id (now UUID)
    op.create_primary_key('items_pkey', 'items', ['id'])
    
    # Set default for new records
    op.alter_column('items', 'id', server_default=sa.text('gen_random_uuid()'))
    
    print("Migration completed successfully!")


def downgrade():
    """
    WARNING: This downgrade will lose the UUID values but preserve
    the relationships by creating new INTEGER IDs with a sequence.
    Original INTEGER IDs cannot be restored.
    """
    
    print("Starting downgrade: UUID -> INTEGER...")
    
    # =================================================================
    # PHASE 1: Add back INTEGER columns
    # =================================================================
    
    print("Phase 1: Adding INTEGER columns...")
    
    # Create new sequence
    op.execute('CREATE SEQUENCE items_id_seq')
    
    # Add INTEGER columns back
    op.add_column('items', sa.Column('id_int', sa.INTEGER(), nullable=True))
    op.add_column('item_images', sa.Column('item_id_int', sa.INTEGER(), nullable=True))
    
    # =================================================================
    # PHASE 2: Generate new INTEGER IDs and maintain relationships
    # =================================================================
    
    print("Phase 2: Generating new INTEGER IDs...")
    
    # Assign sequential INTEGER IDs to items (preserving order)
    op.execute("""
        WITH numbered_items AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as row_num
            FROM items
        )
        UPDATE items
        SET id_int = numbered_items.row_num
        FROM numbered_items
        WHERE items.id = numbered_items.id
    """)
    
    # Map UUIDs to new INTEGERs in item_images
    op.execute("""
        UPDATE item_images img
        SET item_id_int = i.id_int
        FROM items i
        WHERE img.item_id = i.id
    """)
    
    # Update sequence to continue from max id
    op.execute("""
        SELECT setval('items_id_seq', (SELECT MAX(id_int) FROM items))
    """)
    
    # =================================================================
    # PHASE 3: Drop UUID foreign keys
    # =================================================================
    
    print("Phase 3: Dropping UUID foreign keys...")
    
    if constraint_exists('item_images', 'fk_item_images_item_uuid_new', op.get_bind()):
        op.drop_constraint('fk_item_images_item_uuid_new', 'item_images', type_='foreignkey')
    else:
        print("Constraint 'fk_item_images_item_uuid_new' does not exist, skipping...")
    
    # =================================================================
    # PHASE 4: Drop UUID columns and constraints
    # =================================================================
    
    print("Phase 4: Dropping UUID columns...")
    
    if constraint_exists('items', 'items_pkey', op.get_bind()):
        op.drop_constraint('items_pkey', 'items', type_='primary')
    
    # Drop indexes and constraints if they exist
    inspector = sa.inspect(op.get_bind())
    indexes = inspector.get_indexes('items')
    if any(idx['name'] == 'ix_items_uuid_new' for idx in indexes):
        op.drop_index('ix_items_uuid_new', 'items')
    
    if constraint_exists('items', 'uq_items_uuid_new', op.get_bind()):
        op.drop_constraint('uq_items_uuid_new', 'items', type_='unique')
    
    # Rename columns back to original names if they were changed
    inspector = sa.inspect(op.get_bind())
    columns = [c['name'] for c in inspector.get_columns('items')]
    if 'id' in columns and 'uuid_new' not in columns:
        op.alter_column('items', 'id', new_column_name='uuid_new')
    
    # Drop UUID columns
    op.drop_column('items', 'uuid_new')
    op.drop_column('item_images', 'item_uuid_new')
    
    # =================================================================
    # PHASE 5: Rename INTEGER columns back
    # =================================================================
    
    print("Phase 5: Renaming INTEGER columns...")
    
    op.alter_column('items', 'id_int', new_column_name='id')
    op.alter_column('item_images', 'item_id_int', new_column_name='item_id')
    
    # =================================================================
    # PHASE 6: Recreate PRIMARY KEY and foreign keys with INTEGER
    # =================================================================
    
    print("Phase 6: Recreating PRIMARY KEY and foreign keys...")
    
    op.alter_column('items', 'id', nullable=False)
    op.create_primary_key('items_pkey', 'items', ['id'])
    op.alter_column('items', 'id', 
                   server_default=sa.text("nextval('items_id_seq'::regclass)"))
    
    # Recreate foreign key
    op.create_foreign_key(
        'item_images_item_id_fkey', 
        'item_images', 
        'items',
        ['item_id'], 
        ['id'], 
        ondelete='CASCADE'
    )
    
    print("Downgrade completed!")