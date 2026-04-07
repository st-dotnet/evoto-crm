-- Add is_deleted columns to payment tables
ALTER TABLE payment_ins ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE payment_outs ADD COLUMN is_deleted BOOLEAN DEFAULT false;

-- Update existing records
UPDATE payment_ins SET is_deleted = false WHERE is_deleted IS NULL;
UPDATE payment_outs SET is_deleted = false WHERE is_deleted IS NULL;
