# Pictallion Rust/Tauri Backend - API & IPC Documentation

This document provides an up-to-date reference for all Tauri IPC commands, request/response schemas, error handling, and usage notes.

## Overview

- IPC commands expose backend functionality to the frontend via Tauri's invoke API.
- All commands are asynchronous and use Rust's async features.
- SQLite is used for persistent storage via `sqlx`; tiered file operations are supported.
- EXIF/XMP metadata extraction uses `rexiv2`.
- Tiered storage structure: bronze (immutable), silver (AI-processed), gold (finalized), archive (long-term).

## IPC Command Reference

### Photo Management

- `add_photo(filePath: String) -> Result<String, String>`
  - Adds a photo to the database and moves the file to the bronze tier (`data/media/bronze/`).

- `list_photos() -> Result<Vec<Photo>, String>`
  - Returns a list of all photos with metadata.

- `get_photo_metadata(photoId: String) -> Result<String, String>`
  - Returns photo metadata as a JSON string from SQLite.

- `promote_photo_tier(photoId: String, tier: String) -> Result<String, String>`
  - Moves photo to specified tier (`bronze`, `silver`, `gold`, `archive`) and updates SQLite.

- `promote_photo(photoId: String, tier: String) -> Result<String, String>`
  - Alias for `promote_photo_tier`.

### People Management

- `list_people() -> Result<Vec<Person>, String>`
  - Lists all people in the database.

- `create_person(req: CreatePersonRequest) -> Result<Person, String>`
  - Creates a new person record.

- `update_person(personId: String, req: UpdatePersonRequest) -> Result<Person, String>`
  - Updates an existing person.

- `delete_person(personId: String) -> Result<String, String>`
  - Deletes a person record.

- `merge_people(req: MergePeopleRequest) -> Result<String, String>`
  - Merges multiple people records.

- `list_relationships(personId: String) -> Result<Vec<Relationship>, String>`
  - Lists relationships for a given person.

### Face Detection & Recognition

- `detect_faces(imagePath: String) -> Result<Vec<DetectedFace>, String>`
  - Detects faces in an image and returns bounding boxes.

- `generate_face_embedding(imagePath: String, boundingBox: [number, number, number, number]) -> Result<Vec<number>, String>`
  - Generates a face embedding for a detected face.

- `face_detection_health_check() -> Result<bool, String>`
  - Checks if face detection is operational.

### Metadata Management

- `extract_metadata(filePath: String) -> Result<String, String>`
  - Extracts EXIF/XMP metadata as JSON.

- `embed_metadata(filePath: String, metadata: String) -> Result<(), String>`
  - Embeds EXIF/XMP metadata from JSON into a file.

### Filesystem Operations

- `create_tier_dir(tier: String) -> Result<(), String>`
  - Creates a directory for the specified tier (`data/media/{tier}/`).

- `move_file_to_tier(src: String, tier: String) -> Result<(), String>`
  - Moves a file to the specified tier directory.

## Request/Response Schemas

### Example: Get Photo Metadata

```json
invoke("get_photo_metadata", { photoId: "abc123" })
// Response:
{
  "id": "abc123",
  "original_filename": "IMG_001.jpg",
  "rating": 5,
  "keywords": ["vacation", "beach"],
  "location": "Cancun",
  "tier": "gold"
}
```

### Example: Add Photo

```json
invoke("add_photo", { filePath: "data/media/bronze/photo.jpg" })
// Response:
"Photo added successfully: data/media/bronze/photo.jpg"
```

### Example: List People

```json
invoke("list_people", {})
// Response:
[
  { "id": "person1", "name": "Alice" },
  { "id": "person2", "name": "Bob" }
]
```

### Example: Detect Faces

```json
invoke("detect_faces", { imagePath: "data/media/bronze/image.jpg" })
// Response:
[
  { "boundingBox": [10, 20, 50, 60], "embedding": [0.1, 0.2, ...] }
]
```

## Error Handling

- All IPC commands return `Result<T, String>`; errors include descriptive messages.
- Standard error response:
  ```json
  {
    "error": "Photo not found"
  }
  ```

## Authentication

- Current: No authentication required (standalone desktop mode).
- Future: JWT-based authentication planned (see [`SECURITY.md`](SECURITY.md:1)).

## Migration Notes

- IPC commands are designed to match legacy FastAPI endpoints for seamless migration.
- SQLite schema and tiered storage logic are preserved.

## Usage Examples

See [`DEVELOPMENT.md`](DEVELOPMENT.md:1) for IPC usage in frontend and scripts. For frontend integration, see [`frontend/src/lib/tauriApi.ts`](frontend/src/lib/tauriApi.ts:1).

## References

- [Architecture](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Development Guide](DEVELOPMENT.md)
- [Security](SECURITY.md)
- [Frontend API Wrappers](frontend/src/lib/tauriApi.ts)