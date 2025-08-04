"""
Test Configuration and Fixtures

Global pytest fixtures and configuration for the Pictallion test suite.
Provides database isolation, mock services, and test utilities.
"""

import asyncio
import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, Mock, patch

import aiofiles
import pytest
import pytest_asyncio
from app.core.config import settings
from app.core.crud import (collection, face, file_version, media_asset, person,
                           setting)
from app.core.database import get_async_session
from app.main import app
from app.models import *
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker,
                                    create_async_engine)
from sqlmodel import SQLModel

# Test database configuration
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_pictallion.db"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False},
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def setup_test_database():
    """Set up test database schema."""
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    yield

    # Clean up
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)

    await test_engine.dispose()


@pytest.fixture
async def db_session(setup_test_database) -> AsyncGenerator[AsyncSession, None]:
    """Get isolated test database session."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest.fixture
async def clean_db_session(setup_test_database) -> AsyncGenerator[AsyncSession, None]:
    """Get completely clean database session with all data cleared."""
    async with TestSessionLocal() as session:
        try:
            # Clear all tables in reverse order to handle foreign keys
            tables = [
                "relationships",
                "faces",
                "collection_photos",
                "collections",
                "asset_history",
                "file_versions",
                "media_assets",
                "people",
                "settings",
                "ai_prompts",
                "events",
                "global_tag_library",
                "locations",
                "users",
            ]

            for table in tables:
                await session.execute(f"DELETE FROM {table}")

            await session.commit()
            yield session
        finally:
            await session.rollback()
            await session.close()


# Override database dependency for testing
async def get_test_db_session():
    """Override database session for testing."""
    async with TestSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_async_session] = get_test_db_session


@pytest.fixture
def client() -> TestClient:
    """Get FastAPI test client."""
    return TestClient(app)


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Get async HTTP client for testing."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create temporary directory for file testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
async def temp_media_dir(temp_dir: Path) -> Path:
    """Create temporary media directory structure."""
    media_dir = temp_dir / "media"
    bronze_dir = media_dir / "bronze"
    silver_dir = media_dir / "silver"
    gold_dir = media_dir / "gold"

    bronze_dir.mkdir(parents=True)
    silver_dir.mkdir(parents=True)
    gold_dir.mkdir(parents=True)

    return media_dir


@pytest.fixture
def sample_image_path(temp_dir: Path) -> Path:
    """Create a sample test image file."""
    from PIL import Image

    # Create a simple test image
    image = Image.new("RGB", (100, 100), color="red")
    image_path = temp_dir / "test_image.jpg"
    image.save(image_path, "JPEG")

    return image_path


@pytest.fixture
def sample_image_with_exif(temp_dir: Path) -> Path:
    """Create a sample test image with EXIF data."""
    import piexif
    from PIL import Image
    from PIL.ExifTags import TAGS

    # Create image with EXIF data
    image = Image.new("RGB", (200, 150), color="blue")

    # Create EXIF data
    exif_dict = {
        "0th": {
            piexif.ImageIFD.Make: "Test Camera",
            piexif.ImageIFD.Model: "Test Model",
            piexif.ImageIFD.DateTime: "2024:01:01 12:00:00",
        },
        "Exif": {
            piexif.ExifIFD.DateTimeOriginal: "2024:01:01 12:00:00",
            piexif.ExifIFD.FocalLength: (50, 1),
            piexif.ExifIFD.FNumber: (28, 10),
        },
        "GPS": {
            piexif.GPSIFD.GPSLatitude: ((40, 1), (45, 1), (0, 1)),
            piexif.GPSIFD.GPSLatitudeRef: "N",
            piexif.GPSIFD.GPSLongitude: ((73, 1), (59, 1), (0, 1)),
            piexif.GPSIFD.GPSLongitudeRef: "W",
        },
    }

    exif_bytes = piexif.dump(exif_dict)
    image_path = temp_dir / "test_image_with_exif.jpg"
    image.save(image_path, "JPEG", exif=exif_bytes)

    return image_path


# Mock services fixtures
@pytest.fixture
def mock_ai_service():
    """Mock AI service for testing."""
    with patch("app.services.ai_service.ai_service") as mock:
        # Configure mock responses
        mock.analyze_image = AsyncMock(
            return_value={
                "tags": ["test", "photo"],
                "description": "A test image",
                "confidence": 95,
                "provider": "mock",
            }
        )
        mock.generate_tags = AsyncMock(return_value=["test", "photo", "mock"])
        mock.health_check = AsyncMock(
            return_value={
                "openai": {"available": False},
                "ollama": {"available": False},
            }
        )
        yield mock


@pytest.fixture
def mock_face_detection_service():
    """Mock face detection service for testing."""
    with patch("app.services.face_detection_service.face_detection_service") as mock:
        mock.detect_faces = AsyncMock(
            return_value=[
                {
                    "location": {"top": 10, "left": 20, "bottom": 100, "right": 120},
                    "encoding": [0.1] * 128,  # 128-dimensional face encoding
                    "confidence": 95,
                }
            ]
        )
        mock.generate_face_encoding = AsyncMock(return_value=[0.1] * 128)
        mock.health_check = AsyncMock(
            return_value={
                "status": "healthy",
                "model": "mock",
                "tolerance": 0.6,
                "library_available": True,
            }
        )
        yield mock


@pytest.fixture
def mock_file_manager_service():
    """Mock file manager service for testing."""
    with patch("app.services.file_manager_service.file_manager_service") as mock:
        mock.save_file = AsyncMock(return_value="/test/path/file.jpg")
        mock.delete_file = AsyncMock(return_value=True)
        mock.move_file = AsyncMock(return_value="/new/path/file.jpg")
        mock.get_file_info = AsyncMock(
            return_value={"size": 1024, "hash": "abc123", "mime_type": "image/jpeg"}
        )
        yield mock


@pytest.fixture
def mock_thumbnail_service():
    """Mock thumbnail service for testing."""
    with patch("app.services.thumbnail_service.thumbnail_service") as mock:
        mock.generate_thumbnails = AsyncMock(
            return_value={
                150: "/test/thumbnails/150.jpg",
                300: "/test/thumbnails/300.jpg",
                600: "/test/thumbnails/600.jpg",
            }
        )
        mock.get_thumbnail_path = AsyncMock(return_value="/test/thumbnails/300.jpg")
        yield mock


@pytest.fixture
def mock_metadata_service():
    """Mock metadata service for testing."""
    with patch("app.services.metadata_service.metadata_service") as mock:
        mock.extract_metadata = AsyncMock(
            return_value={
                "exif": {
                    "camera": "Test Camera",
                    "date_taken": "2024-01-01T12:00:00",
                    "gps_latitude": 40.75,
                    "gps_longitude": -73.98,
                },
                "ai": {"tags": ["test", "photo"], "description": "A test image"},
            }
        )
        yield mock


# Test data factories
@pytest.fixture
def user_factory():
    """Factory for creating test users."""

    def _create_user(**kwargs):
        defaults = {"username": "testuser", "password": "testpass"}
        defaults.update(kwargs)
        return User(**defaults)

    return _create_user


@pytest.fixture
def media_asset_factory():
    """Factory for creating test media assets."""

    def _create_media_asset(**kwargs):
        defaults = {"original_filename": "test_photo.jpg"}
        defaults.update(kwargs)
        return MediaAsset(**defaults)

    return _create_media_asset


@pytest.fixture
def file_version_factory():
    """Factory for creating test file versions."""

    def _create_file_version(**kwargs):
        defaults = {
            "tier": "silver",
            "file_path": "/test/path/photo.jpg",
            "file_hash": "abc123def456",
            "file_size": 1024000,
            "mime_type": "image/jpeg",
            "rating": 0,
            "keywords": [],
            "processing_state": "processed",
        }
        defaults.update(kwargs)
        return FileVersion(**defaults)

    return _create_file_version


@pytest.fixture
def person_factory():
    """Factory for creating test people."""

    def _create_person(**kwargs):
        defaults = {"name": "Test Person", "face_count": 0}
        defaults.update(kwargs)
        return Person(**defaults)

    return _create_person


@pytest.fixture
def face_factory():
    """Factory for creating test faces."""

    def _create_face(**kwargs):
        defaults = {
            "bounding_box": {"top": 10, "left": 20, "bottom": 100, "right": 120},
            "confidence": 95,
            "ignored": False,
        }
        defaults.update(kwargs)
        return Face(**defaults)

    return _create_face


@pytest.fixture
def collection_factory():
    """Factory for creating test collections."""

    def _create_collection(**kwargs):
        defaults = {
            "name": "Test Collection",
            "description": "A test collection",
            "is_public": False,
            "is_smart_collection": False,
        }
        defaults.update(kwargs)
        return Collection(**defaults)

    return _create_collection


# Performance testing fixtures
@pytest.fixture
def benchmark_config():
    """Configuration for benchmark tests."""
    return {"min_rounds": 5, "max_time": 10.0, "warmup": True, "warmup_iterations": 2}


# Test environment cleanup
@pytest.fixture(autouse=True)
def cleanup_test_files():
    """Automatically cleanup test files after each test."""
    yield

    # Cleanup test database file
    test_db_path = "./test_pictallion.db"
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except (OSError, PermissionError):
            pass  # File might be in use
