// db.rs: SQLite database access for Pictallion backend (Rust/Tauri)
//
// This module provides async database connection and CRUD utilities.
// All logic is designed to match legacy FastAPI endpoints and models.

use tauri::State;
use sqlx::{SqlitePool, sqlite::SqliteQueryResult};
use anyhow::Result;

pub struct Db(pub SqlitePool);

impl Db {
    pub async fn new(database_url: &str) -> Result<Self> {
        use sqlx::Row;
        use std::fs;

        let pool = SqlitePool::connect(database_url).await?;

        // Check if 'users' table exists (as migration marker)
        let table_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'")
            .fetch_one(&pool)
            .await?;

        if table_exists.0 == 0 {
            // Read migration SQL
            let migration_sql = fs::read_to_string("src-tauri/migrations/001_initial.sql")?;
            // Split and execute each statement
            for stmt in migration_sql.split(";") {
                let trimmed = stmt.trim();
                if !trimmed.is_empty() {
                    sqlx::query(trimmed).execute(&pool).await?;
                }
            }
        }

        Ok(Db(pool))
    }
    // Add CRUD methods here (matching FastAPI endpoints)
// Unit tests for db.rs
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    #[tokio::test]
    async fn test_db_new_valid_url() {
        let url = "sqlite::memory:";
        let db = Db::new(url).await;
        assert!(db.is_ok());
    }

    #[tokio::test]
    async fn test_db_new_invalid_url() {
        let url = "invalid_url";
        let db = Db::new(url).await;
        assert!(db.is_err());
    }
}
}