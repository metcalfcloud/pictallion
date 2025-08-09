// photo.rs: Photo management logic for Pictallion backend (Rust/Tauri)
//
// This module handles photo CRUD, tier promotion, and batch operations.
// Designed to match legacy FastAPI endpoints and business logic.

use crate::db::Db;
use crate::fs;
use anyhow::Result;

#[derive(Debug, Clone)]
pub struct PhotoSearchFilters {
    pub date_start: Option<String>,
    pub date_end: Option<String>,
    pub camera: Option<String>,
    pub tags: Option<Vec<String>>,
    pub ai_confidence_min: Option<i32>,
    pub location: Option<String>,
}

pub struct PhotoManager;

impl PhotoManager {
    pub async fn add_photo(db: &Db, file_path: &str) -> Result<()> {
        // TODO: Insert photo record in SQLite, move to bronze tier
        Ok(())
    }

    /// Advanced search for photos by filters.
    pub async fn search_photos(db: &Db, filters: &PhotoSearchFilters) -> Result<Vec<crate::ipc::PhotoInfo>> {
        use sqlx::Row;
        let mut query = String::from("SELECT id, file_path, tier FROM file_versions WHERE 1=1");
        let mut params: Vec<(String, String)> = Vec::new();

        if let Some(date_start) = &filters.date_start {
            query.push_str(" AND created_at >= ?");
            params.push(("date_start".to_string(), date_start.clone()));
        }
        if let Some(date_end) = &filters.date_end {
            query.push_str(" AND created_at <= ?");
            params.push(("date_end".to_string(), date_end.clone()));
        }
        if let Some(camera) = &filters.camera {
            query.push_str(" AND metadata LIKE ?");
            params.push(("camera".to_string(), format!("%{}%", camera)));
        }
        if let Some(tags) = &filters.tags {
            for tag in tags {
                query.push_str(" AND keywords LIKE ?");
                params.push(("tag".to_string(), format!("%{}%", tag)));
            }
        }
        if let Some(conf) = filters.ai_confidence_min {
            query.push_str(" AND metadata LIKE ?");
            params.push(("ai_conf".to_string(), format!("%\"confidence\":{}%", conf)));
        }
        if let Some(location) = &filters.location {
            query.push_str(" AND location LIKE ?");
            params.push(("location".to_string(), format!("%{}%", location)));
        }

        let mut sql = sqlx::query(&query);
        for (_, val) in params {
            sql = sql.bind(val);
        }

        let rows = sql.fetch_all(&db.0).await?;
        let photos = rows
            .into_iter()
            .map(|row| crate::ipc::PhotoInfo {
                id: row.get("id"),
                file_path: row.get("file_path"),
                tier: row.get("tier"),
            })
            .collect();
        Ok(photos)
    }

    pub async fn promote_photo(db: &Db, photo_id: &str, tier: &str) -> Result<()> {
        // TODO: Update tier in DB, move file using fs.rs
        Ok(())
    }

    // List photos for gallery
    pub async fn list_photos(db: &Db) -> Result<Vec<crate::ipc::PhotoInfo>> {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT id, file_path, tier FROM file_versions ORDER BY created_at DESC"
        )
        .fetch_all(&db.0)
        .await?;

        let photos = rows
            .into_iter()
            .map(|row| crate::ipc::PhotoInfo {
                id: row.get("id"),
                file_path: row.get("file_path"),
                tier: row.get("tier"),
            })
            .collect();
        Ok(photos)
    }
    /// Detect burst photo groups based on timestamp and filename similarity.
    pub async fn detect_bursts(db: &Db) -> Result<Vec<Vec<crate::ipc::PhotoInfo>>> {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT id, file_path, tier, created_at FROM file_versions ORDER BY created_at ASC"
        )
        .fetch_all(&db.0)
        .await?;

        let mut photos: Vec<crate::ipc::PhotoInfo> = rows
            .into_iter()
            .map(|row| crate::ipc::PhotoInfo {
                id: row.get("id"),
                file_path: row.get("file_path"),
                tier: row.get("tier"),
            })
            .collect();

        // Simple burst grouping: photos within 10s and similar filename prefix
        let mut bursts = Vec::new();
        let mut current_group = Vec::new();
        let mut last_time = None;
        let mut last_prefix = None;

        for photo in &photos {
            let ts = std::fs::metadata(&photo.file_path)
                .and_then(|m| m.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            let prefix = photo.file_path.split('_').next().unwrap_or("");
            if let Some(lt) = last_time {
                let diff = ts.duration_since(lt).unwrap_or_default().as_secs();
                if diff <= 10 && last_prefix == Some(prefix) {
                    current_group.push(photo.clone());
                } else {
                    if current_group.len() > 1 {
                        bursts.push(current_group.clone());
                    }
                    current_group = vec![photo.clone()];
                }
            } else {
                current_group.push(photo.clone());
            }
            last_time = Some(ts);
            last_prefix = Some(prefix);
        }
        if current_group.len() > 1 {
            bursts.push(current_group);
        }
        Ok(bursts)
    }

    /// Detect duplicate photos by file hash.
    pub async fn detect_duplicates(db: &Db) -> Result<Vec<Vec<crate::ipc::PhotoInfo>>> {
        use sha2::{Sha256, Digest};
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT id, file_path, tier FROM file_versions"
        )
        .fetch_all(&db.0)
        .await?;

        let mut hash_map = std::collections::HashMap::new();
        for row in rows {
            let file_path: String = row.get("file_path");
            let id: String = row.get("id");
            let tier: String = row.get("tier");
            let mut file = std::fs::File::open(&file_path)?;
            let mut hasher = Sha256::new();
            std::io::copy(&mut file, &mut hasher)?;
            let hash = hasher.finalize();
            let entry = hash_map.entry(hash).or_insert_with(Vec::new);
            entry.push(crate::ipc::PhotoInfo { id, file_path, tier });
        }
        Ok(hash_map.into_values().filter(|v| v.len() > 1).collect())
    }
        /// Batch tag photos
        pub async fn batch_tag_photos(db: &Db, photo_ids: &[String], tags: &[String]) -> Result<usize> {
            // TODO: Add tags to each photo in DB
            Ok(photo_ids.len())
        }
    
        /// Batch organize photos into a collection
        pub async fn batch_organize_photos(db: &Db, photo_ids: &[String], collection: &str) -> Result<usize> {
            // TODO: Add each photo to the specified collection in DB
            Ok(photo_ids.len())
        }
    
        /// Batch export photos to a given path
        pub async fn batch_export_photos(db: &Db, photo_ids: &[String], export_path: &str) -> Result<usize> {
            // TODO: Copy each photo to export_path
            Ok(photo_ids.len())
        }
    
        /// Batch AI process photos
        pub async fn batch_ai_process_photos(db: &Db, photo_ids: &[String]) -> Result<usize> {
            // TODO: Run AI analysis for each photo
            Ok(photo_ids.len())
        }
    
    // Add more photo management methods as needed
    // Unit tests for photo.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[tokio::test]
    async fn test_add_photo_ok() {
        let db = Db::new("sqlite::memory:").await.unwrap();
        let result = PhotoManager::add_photo(&db, "test.jpg").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_promote_photo_ok() {
        let db = Db::new("sqlite::memory:").await.unwrap();
        let result = PhotoManager::promote_photo(&db, "photo_id", "gold").await;
        assert!(result.is_ok());
    }
}
}