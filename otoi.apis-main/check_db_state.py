import psycopg2
from sqlalchemy import create_engine, text

# Database connection
engine = create_engine('postgresql://user:password@localhost/evoto_crm')
conn = engine.connect()

# Check payment_ins table
print('Checking payment_ins table...')
result = conn.execute(text("""
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'payment_ins' AND column_name = 'is_deleted'
"""))
print(f'payment_ins.is_deleted column: {result.fetchone()}')

# Check payment_outs table  
print('Checking payment_outs table...')
result = conn.execute(text("""
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'payment_outs' AND column_name = 'is_deleted'
"""))
print(f'payment_outs.is_deleted column: {result.fetchone()}')

conn.close()
