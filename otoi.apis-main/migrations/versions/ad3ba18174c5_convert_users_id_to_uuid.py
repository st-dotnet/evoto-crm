"""Convert users.id to UUID

Revision ID: ad3ba18174c5
Revises: 8f2fbc78f5f4
Create Date: 2024-01-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text
import uuid

# revision identifiers, used by Alembic.
revision = 'ad3ba18174c5'
down_revision = '8f2fbc78f5f4'
branch_labels = None
depends_on = None

def upgrade():
    # Enable UUID extension if not already enabled
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    # Get database connection
    conn = op.get_bind()
    
    # Check current state
    has_uuid_col = conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'uuid'
        )
    """)).scalar()
    
    if has_uuid_col:
        print("UUID migration already partially applied, checking state...")
        return  # Skip if already migrated
    
    # Add UUID columns if they don't exist
    op.add_column('users', sa.Column('uuid_new', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('users', sa.Column('created_by_uuid', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('users', sa.Column('updated_by_uuid', postgresql.UUID(as_uuid=True), nullable=True))
    
    # 1. First, drop all foreign key constraints that reference users.id
    fk_constraints = conn.execute(text("""
        SELECT conname, conrelid::regclass as table_name, pg_get_constraintdef(oid) as condef
        FROM pg_constraint 
        WHERE confrelid = 'users'::regclass
    """)).fetchall()
    
    for fk in fk_constraints:
        try:
            op.drop_constraint(fk[0], fk[1], type_='foreignkey')
        except Exception as e:
            print(f"Warning: Could not drop constraint {fk[0]}: {str(e)}")
    
    # 2. Generate UUIDs for all users
    users = conn.execute(text("SELECT id, created_by, updated_by FROM users")).fetchall()
    
    # Create a mapping of old ID to new UUID
    id_to_uuid = {}
    for user in users:
        user_id = user[0]
        id_to_uuid[user_id] = str(uuid.uuid4())
        
        # Update the user with the new UUID
        conn.execute(
            text("UPDATE users SET uuid_new = :uuid WHERE id = :id"),
            {"uuid": id_to_uuid[user_id], "id": user_id}
        )
    
    # 3. Update created_by_uuid and updated_by_uuid
    for user in users:
        user_id = user[0]
        created_by = user[1]
        updated_by = user[2]
        
        if created_by and created_by in id_to_uuid:
            conn.execute(
                text("UPDATE users SET created_by_uuid = :uuid WHERE id = :id"),
                {"uuid": id_to_uuid[created_by], "id": user_id}
            )
        
        if updated_by and updated_by in id_to_uuid:
            conn.execute(
                text("UPDATE users SET updated_by_uuid = :uuid WHERE id = :id"),
                {"uuid": id_to_uuid[updated_by], "id": user_id}
            )
    
    # 4. Make UUID columns NOT NULL
    op.alter_column('users', 'uuid_new', nullable=False)
    
    # 5. Drop existing primary key
    op.drop_constraint('users_pkey', 'users', type_='primary')
    
    # 6. Create new primary key with UUID
    op.create_primary_key('users_pkey', 'users', ['uuid_new'])
    
    # 7. Rename uuid_new to uuid
    op.alter_column('users', 'uuid_new', new_column_name='uuid')
    
    # 8. Update all foreign key references in other tables
    tables_to_update = [
        'items', 'item_images', 'addresses', 'leads', 'active', 
        'active_types', 'businesses', 'item_types', 'measuring_units', 
        'person_addresses', 'person_types', 'persons', 'status_list', 
        'user_business', 'vendors'
    ]
    
    for table in tables_to_update:
        if table != 'users':
            for col in ['created_by', 'updated_by']:
                # Check if column exists
                col_exists = conn.execute(text(f"""
                    SELECT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = '{table}' AND column_name = '{col}'
                    )
                """)).scalar()
                
                if not col_exists:
                    print(f"Skipping {table}.{col} - column doesn't exist")
                    continue
                    
                print(f"Processing {table}.{col}")
                
                # Add temporary column
                temp_col = f"{col}_uuid"
                try:
                    op.add_column(
                        table,
                        sa.Column(temp_col, postgresql.UUID(as_uuid=True), nullable=True)
                    )
                    
                    # Update the new column with UUIDs
                    for user_id, user_uuid in id_to_uuid.items():
                        conn.execute(
                            text(f"UPDATE {table} SET {temp_col} = :uuid WHERE {col} = :user_id"),
                            {"uuid": user_uuid, "user_id": user_id}
                        )
                    
                    # Drop old column and rename
                    op.drop_column(table, col)
                    op.alter_column(table, temp_col, new_column_name=col)
                    
                    # Add foreign key constraint
                    op.create_foreign_key(
                        f'fk_{table}_{col}_users',
                        table, 'users',
                        [col], ['uuid']
                    )
                except Exception as e:
                    print(f"Error processing {table}.{col}: {str(e)}")
                    # Try to clean up if something went wrong
                    try:
                        op.drop_column(table, temp_col)
                    except:
                        pass
    
    # 9. Recreate foreign key constraints for users table
    op.create_foreign_key(
        'users_created_by_fkey',
        'users', 'users',
        ['created_by_uuid'], ['uuid']
    )
    op.create_foreign_key(
        'users_updated_by_fkey',
        'users', 'users',
        ['updated_by_uuid'], ['uuid']
    )
    
    # 10. Drop old id column
    op.drop_column('users', 'id')
    op.drop_column('users', 'created_by')
    op.drop_column('users', 'updated_by')
    
    # 11. Rename uuid columns
    op.alter_column('users', 'created_by_uuid', new_column_name='created_by')
    op.alter_column('users', 'updated_by_uuid', new_column_name='updated_by')

def downgrade():
    # This is a complex migration to reverse; consider restoring from backup
    pass