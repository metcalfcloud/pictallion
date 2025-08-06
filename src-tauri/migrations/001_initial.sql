-- Initial SQLite schema migration for Pictallion backend (Rust/Tauri)
-- Adapted from legacy FastAPI/Postgres schema

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE media_assets (
    id TEXT PRIMARY KEY,
    original_filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE file_versions (
    id TEXT PRIMARY KEY,
    media_asset_id TEXT NOT NULL,
    tier TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    metadata TEXT, -- JSON as TEXT
    is_reviewed INTEGER DEFAULT 0,
    rating INTEGER DEFAULT 0,
    keywords TEXT, -- CSV as TEXT
    location TEXT,
    event_type TEXT,
    event_name TEXT,
    perceptual_hash TEXT,
    ai_short_description TEXT,
    processing_state TEXT DEFAULT 'processed',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (media_asset_id) REFERENCES media_assets(id)
);

CREATE TABLE asset_history (
    id TEXT PRIMARY KEY,
    media_asset_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (media_asset_id) REFERENCES media_assets(id)
);

CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_public INTEGER DEFAULT 0,
    cover_photo TEXT,
    is_smart_collection INTEGER DEFAULT 0,
    smart_rules TEXT, -- JSON as TEXT
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT,
    birthdate TEXT,
    face_count INTEGER DEFAULT 0,
    representative_face TEXT,
    selected_thumbnail_face_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_prompts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    provider TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    user_prompt TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    latitude TEXT NOT NULL,
    longitude TEXT NOT NULL,
    radius INTEGER DEFAULT 100,
    is_user_defined INTEGER DEFAULT 0,
    photo_count INTEGER DEFAULT 0,
    place_name TEXT,
    place_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE global_tag_library (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE collection_photos (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (collection_id) REFERENCES collections(id),
    FOREIGN KEY (photo_id) REFERENCES file_versions(id)
);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    is_recurring INTEGER DEFAULT 0,
    recurring_type TEXT,
    country TEXT,
    region TEXT,
    person_id TEXT,
    is_enabled INTEGER DEFAULT 1,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (person_id) REFERENCES people(id)
);

CREATE TABLE faces (
    id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    person_id TEXT,
    bounding_box TEXT NOT NULL, -- JSON as TEXT
    confidence INTEGER NOT NULL,
    embedding TEXT, -- JSON as TEXT
    ignored INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (person_id) REFERENCES people(id),
    FOREIGN KEY (photo_id) REFERENCES file_versions(id)
);

CREATE TABLE relationships (
    id TEXT PRIMARY KEY,
    person1_id TEXT NOT NULL,
    person2_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (person1_id) REFERENCES people(id),
    FOREIGN KEY (person2_id) REFERENCES people(id)
);