-- Soft delete support
ALTER TABLE photos ADD COLUMN deleted_at INTEGER;

