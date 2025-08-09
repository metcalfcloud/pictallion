/// people.rs: People & Relationships API logic for Pictallion backend (Rust/Tauri)
//
// This module provides CRUD, merging, statistics, and relationship management.
// Models match legacy FastAPI endpoints for agent protocol compatibility.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Person {
    pub id: String,
    pub name: String,
    pub birthdate: Option<String>,
    pub notes: Option<String>,
    pub is_public: bool,
    pub selected_thumbnail_face_id: Option<String>,
    pub face_count: u32,
    pub photo_count: u32,
    pub cover_photo: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Relationship {
    pub id: String,
    pub person1_id: String,
    pub person2_id: String,
    pub relationship_type: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePersonRequest {
    pub name: String,
    pub birthdate: Option<String>,
    pub notes: Option<String>,
    pub is_public: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePersonRequest {
    pub name: Option<String>,
    pub birthdate: Option<String>,
    pub notes: Option<String>,
    pub is_public: Option<bool>,
    pub selected_thumbnail_face_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MergePeopleRequest {
    pub source_person_id: String,
    pub target_person_id: String,
    pub keep_source_data: bool,
}

// TODO: Add CRUD, merge, statistics, bulk update, and relationship management functions.
// These should interact with SQLite and match agent protocol endpoints.
