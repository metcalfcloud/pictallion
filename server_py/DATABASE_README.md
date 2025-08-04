# Database Layer Documentation

This document describes the Python database layer for the Pictallion photo management application, converted from the TypeScript backend while maintaining 100% compatibility.

## Overview

The Python database layer uses SQLModel + SQLAlchemy with async support, providing:
- Full schema compatibility with the TypeScript backend
- Alembic-based migrations
- Comprehensive CRUD operations
- Database utilities and management tools
- Testing infrastructure

## Architecture

### Core Components

1. **Models** (`app/models/`)
   - `base.py` - Base classes and mixins
   - `media_asset.py` - All database models
   - `schemas.py` - Pydantic schemas and types
   - `__init__.py` - Model exports

2. **Database Core** (`app/core/`)
   - `database.py` - Connection management and session handling
   - `crud.py` - CRUD operations and repository patterns
   - `db_utils.py` - Utility functions and maintenance
   - `migrations.py` - Migration management
   - `config.py` - Configuration settings

3. **Migrations** (`app/migrations/`)
   - `env.py` - Alembic environment configuration
   - `script.py.mako` - Migration template
   - `versions/` - Migration scripts

## Database Schema

The Python backend maintains exact compatibility with the TypeScript schema:

### Core Tables

- **users** - User authentication
- **media_assets** - Main media asset records
- **file_versions** - Multi-tier file management (Bronze/Silver/Gold)
- **asset_history** - Change tracking
- **collections** - Photo collections (manual and smart)
- **collection_photos** - Collection-photo relationships
- **people** - Person records for face recognition
- **faces** - Face detection and recognition data
- **settings** - Application settings
- **ai_prompts** - AI prompt configurations
- **events** - Calendar events (holidays, birthdays)
- **locations** - Location data for photos
- **global_tag_library** - Global tag management
- **relationships** - Person-to-person relationships

### Key Features

- **UUID Primary Keys** - Using PostgreSQL `gen_random_uuid()`
- **JSONB Support** - For metadata, AI data, and flexible schemas
- **Array Support** - For keywords and tags
- **Foreign Key Constraints** - Proper referential integrity
- **Indexes** - Performance optimization
- **Timestamps** - Automatic created_at/updated_at tracking

## Database Configuration

### Environment Variables

```bash
# Database Type
DB_TYPE=sqlite|postgres

# Database URLs
DATABASE_URL=sqlite:///./data/pictallion.db
DATABASE_URL=postgresql://user:pass@localhost/pictallion

# Node.js compatibility
NODE_ENV=development|production
```

### Dual Database Support

The system supports both SQLite (development) and PostgreSQL (production):

```python
from app.core.config import settings

if settings.is_sqlite:
    # SQLite-specific operations
    pass
elif settings.is_postgres:
    # PostgreSQL-specific operations
    pass
```

## CRUD Operations

### Basic CRUD

```python
from app.core.crud import media_asset, file_version, person

# Create
asset = await media_asset.create(db, obj_in=asset_data)

# Read
asset = await media_asset.get(db, id=asset_id)
assets = await media_asset.get_multi(db, skip=0, limit=100)

# Update
updated = await media_asset.update(db, db_obj=asset, obj_in=update_data)

# Delete
deleted = await media_asset.remove(db, id=asset_id)
```

### Specialized Operations

```python
# Search people by name
people = await person.search_by_name(db, name_query="John")

# Get file versions by tier
gold_files = await file_version.get_by_tier(db, tier="gold")

# Get unassigned faces
unassigned = await face.get_unassigned(db, limit=50)

# Settings management
await setting.set_value(db, key="theme", value="dark")
theme = await setting.get_by_key(db, key="theme")
```

## Migration Management

### Alembic Setup

```bash
# Initialize (first time only)
cd server_py
python manage_db.py init

# Create migration
python manage_db.py create-migration

# Run migrations
python manage_db.py migrate

# Check status
python manage_db.py status
```

### Migration Files

Migrations are stored in `app/migrations/versions/` and follow the pattern:
- `001_initial_schema.py` - Base schema matching TypeScript backend
- `002_add_feature.py` - Additional features
- etc.

### Programmatic Migration Management

```python
from app.core.migrations import migration_manager

# Check status
status = await migration_manager.check_migration_status()

# Run migrations
success = migration_manager.upgrade_to_head()

# Create new migration
success = migration_manager.create_migration("Add new feature")
```

## Database Utilities

### Health Checks

```python
from app.core.database import db_manager

# Health check
health = await db_manager.health_check()

# Database statistics
stats = await db_manager.get_stats()

# Schema compatibility check
compatibility = await db_manager.check_compatibility()
```

### Maintenance Operations

```python
from app.core.db_utils import (
    vacuum_database, analyze_database, 
    check_database_integrity, backup_database
)

# Maintenance
await vacuum_database()
await analyze_database()

# Integrity check
results = await check_database_integrity()

# Backup (SQLite only)
success = await backup_database("backup.db")
```

## Testing

### Running Tests

```bash
cd server_py
pip install -r requirements.txt
pytest tests/test_database.py -v
```

### Test Categories

