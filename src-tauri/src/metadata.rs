// metadata.rs: Photo metadata management for Pictallion backend (Rust/Tauri)
//
// This module handles EXIF/XMP extraction, embedding, and metadata CRUD.
// Designed to match legacy FastAPI endpoints and metadata logic.

use anyhow::Result;
// Use rexiv2 for EXIF/XMP extraction and embedding
use rexiv2::Metadata;

pub struct MetadataManager;

impl MetadataManager {
    /// Extract EXIF/XMP metadata from file and return as JSON string.
    /// Uses rexiv2 for compatibility with legacy FastAPI endpoints.
    pub fn extract_metadata(file_path: &str) -> Result<String> {
        let meta = Metadata::new_from_path(file_path)
            .map_err(|e| anyhow::anyhow!("Failed to read metadata: {}", e))?;

        // Collect EXIF and XMP tags into a flat JSON object
        let mut map = serde_json::Map::new();

        for (key, value) in meta.get_exif_tags().iter().map(|k| (k, meta.get_tag_string(k))) {
            if let Ok(val) = value {
                map.insert(key.clone(), serde_json::Value::String(val));
            }
        }
        for (key, value) in meta.get_xmp_tags().iter().map(|k| (k, meta.get_tag_string(k))) {
            if let Ok(val) = value {
                map.insert(key.clone(), serde_json::Value::String(val));
            }
        }

        Ok(serde_json::Value::Object(map).to_string())
    }

    /// Embed metadata (JSON string) into file using rexiv2.
    /// Accepts a flat JSON object of EXIF/XMP tags for compatibility.
    pub fn embed_metadata(file_path: &str, metadata: &str) -> Result<()> {
        let mut meta = Metadata::new_from_path(file_path)
            .map_err(|e| anyhow::anyhow!("Failed to read metadata: {}", e))?;

        let tags: serde_json::Value = serde_json::from_str(metadata)
            .map_err(|e| anyhow::anyhow!("Invalid metadata JSON: {}", e))?;

        let obj = tags.as_object().ok_or_else(|| anyhow::anyhow!("Metadata must be a JSON object"))?;

        for (key, value) in obj.iter() {
            if let Some(val) = value.as_str() {
                // Try EXIF first, then XMP
                if meta.has_exif_tag(key) {
                    meta.set_tag_string(key, val)
                        .map_err(|e| anyhow::anyhow!("Failed to set EXIF tag {}: {}", key, e))?;
                } else {
                    meta.set_tag_string(key, val)
                        .map_err(|e| anyhow::anyhow!("Failed to set XMP tag {}: {}", key, e))?;
                }
            }
        }

        meta.save_to_file(file_path)
            .map_err(|e| anyhow::anyhow!("Failed to save metadata: {}", e))?;
        Ok(())
    }

    // Add more metadata management methods as needed
// Unit tests for metadata.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_metadata_invalid_path() {
        let result = MetadataManager::extract_metadata("nonexistent.jpg");
        assert!(result.is_err());
    }

    #[test]
    fn test_embed_metadata_invalid_json() {
        let result = MetadataManager::embed_metadata("nonexistent.jpg", "not_json");
        assert!(result.is_err());
    }

    #[test]
    fn test_embed_metadata_invalid_path() {
        let meta = r#"{"Artist":"Test"}"#;
        let result = MetadataManager::embed_metadata("nonexistent.jpg", meta);
        assert!(result.is_err());
    }
}
}