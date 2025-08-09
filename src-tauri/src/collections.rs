// collections.rs: Collections & Albums CRUD for Pictallion backend (Rust/Tauri)
//
// Implements async CRUD operations for collections and albums.
// All logic matches the SQLite schema and is designed for IPC integration.
// Comments explain "why" logic exists per project guidelines.

use crate::db::Db;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub cover_photo: Option<String>,
    pub is_smart_collection: bool,
    pub smart_rules: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlbumPhoto {
    pub id: String,
    pub collection_id: String,
    pub photo_id: String,
    pub added_at: String,
}

// CRUD for collections
impl Collection {
    // List all collections
    pub async fn list(db: &Db) -> Result<Vec<Collection>> {
        let rows = sqlx::query!(
            r#"
            SELECT id, name, description, is_public, cover_photo, is_smart_collection, smart_rules, created_at, updated_at
            FROM collections
            ORDER BY created_at DESC
            "#
        )
        .fetch_all(&db.0)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| Collection {
                id: row.id,
                name: row.name,
                description: row.description,
                is_public: row.is_public != 0,
                cover_photo: row.cover_photo,
                is_smart_collection: row.is_smart_collection != 0,
                smart_rules: row.smart_rules,
                created_at: row.created_at,
                updated_at: row.updated_at,
            })
            .collect())
    }

    // Get a single collection by ID
    pub async fn get(db: &Db, id: &str) -> Result<Option<Collection>> {
        let row = sqlx::query!(
            r#"
            SELECT id, name, description, is_public, cover_photo, is_smart_collection, smart_rules, created_at, updated_at
            FROM collections
            WHERE id = ?
            "#,
            id
        )
        .fetch_optional(&db.0)
        .await?;

        Ok(row.map(|row| Collection {
            id: row.id,
            name: row.name,
            description: row.description,
            is_public: row.is_public != 0,
            cover_photo: row.cover_photo,
            is_smart_collection: row.is_smart_collection != 0,
            smart_rules: row.smart_rules,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }))
    }

    // Create a new collection
    pub async fn create(
        db: &Db,
        name: &str,
        description: Option<&str>,
        is_public: bool,
        cover_photo: Option<&str>,
        is_smart_collection: bool,
        smart_rules: Option<&str>,
    ) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query!(
            r#"
            INSERT INTO collections (id, name, description, is_public, cover_photo, is_smart_collection, smart_rules, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            "#,
            id,
            name,
            description,
            is_public as i64,
            cover_photo,
            is_smart_collection as i64,
            smart_rules
        )
        .execute(&db.0)
        .await?;
        Ok(id)
    }

    // Update a collection
    pub async fn update(
        db: &Db,
        id: &str,
        name: Option<&str>,
        description: Option<&str>,
        is_public: Option<bool>,
        cover_photo: Option<&str>,
        smart_rules: Option<&str>,
    ) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE collections
            SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                is_public = COALESCE(?, is_public),
                cover_photo = COALESCE(?, cover_photo),
                smart_rules = COALESCE(?, smart_rules),
                updated_at = datetime('now')
            WHERE id = ?
            "#,
            name,
            description,
            is_public.map(|v| v as i64),
            cover_photo,
            smart_rules,
            id
        )
        .execute(&db.0)
        .await?;
        Ok(())
    }

    // Delete a collection
    pub async fn delete(db: &Db, id: &str) -> Result<()> {
        sqlx::query!("DELETE FROM collections WHERE id = ?", id)
            .execute(&db.0)
            .await?;
        Ok(())
    }
}

// CRUD for album photos
impl AlbumPhoto {
    // List photos in a collection/album
    pub async fn list(db: &Db, collection_id: &str) -> Result<Vec<AlbumPhoto>> {
        let rows = sqlx::query!(
            r#"
            SELECT id, collection_id, photo_id, added_at
            FROM collection_photos
            WHERE collection_id = ?
            ORDER BY added_at DESC
            "#,
            collection_id
        )
        .fetch_all(&db.0)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| AlbumPhoto {
                id: row.id,
                collection_id: row.collection_id,
                photo_id: row.photo_id,
                added_at: row.added_at,
            })
            .collect())
    }

    // Add photo(s) to a collection/album
    pub async fn add(db: &Db, collection_id: &str, photo_id: &str) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query!(
            r#"
            INSERT INTO collection_photos (id, collection_id, photo_id, added_at)
            VALUES (?, ?, ?, datetime('now'))
            "#,
            id,
            collection_id,
            photo_id
        )
        .execute(&db.0)
        .await?;
        Ok(id)
    }

    // Remove photo(s) from a collection/album
    pub async fn remove(db: &Db, collection_id: &str, photo_id: &str) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM collection_photos
            WHERE collection_id = ? AND photo_id = ?
            "#,
            collection_id,
            photo_id
        )
        .execute(&db.0)
        .await?;
        Ok(())
    }
}