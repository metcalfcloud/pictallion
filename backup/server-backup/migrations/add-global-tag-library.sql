
-- Add global tag library table for storing curated tags from Gold tier photos
CREATE TABLE IF NOT EXISTS global_tag_library (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE,
  usage_count INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_global_tag_library_usage ON global_tag_library(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_global_tag_library_tag ON global_tag_library(tag);
