-- SQLite schema for Pictallion core entities
-- Photos, People, Faces, Embeddings, Tags, Albums, Relationships, Jobs

PRAGMA foreign_keys = ON;

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  original_path TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  tier          TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','archive')),
  hash          TEXT,
  mime_type     TEXT,
  width         INTEGER,
  height        INTEGER,
  exif_json     TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_tier ON photos(tier);
CREATE INDEX IF NOT EXISTS idx_photos_hash ON photos(hash);

-- People
CREATE TABLE IF NOT EXISTS people (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Faces detected in photos
CREATE TABLE IF NOT EXISTS faces (
  id          TEXT PRIMARY KEY,
  photo_id    TEXT NOT NULL,
  person_id   TEXT,
  x           REAL NOT NULL,
  y           REAL NOT NULL,
  w           REAL NOT NULL,
  h           REAL NOT NULL,
  confidence  REAL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_faces_photo ON faces(photo_id);
CREATE INDEX IF NOT EXISTS idx_faces_person ON faces(person_id);

-- Embeddings for faces (vector stored as blob or JSON)
CREATE TABLE IF NOT EXISTS embeddings (
  face_id     TEXT PRIMARY KEY,
  model       TEXT NOT NULL,
  vector      BLOB NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (face_id) REFERENCES faces(id) ON DELETE CASCADE
);

-- Tags and many-to-many mapping to photos
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id    TEXT NOT NULL,
  tag_id      TEXT NOT NULL,
  PRIMARY KEY (photo_id, tag_id),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Albums and mapping
CREATE TABLE IF NOT EXISTS albums (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS album_photos (
  album_id    TEXT NOT NULL,
  photo_id    TEXT NOT NULL,
  position    INTEGER,
  PRIMARY KEY (album_id, photo_id),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

-- Relationships between people (e.g., parent, spouse)
CREATE TABLE IF NOT EXISTS relationships (
  id          TEXT PRIMARY KEY,
  person_a    TEXT NOT NULL,
  person_b    TEXT NOT NULL,
  kind        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (person_a) REFERENCES people(id) ON DELETE CASCADE,
  FOREIGN KEY (person_b) REFERENCES people(id) ON DELETE CASCADE
);

-- Background jobs (AI enrichment, imports, etc.)
CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  payload     TEXT,
  error       TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  started_at  INTEGER,
  finished_at INTEGER
);

