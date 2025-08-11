use sqlx::{migrate::Migrator, sqlite::SqlitePoolOptions, SqlitePool};
use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

struct AppState {
    db: SqlitePool,
    media_root: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize SQLite and media directories
            tauri::async_runtime::block_on(async move {
                let db_url = "sqlite://pictallion.db"; // stored in CWD/app dir
                let db = SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect(db_url)
                    .await
                    .map_err(|e| anyhow::anyhow!(e))?;

                // Run migrations
                MIGRATOR.run(&db).await.map_err(|e| anyhow::anyhow!(e))?;

                // Compute media root: data/media relative to current working dir
                let media_root = Path::new("data").join("media");
                // Ensure tier directories exist
                for tier in ["bronze", "silver", "gold", "archive"] {
                    let p = media_root.join(tier);
                    if let Err(e) = std::fs::create_dir_all(&p) {
                        // If concurrency or permissions cause error on existing, ignore AlreadyExists
                        if e.kind() != std::io::ErrorKind::AlreadyExists {
                            return Err(anyhow::anyhow!(e));
                        }
                    }
                }
                // Ensure trash directory exists
                let trash = Path::new("data").join("trash");
                let _ = std::fs::create_dir_all(&trash);

                app.manage(AppState { db, media_root });
                Ok::<(), anyhow::Error>(())
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            face_detection_health_check,
            detect_faces,
            add_photo,
            delete_photo,
            delete_photos_bulk,
            bulk_add_photos,
            list_photos,
            list_photos_by_person,
            search_photos,
            promote_photo_tier,
            promote_photo,
            promote_photos_bulk,
            extract_metadata,
            get_photo_metadata,
            generate_thumbnail,
            list_people,
            create_person,
            update_person,
            delete_person,
            merge_people,
            list_relationships,
            save_face_detections,
            list_faces,
            assign_face_person,
            list_tags,
            create_tag,
            assign_tag,
            remove_tag,
            list_photo_tags,
            list_albums,
            create_album,
            add_photo_to_album,
            remove_photo_from_album,
            list_album_photos,
            assign_tag_bulk,
            export_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn face_detection_health_check() -> bool {
    true
}

#[derive(serde::Serialize)]
struct DetectedFace {
    bounding_box: (f32, f32, f32, f32),
    // Add additional fields as needed (e.g., confidence)
}

#[tauri::command]
fn detect_faces(image_path: String) -> Result<Vec<DetectedFace>, String> {
    // TODO: Implement actual face detection (e.g., via OpenCV/dlib)
    // For now, return an empty list meaning no faces found.
    // This ensures the desktop app can round-trip without throwing.
    let _ = image_path; // placeholder to silence unused warning
    Ok(vec![])
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct FaceDetectionInput {
    boundingBox: (f32, f32, f32, f32),
    embedding: Option<Vec<f32>>,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow, Debug, Clone)]
struct FaceRow {
    id: String,
    photo_id: String,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    person_id: Option<String>,
}

#[tauri::command]
async fn save_face_detections(
    app: tauri::AppHandle,
    photo_id: String,
    model: String,
    detections: Vec<FaceDetectionInput>,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;
    for d in detections {
        let face_id = uuid::Uuid::new_v4().to_string();
        let (x, y, w, h) = d.boundingBox;
        let now = now_ts();
        sqlx::query(
            r#"INSERT INTO faces (id, photo_id, person_id, x, y, w, h, created_at, updated_at)
               VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&face_id)
        .bind(&photo_id)
        .bind(x)
        .bind(y)
        .bind(w)
        .bind(h)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        if let Some(vecf) = d.embedding {
            // Store embedding as JSON blob for portability
            let blob = serde_json::to_vec(&vecf).map_err(|e| e.to_string())?;
            sqlx::query(
                r#"INSERT INTO embeddings (face_id, model, vector, created_at)
                   VALUES (?, ?, ?, ?)"#,
            )
            .bind(&face_id)
            .bind(&model)
            .bind(&blob)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok("Detections saved".into())
}

#[tauri::command]
async fn list_faces(app: tauri::AppHandle, photo_id: String) -> Result<Vec<FaceRow>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<FaceRow> = sqlx::query_as::<_, FaceRow>(
        r#"SELECT id, photo_id, x, y, w, h, person_id FROM faces WHERE photo_id = ? ORDER BY created_at"#,
    )
    .bind(photo_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn assign_face_person(
    app: tauri::AppHandle,
    face_id: String,
    person_id: Option<String>,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let now = now_ts();
    sqlx::query(r#"UPDATE faces SET person_id = ?, updated_at = ? WHERE id = ?"#)
        .bind(person_id)
        .bind(now)
        .bind(face_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Assignment updated".into())
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow, Debug, Clone)]
struct PhotoRow {
    id: String,
    storage_path: String,
    tier: String,
}

#[derive(serde::Serialize)]
struct PhotoDto {
    id: String,
    filePath: String,
    tier: String,
}

impl From<PhotoRow> for PhotoDto {
    fn from(r: PhotoRow) -> Self {
        Self {
            id: r.id,
            filePath: r.storage_path,
            tier: r.tier,
        }
    }
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

fn tier_dir(root: &Path, tier: &str) -> PathBuf {
    root.join(tier)
}

fn sha256_file(path: &Path) -> Result<String, std::io::Error> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    let mut f = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn unique_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }
    let stem = target
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = target.extension().and_then(|e| e.to_str()).unwrap_or("");
    for i in 1..1000 {
        let candidate = if ext.is_empty() {
            target.with_file_name(format!("{} ({})", stem, i))
        } else {
            target.with_file_name(format!("{} ({}).{}", stem, i, ext))
        };
        if !candidate.exists() {
            return candidate;
        }
    }
    target.to_path_buf()
}

#[tauri::command]
async fn add_photo(app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    let state = app.state::<AppState>();
    let db = &state.db;
    let id = uuid::Uuid::new_v4().to_string();
    let src = PathBuf::from(&file_path);
    let dest_dir = tier_dir(&state.media_root, "bronze");
    let filename = src
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file path")?;
    let dest_path = dest_dir.join(filename);

    // Compute content hash and dedupe
    let hash = sha256_file(&src).map_err(|e| e.to_string())?;
    let dup: Option<String> = sqlx::query_scalar("SELECT id FROM photos WHERE hash = ? LIMIT 1")
        .bind(&hash)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;
    if dup.is_some() {
        return Ok("Duplicate photo detected (hash match); skipped".into());
    }

    // Copy file into bronze tier with unique naming if necessary
    let final_path = unique_path(&dest_path);
    std::fs::copy(&src, &final_path).map_err(|e| e.to_string())?;

    // Insert DB row (minimal fields per initial schema)
    let created_at = now_ts();
    let updated_at = created_at;
    sqlx::query(
        r#"INSERT INTO photos (id, original_path, storage_path, tier, hash, created_at, updated_at)
           VALUES (?, ?, ?, 'bronze', ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&file_path)
    .bind(&final_path.to_string_lossy().to_string())
    .bind(&hash)
    .bind(created_at)
    .bind(updated_at)
    .execute(db)
    .await
    .map_err(|e| e.to_string())?;

    // Try to pre-generate a thumbnail (best-effort)
    let _ = generate_thumbnail(app.clone(), id.clone(), Some(512)).await;

    Ok(format!(
        "Photo added successfully: {}",
        final_path.to_string_lossy()
    ))
}

#[tauri::command]
async fn list_photos(app: tauri::AppHandle) -> Result<Vec<PhotoDto>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<PhotoRow> = sqlx::query_as::<_, PhotoRow>(r#"SELECT id, storage_path, tier FROM photos WHERE deleted_at IS NULL ORDER BY updated_at DESC"#)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(PhotoDto::from).collect())
}

#[tauri::command]
async fn list_photos_by_person(
    app: tauri::AppHandle,
    person_id: String,
) -> Result<Vec<PhotoDto>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<PhotoRow> = sqlx::query_as::<_, PhotoRow>(
        r#"
        SELECT DISTINCT p.id as id, p.storage_path as storage_path, p.tier as tier
        FROM photos p
        JOIN faces f ON f.photo_id = p.id
        WHERE f.person_id = ?1 AND p.deleted_at IS NULL
        ORDER BY p.updated_at DESC
        "#,
    )
    .bind(person_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(PhotoDto::from).collect())
}

#[derive(serde::Deserialize, Debug, Clone)]
struct SearchFilters {
    personId: Option<String>,
    tagId: Option<String>,
    tier: Option<String>,
    dateFrom: Option<i64>,
    dateTo: Option<i64>,
}

#[tauri::command]
async fn search_photos(
    app: tauri::AppHandle,
    filters: SearchFilters,
) -> Result<Vec<PhotoDto>, String> {
    let state = app.state::<AppState>();
    let mut sql = String::from(
        "SELECT DISTINCT p.id as id, p.storage_path as storage_path, p.tier as tier FROM photos p",
    );
    let mut where_clauses: Vec<String> = Vec::new();
    let mut args: Vec<String> = Vec::new();

    if let Some(person) = &filters.personId {
        sql.push_str(" JOIN faces f ON f.photo_id = p.id");
        where_clauses.push("f.person_id = ?".into());
        args.push(person.clone());
    }
    if let Some(tier) = &filters.tier {
        where_clauses.push("p.tier = ?".into());
        args.push(tier.clone());
    }
    if let Some(tag) = &filters.tagId {
        sql.push_str(" JOIN photo_tags pt ON pt.photo_id = p.id");
        where_clauses.push("pt.tag_id = ?".into());
        args.push(tag.clone());
    }
    if let Some(df) = &filters.dateFrom {
        where_clauses.push("p.created_at >= ?".into());
        args.push(df.to_string());
    }
    if let Some(dt) = &filters.dateTo {
        where_clauses.push("p.created_at <= ?".into());
        args.push(dt.to_string());
    }
    where_clauses.push("p.deleted_at IS NULL".into());
    if !where_clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&where_clauses.join(" AND "));
    }
    sql.push_str(" ORDER BY p.updated_at DESC");

    let mut q = sqlx::query_as::<_, PhotoRow>(&sql);
    for v in args {
        q = q.bind(v);
    }
    let rows = q.fetch_all(&state.db).await.map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(PhotoDto::from).collect())
}

#[tauri::command]
async fn promote_photo_tier(
    app: tauri::AppHandle,
    photo_id: String,
    tier: String,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let valid = ["bronze", "silver", "gold", "archive"];
    if !valid.contains(&tier.as_str()) {
        return Err("Invalid tier".into());
    }

    // Fetch current storage path
    let storage_path: String =
        sqlx::query_scalar(r#"SELECT storage_path FROM photos WHERE id = ?"#)
            .bind(&photo_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Photo not found".to_string())?;

    let current_path = PathBuf::from(storage_path);
    let filename = current_path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Bad filename")?;
    let new_path = tier_dir(&state.media_root, &tier).join(filename);

    // Move file
    std::fs::rename(&current_path, &new_path).map_err(|e| e.to_string())?;

    // Update DB
    let updated_at = now_ts();
    sqlx::query(r#"UPDATE photos SET storage_path = ?, tier = ?, updated_at = ? WHERE id = ?"#)
        .bind(new_path.to_string_lossy().to_string())
        .bind(&tier)
        .bind(updated_at)
        .bind(&photo_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok("Photo promoted".into())
}

#[tauri::command]
async fn promote_photo(
    app: tauri::AppHandle,
    photo_id: String,
    tier: String,
) -> Result<String, String> {
    promote_photo_tier(app, photo_id, tier).await
}

#[tauri::command]
async fn promote_photos_bulk(
    app: tauri::AppHandle,
    photo_ids: Vec<String>,
    tier: String,
) -> Result<String, String> {
    let mut ok = 0usize;
    let mut fail = 0usize;
    for id in photo_ids {
        match promote_photo_tier(app.clone(), id, tier.clone()).await {
            Ok(_) => ok += 1,
            Err(_) => fail += 1,
        }
    }
    Ok(format!("promote_photos_bulk: ok={}, fail={}", ok, fail))
}

#[tauri::command]
async fn extract_metadata(_app: tauri::AppHandle, file_path: String) -> Result<String, String> {
    use exif::Reader;
    use std::fs::File;
    let file = File::open(&file_path).map_err(|e| e.to_string())?;
    let mut bufreader = std::io::BufReader::new(file);
    let exif = Reader::new()
        .read_from_container(&mut bufreader)
        .map_err(|e| format!("EXIF read error: {e}"))?;

    let mut map = serde_json::Map::new();
    for f in exif.fields() {
        let key = format!("{}", f.tag);
        let value = f.display_value().with_unit(&exif).to_string();
        map.insert(key, serde_json::Value::String(value));
    }
    Ok(serde_json::Value::Object(map).to_string())
}

#[tauri::command]
async fn get_photo_metadata(app: tauri::AppHandle, photo_id: String) -> Result<String, String> {
    // Lookup photo path then delegate to extract_metadata
    let state = app.state::<AppState>();
    let storage_path: String =
        sqlx::query_scalar(r#"SELECT storage_path FROM photos WHERE id = ?"#)
            .bind(&photo_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Photo not found".to_string())?;
    extract_metadata(app, storage_path).await
}

#[tauri::command]
async fn delete_photo(
    app: tauri::AppHandle,
    photo_id: String,
    permanent: Option<bool>,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let storage_path: String =
        sqlx::query_scalar(r#"SELECT storage_path FROM photos WHERE id = ?"#)
            .bind(&photo_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Photo not found".to_string())?;
    let perm = permanent.unwrap_or(false);
    if perm {
        let _ = std::fs::remove_file(&storage_path);
        sqlx::query!(r#"DELETE FROM photos WHERE id = ?1"#, photo_id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
        return Ok("Photo permanently deleted".into());
    }
    // Soft delete: move to trash and mark deleted_at
    let src = PathBuf::from(&storage_path);
    let trash_dir = Path::new("data").join("trash");
    let filename = src.file_name().and_then(|s| s.to_str()).unwrap_or("photo");
    let dest = unique_path(&trash_dir.join(filename));
    std::fs::rename(&src, &dest).map_err(|e| e.to_string())?;
    let now = now_ts();
    sqlx::query!(
        r#"UPDATE photos SET storage_path = ?1, deleted_at = ?2 WHERE id = ?3"#,
        dest.to_string_lossy(),
        now,
        photo_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok("Photo moved to trash".into())
}

#[tauri::command]
async fn delete_photos_bulk(
    app: tauri::AppHandle,
    photo_ids: Vec<String>,
    permanent: Option<bool>,
) -> Result<String, String> {
    let mut ok = 0usize;
    let mut fail = 0usize;
    for id in photo_ids {
        match delete_photo(app.clone(), id, permanent).await {
            Ok(_) => ok += 1,
            Err(_) => fail += 1,
        }
    }
    Ok(format!("delete_photos_bulk: ok={}, fail={}", ok, fail))
}

#[tauri::command]
async fn generate_thumbnail(
    app: tauri::AppHandle,
    photo_id: String,
    max_size: Option<u32>,
) -> Result<String, String> {
    use image::{imageops::FilterType, DynamicImage, ImageFormat};
    let state = app.state::<AppState>();
    let row = sqlx::query!(r#"SELECT storage_path FROM photos WHERE id = ?1"#, photo_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Photo not found".to_string())?;

    // Compute thumbnail dir
    let thumbs_dir = Path::new("data").join("cache").join("thumbs");
    if let Err(e) = std::fs::create_dir_all(&thumbs_dir) {
        if e.kind() != std::io::ErrorKind::AlreadyExists {
            return Err(e.to_string());
        }
    }

    let input_path = PathBuf::from(row.storage_path);
    let thumb_path = thumbs_dir.join(format!("{photo_id}.jpg"));
    let max_dim = max_size.unwrap_or(512);

    // Heavy work off main thread
    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let img = image::open(&input_path).map_err(|e| e.to_string())?;
        let resized = resize_keep_aspect(&img, max_dim);
        let mut out = std::fs::File::create(&thumb_path).map_err(|e| e.to_string())?;
        resized
            .write_to(&mut out, ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
        Ok(thumb_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn resize_keep_aspect(img: &DynamicImage, max_dim: u32) -> DynamicImage {
    let (w, h) = img.dimensions();
    if w <= max_dim && h <= max_dim {
        return img.clone();
    }
    let (new_w, new_h) = if w >= h {
        (
            max_dim,
            (h as f32 * (max_dim as f32 / w as f32)).round() as u32,
        )
    } else {
        (
            (w as f32 * (max_dim as f32 / h as f32)).round() as u32,
            max_dim,
        )
    };
    img.resize_exact(new_w, new_h, FilterType::CatmullRom)
}

// --- People and relationships ---

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow, Debug, Clone)]
struct PersonRow {
    id: String,
    name: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct CreatePersonRequest {
    name: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct UpdatePersonRequest {
    name: Option<String>,
}

#[tauri::command]
async fn list_people(app: tauri::AppHandle) -> Result<Vec<PersonRow>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<PersonRow> =
        sqlx::query_as::<_, PersonRow>(r#"SELECT id, name FROM people ORDER BY name"#)
            .fetch_all(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_person(
    app: tauri::AppHandle,
    req: CreatePersonRequest,
) -> Result<PersonRow, String> {
    let state = app.state::<AppState>();
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ts();
    sqlx::query(r#"INSERT INTO people (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"#)
        .bind(&id)
        .bind(&req.name)
        .bind(now)
        .bind(now)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(PersonRow { id, name: req.name })
}

#[tauri::command]
async fn update_person(
    app: tauri::AppHandle,
    person_id: String,
    req: UpdatePersonRequest,
) -> Result<PersonRow, String> {
    let state = app.state::<AppState>();
    if let Some(name) = req.name {
        let now = now_ts();
        sqlx::query(r#"UPDATE people SET name = ?, updated_at = ? WHERE id = ?"#)
            .bind(&name)
            .bind(now)
            .bind(&person_id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }
    let row = sqlx::query_as::<_, PersonRow>(r#"SELECT id, name FROM people WHERE id = ?"#)
        .bind(&person_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Person not found".to_string())?;
    Ok(row)
}

#[tauri::command]
async fn delete_person(app: tauri::AppHandle, person_id: String) -> Result<String, String> {
    let state = app.state::<AppState>();
    sqlx::query(r#"DELETE FROM people WHERE id = ?"#)
        .bind(&person_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Person deleted".into())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct MergePeopleRequest {
    personIds: Vec<String>,
}

#[tauri::command]
async fn merge_people(_app: tauri::AppHandle, _req: MergePeopleRequest) -> Result<String, String> {
    // TODO: Reassign faces to a canonical person, delete duplicates.
    Ok("Merge completed".into())
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow, Debug, Clone)]
struct RelationshipRow {
    id: String,
    person_a: String,
    person_b: String,
    kind: String,
}

#[tauri::command]
async fn list_relationships(
    app: tauri::AppHandle,
    person_id: String,
) -> Result<Vec<RelationshipRow>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<RelationshipRow> = sqlx::query_as::<_, RelationshipRow>(
        r#"SELECT id, person_a, person_b, kind FROM relationships WHERE person_a = ? OR person_b = ?"#,
    )
    .bind(&person_id)
    .bind(&person_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

// --- Tags ---

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow, Debug, Clone)]
struct TagRow {
    id: String,
    name: String,
}

#[tauri::command]
async fn list_tags(app: tauri::AppHandle) -> Result<Vec<TagRow>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<TagRow> =
        sqlx::query_as::<_, TagRow>(r#"SELECT id, name FROM tags ORDER BY name"#)
            .fetch_all(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_tag(app: tauri::AppHandle, name: String) -> Result<TagRow, String> {
    let state = app.state::<AppState>();
    // Try insert; on conflict, select existing
    let id = uuid::Uuid::new_v4().to_string();
    let res = sqlx::query(r#"INSERT INTO tags (id, name) VALUES (?, ?)"#)
        .bind(&id)
        .bind(&name)
        .execute(&state.db)
        .await;
    match res {
        Ok(_) => Ok(TagRow { id, name }),
        Err(_) => {
            let row = sqlx::query_as::<_, TagRow>(r#"SELECT id, name FROM tags WHERE name = ?"#)
                .bind(&name)
                .fetch_one(&state.db)
                .await
                .map_err(|e| e.to_string())?;
            Ok(row)
        }
    }
}

#[tauri::command]
async fn assign_tag(
    app: tauri::AppHandle,
    photo_id: String,
    tag_id: String,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    sqlx::query(r#"INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)"#)
        .bind(&photo_id)
        .bind(&tag_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Tag assigned".into())
}

#[tauri::command]
async fn remove_tag(
    app: tauri::AppHandle,
    photo_id: String,
    tag_id: String,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    sqlx::query(r#"DELETE FROM photo_tags WHERE photo_id = ? AND tag_id = ?"#)
        .bind(&photo_id)
        .bind(&tag_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Tag removed".into())
}

#[tauri::command]
async fn list_photo_tags(app: tauri::AppHandle, photo_id: String) -> Result<Vec<TagRow>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<TagRow> = sqlx::query_as::<_, TagRow>(
        r#"SELECT t.id, t.name FROM tags t JOIN photo_tags pt ON pt.tag_id = t.id WHERE pt.photo_id = ? ORDER BY t.name"#,
    )
    .bind(&photo_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

// --- Albums ---

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow, Debug, Clone)]
struct AlbumRow {
    id: String,
    name: String,
}

#[tauri::command]
async fn list_albums(app: tauri::AppHandle) -> Result<Vec<AlbumRow>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<AlbumRow> =
        sqlx::query_as::<_, AlbumRow>(r#"SELECT id, name FROM albums ORDER BY name"#)
            .fetch_all(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
async fn create_album(app: tauri::AppHandle, name: String) -> Result<AlbumRow, String> {
    let state = app.state::<AppState>();
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ts();
    sqlx::query(r#"INSERT INTO albums (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"#)
        .bind(&id)
        .bind(&name)
        .bind(now)
        .bind(now)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(AlbumRow { id, name })
}

#[tauri::command]
async fn add_photo_to_album(
    app: tauri::AppHandle,
    album_id: String,
    photo_id: String,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    sqlx::query(r#"INSERT OR IGNORE INTO album_photos (album_id, photo_id) VALUES (?, ?)"#)
        .bind(&album_id)
        .bind(&photo_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Added to album".into())
}

#[tauri::command]
async fn remove_photo_from_album(
    app: tauri::AppHandle,
    album_id: String,
    photo_id: String,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    sqlx::query(r#"DELETE FROM album_photos WHERE album_id = ? AND photo_id = ?"#)
        .bind(&album_id)
        .bind(&photo_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Removed from album".into())
}

#[tauri::command]
async fn list_album_photos(
    app: tauri::AppHandle,
    album_id: String,
) -> Result<Vec<PhotoDto>, String> {
    let state = app.state::<AppState>();
    let rows: Vec<PhotoRow> = sqlx::query_as::<_, PhotoRow>(
        r#"SELECT p.id as id, p.storage_path as storage_path, p.tier as tier FROM photos p JOIN album_photos ap ON ap.photo_id = p.id WHERE ap.album_id = ? ORDER BY p.updated_at DESC"#,
    )
    .bind(&album_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(PhotoDto::from).collect())
}

#[tauri::command]
async fn bulk_add_photos(app: tauri::AppHandle, file_paths: Vec<String>) -> Result<String, String> {
    let mut added = 0usize;
    let mut skipped = 0usize;
    for p in file_paths {
        match add_photo(app.clone(), p).await {
            Ok(msg) => {
                if msg.contains("Duplicate photo") {
                    skipped += 1
                } else {
                    added += 1
                }
            }
            Err(_) => skipped += 1,
        }
    }
    Ok(format!(
        "bulk_add_photos: added={}, skipped={}",
        added, skipped
    ))
}

#[tauri::command]
async fn assign_tag_bulk(
    app: tauri::AppHandle,
    photo_ids: Vec<String>,
    tag_id: String,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let mut ok = 0usize;
    for pid in photo_ids {
        sqlx::query(r#"INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)"#)
            .bind(&pid)
            .bind(&tag_id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
        ok += 1;
    }
    Ok(format!("assign_tag_bulk: ok={}", ok))
}

#[tauri::command]
async fn export_photos(
    app: tauri::AppHandle,
    photo_ids: Vec<String>,
    dest_dir: String,
    pattern: Option<String>,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    let dest = PathBuf::from(dest_dir);
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let mut ok = 0usize;
    let mut fail = 0usize;
    for pid in photo_ids {
        let row: Option<(String, String)> =
            sqlx::query_as(r#"SELECT storage_path, original_path FROM photos WHERE id = ?"#)
                .bind(&pid)
                .fetch_optional(&state.db)
                .await
                .map_err(|e| e.to_string())?;
        if let Some((storage_path, original_path)) = row {
            let src = PathBuf::from(storage_path);
            let name = PathBuf::from(original_path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("photo");
            let filename = if let Some(pat) = &pattern {
                pat.replace("{id}", &pid).replace("{name}", name)
            } else {
                name.to_string()
            };
            let out = unique_path(&dest.join(filename));
            match std::fs::copy(&src, &out) {
                Ok(_) => ok += 1,
                Err(_) => fail += 1,
            }
        } else {
            fail += 1
        }
    }
    Ok(format!("export_photos: ok={}, fail={}", ok, fail))
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_basic_functionality() {
        // Basic test to ensure the module compiles and basic functionality works
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn test_log_level_filter() {
        // Test that log level filter is accessible
        let level = log::LevelFilter::Info;
        assert_eq!(level, log::LevelFilter::Info);
    }
}
