# Pictallion FastAPI Backend - API Documentation

This document provides a comprehensive reference for all FastAPI endpoints, request/response schemas, authentication, error handling, and usage examples.

## Overview

- 150+ endpoints covering photo management, people/faces, AI, collections, events, locations, analytics, and system operations.
- All endpoints follow RESTful conventions and return JSON.

## Authentication

- Current: No authentication required (standalone desktop mode)
- Future: JWT-based authentication planned (see [`SECURITY.md`](SECURITY.md:1))

## Endpoint Reference

### Photo Management

- `GET /api/photos/` - List photos
- `POST /api/photos/` - Upload new photo
- `PATCH /api/photos/{photo_id}` - Update photo metadata
- `DELETE /api/photos/{photo_id}` - Delete photo
- `GET /api/files/media/{file_id}` - Download photo file

### People & Faces

- `GET /api/people/` - List people
- `POST /api/faces/` - Add face data
- `GET /api/faces/{face_id}` - Get face details

### AI Processing

- `POST /api/ai/process` - Run AI analysis on photo
- `GET /api/ai/status/{job_id}` - Get AI job status

### Collections & Smart Collections

- `GET /api/collections/` - List collections
- `POST /api/collections/` - Create collection

### Events & Settings

- `GET /api/events/` - List events
- `GET /api/settings/` - Get settings

### Locations

- `GET /api/locations/` - List locations

### Analytics & System

- `GET /api/stats` - System analytics
- `GET /api/health` - Health check

## Request/Response Schemas

Example: Photo Update

```json
PATCH /api/photos/{photo_id}
{
  "rating": 5,
  "keywords": ["vacation", "beach"],
  "location": "Cancun"
}
```

Response:

```json
{
  "id": "abc123",
  "original_filename": "IMG_001.jpg",
  "rating": 5,
  "keywords": ["vacation", "beach"],
  "location": "Cancun",
  "tier": "gold"
}
```

## Error Handling

- Standard HTTP status codes
- Error responses include `detail` field

Example:

```json
{
  "detail": "Photo not found"
}
```

## Usage Examples

See [`DEVELOPMENT.md`](DEVELOPMENT.md:1) for API usage in frontend and scripts.

## Rate Limiting

- Not enabled by default; see [`SECURITY.md`](SECURITY.md:1) for future plans.

## References

- [Architecture](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Security](SECURITY.md)