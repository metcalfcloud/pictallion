// ipc.rs: IPC command definitions for Pictallion backend (Rust/Tauri)
//
// This module exposes Tauri commands matching legacy FastAPI endpoints.
// Use these for frontend-backend communication via invoke.

use tauri::command;

#[tauri::command]
pub async fn get_photo_metadata(file_path: String) -> Result<String, String> {
    // Extract metadata from file using MetadataManager
    match crate::metadata::MetadataManager::extract_metadata(&file_path) {
        Ok(json) => Ok(json),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn set_photo_metadata(file_path: String, metadata_json: String) -> Result<(), String> {
    // Embed metadata into file using MetadataManager
    match crate::metadata::MetadataManager::embed_metadata(&file_path, &metadata_json) {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
pub async fn promote_photo_tier(photo_id: String, tier: String) -> Result<String, String> {
    // TODO: Move photo to specified tier using fs.rs
    Ok(format!("Promoted photo {} to tier {}", photo_id, tier))
}

use crate::people::{Person, CreatePersonRequest, UpdatePersonRequest, MergePeopleRequest, Relationship};
use crate::photo::PhotoManager;
use chrono::Utc;

/// List all people (stub).
use crate::collections::{Collection, AlbumPhoto};
use crate::db::Db;
use uuid::Uuid;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[command]
pub async fn list_people() -> Result<Vec<Person>, String> {
    // TODO: Query SQLite for all people
    Ok(vec![]) // Placeholder
}

/// Create a new person (stub).
#[command]
pub async fn create_person(req: CreatePersonRequest) -> Result<Person, String> {
    // TODO: Insert person into SQLite
    Ok(Person {
        id: "new_id".to_string(),
        name: req.name,
        birthdate: req.birthdate,
        notes: req.notes,
        is_public: req.is_public,
        selected_thumbnail_face_id: None,
        face_count: 0,
        photo_count: 0,
        cover_photo: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    })
}

/// Update person info (stub).
#[command]
pub async fn update_person(person_id: String, req: UpdatePersonRequest) -> Result<Person, String> {
    // TODO: Update person in SQLite
    Ok(Person {
        id: person_id,
        name: req.name.unwrap_or_default(),
        birthdate: req.birthdate,
        notes: req.notes,
        is_public: req.is_public.unwrap_or(true),
        selected_thumbnail_face_id: req.selected_thumbnail_face_id,
        face_count: 0,
        photo_count: 0,
        cover_photo: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    })
}

/// Delete person (stub).
#[command]
pub async fn delete_person(person_id: String) -> Result<String, String> {
    // TODO: Delete person from SQLite
    Ok(format!("Deleted person {}", person_id))
}

/// Merge people (stub).
#[command]
pub async fn merge_people(req: MergePeopleRequest) -> Result<String, String> {
    // TODO: Merge logic in SQLite
    Ok(format!("Merged {} into {}", req.source_person_id, req.target_person_id))
}

/// List relationships (stub).
#[command]
pub async fn list_relationships(person_id: String) -> Result<Vec<Relationship>, String> {
    // TODO: Query relationships from SQLite
    Ok(vec![]) // Placeholder
}

// Photo agent protocol IPC commands

/// List all photos for gallery
#[command]
pub async fn list_photos() -> Result<Vec<PhotoInfo>, String> {
   use crate::db::Db;
   use crate::photo::PhotoManager;
   let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
   PhotoManager::list_photos(&db).await.map_err(|e| e.to_string())
}

/// Struct for frontend photo info
#[derive(serde::Serialize)]
pub struct PhotoInfo {
   pub id: String,
   pub file_path: String,
   pub tier: String,
}

#[derive(serde::Deserialize, Debug, Clone)]
pub struct PhotoSearchFilters {
    pub date_start: Option<String>,
    pub date_end: Option<String>,
    pub camera: Option<String>,
    pub tags: Option<Vec<String>>,
    pub ai_confidence_min: Option<i32>,
    pub location: Option<String>,
}

/// IPC: Advanced photo search
#[tauri::command]
pub async fn search_photos(filters: PhotoSearchFilters) -> Result<Vec<PhotoInfo>, String> {
    use crate::db::Db;
    use crate::photo::{PhotoManager, PhotoSearchFilters as ManagerFilters};
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    PhotoManager::search_photos(&db, &ManagerFilters {
        date_start: filters.date_start,
        date_end: filters.date_end,
        camera: filters.camera,
        tags: filters.tags,
        ai_confidence_min: filters.ai_confidence_min,
        location: filters.location,
    })
    .await
    .map_err(|e| e.to_string())
}

/// Add photo (stub).
#[command]
pub async fn add_photo(file_path: String) -> Result<String, String> {
    // TODO: Insert photo record, move to bronze tier
    PhotoManager::add_photo(&crate::db::Db::new("sqlite::memory:").await.unwrap(), &file_path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(format!("Added photo {}", file_path))
}

/// Promote photo tier (stub).
#[command]
pub async fn promote_photo(photo_id: String, tier: String) -> Result<String, String> {
    // TODO: Update tier, move file
    PhotoManager::promote_photo(&crate::db::Db::new("sqlite::memory:").await.unwrap(), &photo_id, &tier)
        .await
        .map_err(|e| e.to_string())?;
    Ok(format!("Promoted photo {} to tier {}", photo_id, tier))
}

use crate::face_detection::{FaceDetectionService, DetectedFace};

#[tauri::command]
pub async fn detect_faces(image_path: String) -> Result<Vec<DetectedFace>, String> {
    let service = FaceDetectionService::new();
    service.detect_faces(&image_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_face_embedding(image_path: String, bounding_box: (i32, i32, i32, i32)) -> Result<Option<Vec<f32>>, String> {
    let service = FaceDetectionService::new();
    Ok(service.generate_face_embedding(&image_path, bounding_box))
}

#[tauri::command]
pub async fn face_detection_health_check() -> Result<bool, String> {
    let service = FaceDetectionService::new();
    Ok(service.health_check())
}

/// Analytics data structure for frontend
#[derive(serde::Serialize)]
pub struct AnalyticsData {
    pub upload_trends: Vec<(String, usize)>,
    pub tier_distribution: Vec<(String, usize)>,
    pub ai_stats: Vec<(String, usize)>,
    pub storage_insights: Vec<(String, usize)>,
}

/// IPC: Get analytics for dashboard
#[tauri::command]
pub async fn get_analytics() -> Result<AnalyticsData, String> {
    // TODO: Query DB for real analytics
    Ok(AnalyticsData {
        upload_trends: vec![("2025-08-01".to_string(), 10), ("2025-08-02".to_string(), 15)],
        tier_distribution: vec![("Bronze".to_string(), 100), ("Silver".to_string(), 50), ("Gold".to_string(), 20)],
        ai_stats: vec![("AI Processed".to_string(), 120), ("Faces Detected".to_string(), 80)],
        storage_insights: vec![("Total Storage".to_string(), 1024)],
    })
}

/// Event detection result
#[derive(serde::Serialize)]
pub struct DetectedEvent {
    pub event_type: String,
    pub event_name: String,
    pub confidence: u8,
    pub person_id: Option<String>,
    pub person_name: Option<String>,
    pub age: Option<u8>,
}

/// IPC: Detect events for a given date
#[tauri::command]
pub async fn detect_events(photo_date: String) -> Result<Vec<DetectedEvent>, String> {
    // TODO: Implement real event detection logic
    let mut events = Vec::new();
    // Example: Birthday event
    events.push(DetectedEvent {
        event_type: "birthday".to_string(),
        event_name: "John Doe's Birthday".to_string(),
        confidence: 100,
        person_id: Some("person123".to_string()),
        person_name: Some("John Doe".to_string()),
        age: Some(30),
    });
    // Example: Holiday event
    events.push(DetectedEvent {
        event_type: "holiday".to_string(),
        event_name: "Independence Day".to_string(),
        confidence: 100,
        person_id: None,
        person_name: None,
        age: None,
    });
    Ok(events)
}

/// IPC: Detect burst photo groups
#[tauri::command]
pub async fn detect_bursts() -> Result<Vec<Vec<PhotoInfo>>, String> {
    use crate::db::Db;
    use crate::photo::PhotoManager;
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    PhotoManager::detect_bursts(&db).await.map_err(|e| e.to_string())
}

/// IPC: Detect duplicate photos
#[tauri::command]
pub async fn detect_duplicates() -> Result<Vec<Vec<PhotoInfo>>, String> {
    use crate::db::Db;
    use crate::photo::PhotoManager;
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    PhotoManager::detect_duplicates(&db).await.map_err(|e| e.to_string())
}
/// Batch tag photos
#[tauri::command]
pub async fn batch_tag_photos(photo_ids: Vec<String>, tags: Vec<String>) -> Result<usize, String> {
    use crate::photo::PhotoManager;
    let db = crate::db::Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    PhotoManager::batch_tag_photos(&db, &photo_ids, &tags)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn batch_organize_photos(photo_ids: Vec<String>, collection: String) -> Result<usize, String> {
    use crate::photo::PhotoManager;
    let db = crate::db::Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    PhotoManager::batch_organize_photos(&db, &photo_ids, &collection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn batch_export_photos(photo_ids: Vec<String>, export_path: String) -> Result<usize, String> {
    use crate::photo::PhotoManager;
    let db = crate::db::Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    PhotoManager::batch_export_photos(&db, &photo_ids, &export_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn batch_ai_process_photos(photo_ids: Vec<String>) -> Result<usize, String> {
    use crate::photo::PhotoManager;
    let db = crate::db::Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    PhotoManager::batch_ai_process_photos(&db, &photo_ids)
        .await
        .map_err(|e| e.to_string())
}

// Location clustering & mapping IPC endpoints
use crate::location::{ipc_cluster_locations, ipc_reverse_geocode, Coordinate, LocationCluster};

// Expose location clustering and reverse geocoding as Tauri commands
#[tauri::command]
pub async fn cluster_locations(coords: Vec<Coordinate>, grid_size: f64) -> Vec<LocationCluster> {
    ipc_cluster_locations(coords, grid_size).await
}

#[tauri::command]
pub async fn reverse_geocode(coord: Coordinate) -> Result<String, String> {
    ipc_reverse_geocode(coord).await
}

// IPC: List all collections
#[tauri::command]
pub async fn list_collections() -> Result<Vec<Collection>, String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    Collection::list(&db).await.map_err(|e| e.to_string())
}

// IPC: Get a collection by ID
#[tauri::command]
pub async fn get_collection(id: String) -> Result<Option<Collection>, String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    Collection::get(&db, &id).await.map_err(|e| e.to_string())
}

// IPC: Create a new collection
#[derive(Deserialize)]
pub struct CreateCollectionRequest {
    pub name: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub cover_photo: Option<String>,
    pub is_smart_collection: bool,
    pub smart_rules: Option<String>,
}

#[tauri::command]
pub async fn create_collection(req: CreateCollectionRequest) -> Result<String, String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    Collection::create(
        &db,
        &req.name,
        req.description.as_deref(),
        req.is_public,
        req.cover_photo.as_deref(),
        req.is_smart_collection,
        req.smart_rules.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

// IPC: Update a collection
#[derive(Deserialize)]
pub struct UpdateCollectionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_public: Option<bool>,
    pub cover_photo: Option<String>,
    pub smart_rules: Option<String>,
}

#[tauri::command]
pub async fn update_collection(id: String, req: UpdateCollectionRequest) -> Result<(), String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    Collection::update(
        &db,
        &id,
        req.name.as_deref(),
        req.description.as_deref(),
        req.is_public,
        req.cover_photo.as_deref(),
        req.smart_rules.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

// IPC: Delete a collection
#[tauri::command]
pub async fn delete_collection(id: String) -> Result<(), String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    Collection::delete(&db, &id).await.map_err(|e| e.to_string())
}

// IPC: List photos in an album/collection
#[tauri::command]
pub async fn list_album_photos(collection_id: String) -> Result<Vec<AlbumPhoto>, String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    AlbumPhoto::list(&db, &collection_id).await.map_err(|e| e.to_string())
}

// IPC: Add photo to album/collection
#[tauri::command]
pub async fn add_album_photo(collection_id: String, photo_id: String) -> Result<String, String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    AlbumPhoto::add(&db, &collection_id, &photo_id).await.map_err(|e| e.to_string())
}

// IPC: Remove photo from album/collection
#[tauri::command]
pub async fn remove_album_photo(collection_id: String, photo_id: String) -> Result<(), String> {
    let db = Db::new("sqlite::memory:").await.map_err(|e| e.to_string())?;
    AlbumPhoto::remove(&db, &collection_id, &photo_id).await.map_err(|e| e.to_string())
}