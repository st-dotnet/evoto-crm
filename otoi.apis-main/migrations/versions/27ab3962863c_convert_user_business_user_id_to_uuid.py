"""Convert user_id in user_business to UUID

Revision ID: 27ab3962863c
Revises: a660f550908d
Create Date: 2026-01-22 23:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision = '27ab3962863c'
down_revision = 'a660f550908d'
branch_labels = None
depends_on = None

def upgrade():
    # Add a new UUID column (nullable for now)
    op.add_column('user_business', 
                 sa.Column('user_uuid', postgresql.UUID(), 
                          nullable=True))
    
    # Get database connection
    conn = op.get_bind()
    
    try:
        # First, get all users with their UUIDs
        users = conn.execute(text("""
            SELECT uuid 
            FROM users
            ORDER BY created_at
        """)).fetchall()
        
        if not users:
            raise Exception("No users found in the database")
            
        # Get all distinct user_ids from user_business
        user_business_records = conn.execute(text("""
            SELECT DISTINCT user_id 
            FROM user_business 
            ORDER BY user_id
        """)).fetchall()
        
        # For each user_business record, assign a UUID based on the order
        for i, (user_id,) in enumerate(user_business_records, 1):
            if i <= len(users):
                conn.execute(
                    text("""
                        UPDATE user_business 
                        SET user_uuid = :uuid 
                        WHERE user_id = :user_id
                    """),
                    {"uuid": users[i-1][0], "user_id": user_id}
                )
        
        # Handle any remaining NULL values by assigning to first user
        conn.execute(
            text("""
                UPDATE user_business 
                SET user_uuid = :first_uuid
                WHERE user_uuid IS NULL
            """),
            {"first_uuid": users[0][0]}
        )
        
        # Now make the column non-nullable
        op.alter_column('user_business', 'user_uuid', nullable=False)
        
        # Drop the old column and constraints
        op.drop_constraint('user_business_pkey', 'user_business', type_='primary')
        
        # Check if the foreign key exists before trying to drop it
        result = conn.execute(text("""
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE table_name = 'user_business' 
            AND constraint_name = 'user_business_user_id_fkey'
        """)).fetchone()
        
        if result:
            op.drop_constraint('user_business_user_id_fkey', 'user_business', type_='foreignkey')
            
        op.drop_column('user_business', 'user_id')
        
        # Rename the new column
        op.alter_column('user_business', 'user_uuid', new_column_name='user_id')
        
        # Recreate the primary key
        op.create_primary_key('user_business_pkey', 'user_business', ['user_id', 'business_id'])
        
        # Recreate the foreign key
        op.create_foreign_key(
            'user_business_user_id_fkey', 
            'user_business', 
            'users',
            ['user_id'], 
            ['uuid'], 
            ondelete='CASCADE'
        )
        
    except Exception as e:
        print(f"Error during migration: {str(e)}")
        raise

def downgrade():
    # This is a complex migration to reverse, so the downgrade is left as an exercise
    # You might want to create a backup before running this migration
    pass