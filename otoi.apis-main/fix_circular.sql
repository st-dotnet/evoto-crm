-- First, drop the existing foreign key constraint
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_address_id_fkey;

-- Make business_id nullable in addresses
ALTER TABLE addresses ALTER COLUMN business_id DROP NOT NULL;

-- Recreate the foreign key with DEFERRABLE
ALTER TABLE businesses 
ADD CONSTRAINT businesses_address_id_fkey 
FOREIGN KEY (address_id) 
REFERENCES addresses(uuid) 
ON DELETE SET NULL 
DEFERRABLE INITIALLY DEFERRED;
