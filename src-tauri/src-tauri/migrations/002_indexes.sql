-- Performance indexes for common queries and joins

CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_updated_at ON photos(updated_at);

CREATE INDEX IF NOT EXISTS idx_photo_tags_tag ON photo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_photo_tags_photo ON photo_tags(photo_id);

CREATE INDEX IF NOT EXISTS idx_album_photos_album ON album_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_photo ON album_photos(photo_id);

CREATE INDEX IF NOT EXISTS idx_relationships_a ON relationships(person_a);
CREATE INDEX IF NOT EXISTS idx_relationships_b ON relationships(person_b);