1. **Model Tests** - Verify model creation and relationships
2. **CRUD Tests** - Test all CRUD operations
3. **Relationship Tests** - Verify foreign key relationships work
4. **Migration Tests** - Test migration system
5. **Compatibility Tests** - Verify TypeScript compatibility
6. **Integrity Tests** - Test constraints and data integrity

### Test Database

Tests use a separate SQLite database (`test_pictallion.db`) that is created and destroyed for each test run.

## CLI Management Tool

The `manage_db.py` script provides comprehensive database management:

```bash
# Database operations
python manage_db.py init              # Initialize database
python manage_db.py reset             # Reset database (destructive)
python manage_db.py status            # Check status
python manage_db.py stats             # Show statistics

# Migration operations
python manage_db.py migrate           # Run migrations
python manage_db.py create-migration  # Create new migration

# Maintenance operations
python manage_db.py maintenance       # Run vacuum/analyze
python manage_db.py integrity         # Check integrity
python manage_db.py backup            # Create backup
python manage_db.py restore           # Restore from backup
```

## Data Compatibility

### TypeScript to Python Migration

The Python models maintain 100% compatibility with the TypeScript schema:

1. **Table Names** - Exact match (e.g., `media_assets`, `file_versions`)
2. **Column Names** - Exact match (e.g., `original_filename`, `media_asset_id`)
3. **Data Types** - Compatible mappings (TEXT, INTEGER, JSONB, etc.)
4. **Constraints** - All foreign keys and unique constraints preserved
5. **Indexes** - Performance indexes maintained
6. **Default Values** - All defaults preserved

### Field Mappings

| TypeScript (Drizzle) | Python (SQLModel) | Notes |
|---------------------|------------------|-------|
| `varchar().primaryKey()` | `str = Field(primary_key=True)` | UUID primary keys |
| `text().notNull()` | `str` | Required text fields |
| `integer().default(0)` | `int = Field(default=0)` | Integer with default |
| `boolean().default(false)` | `bool = Field(default=False)` | Boolean fields |
| `timestamp().defaultNow()` | `datetime = Field(default_factory=datetime.utcnow)` | Timestamps |
| `jsonb()` | `Dict[str, Any] = Field(sa_column=Column(JSON))` | JSON data |
| `text().array()` | `List[str] = Field(sa_column=Column(ARRAY(String)))` | Arrays |

## Performance Considerations

### Connection Pooling

```python
# PostgreSQL connection pool
async_engine = create_async_engine(
    database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600
)
```

### Query Optimization

1. **Indexes** - All performance indexes from TypeScript backend preserved
2. **Lazy Loading** - Relationships use lazy loading by default
3. **Pagination** - CRUD operations support skip/limit pagination
4. **Bulk Operations** - Use SQLAlchemy bulk operations for large datasets

### Async Best Practices

```python
# Use async context managers
async with get_db_transaction() as db:
    # Multiple operations in single transaction
    asset = await media_asset.create(db, obj_in=asset_data)
    version = await file_version.create(db, obj_in=version_data)
    # Automatic commit/rollback

# Batch operations
async def process_files(file_list):
    async with AsyncSessionLocal() as db:
        for file_data in file_list:
            await process_single_file(db, file_data)
        await db.commit()
```

## Security Considerations

1. **SQL Injection Prevention** - Using parameterized queries via SQLAlchemy
2. **Connection Security** - TLS/SSL support for PostgreSQL connections
3. **Access Control** - Database-level permissions and role-based access
4. **Data Validation** - Pydantic models for input validation
5. **Audit Trail** - Asset history tracking for change monitoring

## Troubleshooting

### Common Issues

1. **Migration Conflicts**
   ```bash
   python manage_db.py status  # Check current state
   python manage_db.py integrity  # Check for issues
   ```

2. **Connection Issues**
   ```bash
   python manage_db.py status  # Test connectivity
   # Check DATABASE_URL and DB_TYPE settings
   ```

3. **Performance Issues**
   ```bash
   python manage_db.py maintenance  # Run VACUUM/ANALYZE
   python manage_db.py stats  # Check table sizes
   ```

4. **Data Corruption**
   ```bash
   python manage_db.py integrity  # Check database integrity
   python manage_db.py backup  # Create backup before repairs
   ```

### Logging

Enable database logging for debugging:

```python
# In development
settings.debug = True  # Enables SQL query logging
```

## Future Enhancements

1. **Read Replicas** - Support for read/write splitting
2. **Sharding** - Horizontal scaling for large datasets
3. **Caching** - Redis integration for frequently accessed data
4. **Monitoring** - Database performance monitoring
5. **Backup Automation** - Scheduled backup system
6. **Data Archiving** - Old data archival strategies

## API Integration

The database layer integrates with FastAPI through dependency injection:

```python
from fastapi import Depends
from app.core.database import get_db

@app.get("/photos/")
async def get_photos(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    photos = await file_version.get_by_tier(db, tier="gold", skip=skip, limit=limit)
    return photos
```

This database layer provides a robust, scalable foundation for the Pictallion Python backend while maintaining full compatibility with the existing TypeScript implementation.