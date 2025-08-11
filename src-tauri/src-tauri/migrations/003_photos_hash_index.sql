-- Ensure no duplicate content by hash when present
CREATE UNIQUE INDEX IF NOT EXISTS ux_photos_hash ON photos(hash) WHERE hash IS NOT NULL;

