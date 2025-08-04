# Pictallion System Architecture

This document provides a detailed overview of the Python backend architecture, technology stack, service relationships, and database schema.

## Executive Summary

- Python FastAPI backend replaces TypeScript/Node.js backend
- Full API compatibility and feature parity
- Modular service layer, scalable deployment

## Architecture Diagram

```mermaid
graph TB
    Client[Frontend Client] --> API[FastAPI Application]
    API --> Auth[Authentication Layer]
    API --> Routes[API Routes Layer]
    Routes --> PhotoRoutes[Photo Management]
    Routes --> PeopleRoutes[People & Faces]
    Routes --> AIRoutes[AI Processing]
    Routes --> CollectionRoutes[Collections]
    Routes --> EventRoutes[Events]
    Routes --> LocationRoutes[Locations]
    Routes --> SettingsRoutes[Settings]
    PhotoRoutes --> PhotoService[Photo Service]
    PeopleRoutes --> FaceService[Face Detection Service]
    AIRoutes --> AIService[AI Service]
    CollectionRoutes --> CollectionService[Collection Service]
    EventRoutes --> EventService[Event Detection Service]
    LocationRoutes --> LocationService[Location Service]
    SettingsRoutes --> SettingsService[Settings Service]
    PhotoService --> FileManager[File Manager]
    PhotoService --> MetadataService[Metadata Service]
    PhotoService --> ThumbnailService[Thumbnail Service]
    FaceService --> AILib[Face Recognition Lib]
    AIService --> Ollama[Ollama API]
    AIService --> OpenAI[OpenAI API]
    AIService --> TensorFlow[TensorFlow]
    FileManager --> Storage[File System]
    MetadataService --> ImageLib[Pillow/PIL]
    PhotoService --> Database[SQLModel/SQLAlchemy]
    FaceService --> Database
    AIService --> Database
    CollectionService --> Database
    EventService --> Database
    LocationService --> Database
    SettingsService --> Database
    Database --> SQLite[SQLite File]
    Database --> Postgres[PostgreSQL]
```

## Technology Stack

- **Backend:** Python 3.11+, FastAPI, SQLModel, SQLAlchemy, Alembic
- **Frontend:** React 18+, TypeScript, Tailwind CSS
- **AI/ML:** Ollama, OpenAI, TensorFlow, face_recognition, dlib
- **Database:** PostgreSQL (production), SQLite (development)
- **Testing:** pytest, coverage, CI/CD via GitHub Actions

## Service Layer

- AIService: AI analysis, tag generation
- FaceDetectionService: Face detection, embedding
- FileManagerService: Tiered file management, EXIF extraction
- ThumbnailService: Dynamic thumbnail generation
- EventDetectionService: Event detection
- LocationService: GPS and geocoding
- MetadataEmbeddingService: EXIF/XMP embedding
- AdvancedSearchService: Search and filtering
- BurstPhotoDetectionService: Burst sequence analysis
- DuplicateDetectionService: Duplicate resolution

## Database Schema

- MediaAsset: Photo metadata
- FileVersion: Tiered file storage
- People, Faces: Face recognition data
- Collections, Events: Organization
- Settings: Configuration

## Design Principles

- Async-first, modular, testable
- RESTful API, OpenAPI docs
- Secure, scalable, maintainable

## References

- [Migration Guide](MIGRATION_GUIDE.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Security](SECURITY.md)