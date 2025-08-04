"""
Test Utilities and Helper Functions

Common utilities and helper functions for testing the Pictallion backend.
"""

import asyncio
import json
import random
import string
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from unittest.mock import AsyncMock, Mock

import numpy as np
from app.models import (Collection, Event, Face, FileVersion, Location,
                        MediaAsset, Person, Relationship, Setting, User)
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession


class TestDataGenerator:
    """Generate test data for various models."""

    @staticmethod
    def generate_uuid() -> str:
        """Generate a random UUID string."""
        return str(uuid.uuid4())

    @staticmethod
    def generate_random_string(length: int = 10) -> str:
        """Generate a random string of specified length."""
        return "".join(random.choices(string.ascii_letters + string.digits, k=length))

    @staticmethod
    def generate_random_hash() -> str:
        """Generate a random hash string."""
        return "".join(random.choices(string.hexdigits.lower(), k=64))

    @staticmethod
    def generate_test_image(
        width: int = 100, height: int = 100, color: str = "red"
    ) -> Image.Image:
        """Generate a test PIL Image."""
        return Image.new("RGB", (width, height), color=color)

    @staticmethod
    def generate_face_encoding(dimensions: int = 128) -> List[float]:
        """Generate a random face encoding vector."""
        return np.random.rand(dimensions).tolist()

    @staticmethod
    def generate_gps_coordinates() -> Dict[str, float]:
        """Generate random GPS coordinates."""
        return {
            "latitude": random.uniform(-90, 90),
            "longitude": random.uniform(-180, 180),
        }

    @staticmethod
    def generate_exif_metadata() -> Dict[str, Any]:
        """Generate sample EXIF metadata."""
        cameras = ["Canon EOS R5", "Nikon D850", "Sony A7R IV", "iPhone 15 Pro"]
        return {
            "camera": random.choice(cameras),
            "lens": "24-70mm f/2.8",
            "aperture": f"f/{random.choice([1.4, 2.8, 4.0, 5.6, 8.0])}",
            "shutter": f"1/{random.randint(60, 1000)}",
            "iso": str(random.choice([100, 200, 400, 800, 1600, 3200])),
            "focal_length": f"{random.randint(24, 200)}mm",
            "date_taken": datetime.now().isoformat(),
            "gps_latitude": random.uniform(40.0, 41.0),
            "gps_longitude": random.uniform(-74.0, -73.0),
        }

    @staticmethod
    def generate_ai_metadata() -> Dict[str, Any]:
        """Generate sample AI metadata."""
        tags = [
            "portrait",
            "landscape",
            "urban",
            "nature",
            "people",
            "animals",
            "architecture",
        ]
        return {
            "ai_tags": random.sample(tags, k=random.randint(2, 5)),
            "short_description": "A beautiful test image",
            "long_description": "This is a detailed description of a test image with various elements.",
            "detected_objects": [
                {"name": "person", "confidence": 0.95, "box": [10, 20, 100, 200]},
                {"name": "car", "confidence": 0.87, "box": [150, 50, 250, 150]},
            ],
            "ai_confidence_scores": {"overall": 0.92, "objects": 0.89, "scene": 0.94},
        }


class DatabaseTestHelper:
    """Helper class for database testing operations."""

    @staticmethod
    async def create_test_user(session: AsyncSession, **kwargs) -> User:
        """Create a test user in the database."""
        defaults = {
            "username": f"testuser_{TestDataGenerator.generate_random_string(5)}",
            "password": "testpassword",
        }
        defaults.update(kwargs)

        user = User(**defaults)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    @staticmethod
    async def create_test_media_asset(session: AsyncSession, **kwargs) -> MediaAsset:
        """Create a test media asset in the database."""
        defaults = {
            "original_filename": f"test_photo_{TestDataGenerator.generate_random_string(5)}.jpg"
        }
        defaults.update(kwargs)

        asset = MediaAsset(**defaults)
        session.add(asset)
        await session.commit()
        await session.refresh(asset)
        return asset

    @staticmethod
    async def create_test_file_version(
        session: AsyncSession, media_asset: Optional[MediaAsset] = None, **kwargs
    ) -> FileVersion:
        """Create a test file version in the database."""
        if not media_asset:
            media_asset = await DatabaseTestHelper.create_test_media_asset(session)

        defaults = {
            "media_asset_id": media_asset.id,
            "tier": "silver",
            "file_path": f"/test/path/{TestDataGenerator.generate_random_string(10)}.jpg",
            "file_hash": TestDataGenerator.generate_random_hash(),
            "file_size": random.randint(100000, 10000000),
            "mime_type": "image/jpeg",
            "metadata": {
                "exif": TestDataGenerator.generate_exif_metadata(),
                "ai": TestDataGenerator.generate_ai_metadata(),
            },
            "rating": random.randint(0, 5),
            "keywords": ["test", "photo", "sample"],
        }
        defaults.update(kwargs)

        version = FileVersion(**defaults)
        session.add(version)
        await session.commit()
        await session.refresh(version)
        return version

    @staticmethod
    async def create_test_person(session: AsyncSession, **kwargs) -> Person:
        """Create a test person in the database."""
        defaults = {
            "name": f"Test Person {TestDataGenerator.generate_random_string(5)}",
            "face_count": 0,
        }
        defaults.update(kwargs)

        person = Person(**defaults)
        session.add(person)
        await session.commit()
        await session.refresh(person)
        return person

    @staticmethod
    async def create_test_face(
        session: AsyncSession,
        file_version: Optional[FileVersion] = None,
        person: Optional[Person] = None,
        **kwargs,
    ) -> Face:
        """Create a test face in the database."""
        if not file_version:
            file_version = await DatabaseTestHelper.create_test_file_version(session)

        defaults = {
            "photo_id": file_version.id,
            "person_id": person.id if person else None,
            "bounding_box": {
                "top": random.randint(10, 50),
                "left": random.randint(10, 50),
                "bottom": random.randint(100, 200),
                "right": random.randint(100, 200),
            },
            "confidence": random.randint(80, 100),
            "embedding": {"encoding": TestDataGenerator.generate_face_encoding()},
            "ignored": False,
        }
        defaults.update(kwargs)

        face = Face(**defaults)
        session.add(face)
        await session.commit()
        await session.refresh(face)
        return face

    @staticmethod
    async def create_test_collection(session: AsyncSession, **kwargs) -> Collection:
        """Create a test collection in the database."""
        defaults = {
            "name": f"Test Collection {TestDataGenerator.generate_random_string(5)}",
            "description": "A test collection for unit testing",
            "is_public": random.choice([True, False]),
            "is_smart_collection": False,
        }
        defaults.update(kwargs)

        collection = Collection(**defaults)
        session.add(collection)
        await session.commit()
        await session.refresh(collection)
        return collection


class MockServiceHelper:
    """Helper class for creating mock services."""

    @staticmethod
    def create_mock_ai_service() -> Mock:
        """Create a mock AI service."""
        mock = Mock()
        mock.analyze_image = AsyncMock(
            return_value={
                "tags": ["test", "mock", "image"],
                "description": "A mock analyzed image",
                "confidence": 95,
                "provider": "mock",
            }
        )
        mock.generate_tags = AsyncMock(return_value=["mock", "test", "generated"])
        mock.health_check = AsyncMock(
            return_value={
                "openai": {"available": False, "reason": "mock"},
                "ollama": {"available": True, "model": "mock-model"},
            }
        )
        return mock

    @staticmethod
    def create_mock_face_detection_service() -> Mock:
        """Create a mock face detection service."""
        mock = Mock()
        mock.detect_faces = AsyncMock(
            return_value=[
                {
                    "location": {"top": 10, "left": 20, "bottom": 100, "right": 120},
                    "encoding": TestDataGenerator.generate_face_encoding(),
                    "confidence": 95,
                }
            ]
        )
        mock.generate_face_encoding = AsyncMock(
            return_value=TestDataGenerator.generate_face_encoding()
        )
        mock.compare_faces = AsyncMock(return_value=True)
        mock.health_check = AsyncMock(
            return_value={
                "status": "healthy",
                "model": "mock-face-model",
                "tolerance": 0.6,
            }
        )
        return mock

    @staticmethod
    def create_mock_file_manager_service() -> Mock:
        """Create a mock file manager service."""
        mock = Mock()
        mock.save_file = AsyncMock(return_value="/mock/path/file.jpg")
        mock.delete_file = AsyncMock(return_value=True)
        mock.move_file = AsyncMock(return_value="/mock/new/path/file.jpg")
        mock.get_file_info = AsyncMock(
            return_value={
                "size": 1024000,
                "hash": TestDataGenerator.generate_random_hash(),
                "mime_type": "image/jpeg",
                "created_at": datetime.now().isoformat(),
            }
        )
        mock.copy_file = AsyncMock(return_value="/mock/copy/path/file.jpg")
        return mock


class FileTestHelper:
    """Helper class for file-related testing."""

    @staticmethod
    def create_test_image_file(
        path: Path, width: int = 100, height: int = 100, format: str = "JPEG"
    ) -> Path:
        """Create a test image file at the specified path."""
        image = TestDataGenerator.generate_test_image(width, height)
        image.save(path, format=format)
        return path

    @staticmethod
    def create_test_image_with_exif(path: Path) -> Path:
        """Create a test image file with EXIF data."""
        import piexif

        image = TestDataGenerator.generate_test_image(200, 150, "blue")

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
        image.save(path, "JPEG", exif=exif_bytes)
        return path


class APITestHelper:
    """Helper class for API testing."""

    @staticmethod
    def create_auth_headers(token: str = "test-token") -> Dict[str, str]:
        """Create authentication headers for API testing."""
        return {"Authorization": f"Bearer {token}"}

    @staticmethod
    def assert_api_response_structure(
        response_data: Dict[str, Any], expected_keys: List[str]
    ):
        """Assert that API response has expected structure."""
        for key in expected_keys:
            assert key in response_data, f"Expected key '{key}' not found in response"

    @staticmethod
    def assert_pagination_structure(response_data: Dict[str, Any]):
        """Assert that API response has proper pagination structure."""
        expected_keys = ["items", "total", "page", "size", "pages"]
        APITestHelper.assert_api_response_structure(response_data, expected_keys)

        assert isinstance(response_data["items"], list)
        assert isinstance(response_data["total"], int)
        assert isinstance(response_data["page"], int)
        assert isinstance(response_data["size"], int)
        assert isinstance(response_data["pages"], int)


class PerformanceTestHelper:
    """Helper class for performance testing."""

    @staticmethod
    async def measure_execution_time(async_func, *args, **kwargs) -> tuple:
        """Measure execution time of an async function."""
        start_time = datetime.now()
        result = await async_func(*args, **kwargs)
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()
        return result, execution_time

    @staticmethod
    def assert_execution_time(execution_time: float, max_time: float):
        """Assert that execution time is within acceptable limits."""
        assert (
            execution_time <= max_time
        ), f"Execution time {execution_time:.3f}s exceeded maximum {max_time}s"

    @staticmethod
    async def run_concurrent_operations(
        async_func, operations: List[tuple], max_concurrent: int = 10
    ):
        """Run multiple async operations concurrently with concurrency limit."""
        semaphore = asyncio.Semaphore(max_concurrent)

        async def run_with_semaphore(args, kwargs):
            async with semaphore:
                return await async_func(*args, **kwargs)

        tasks = [run_with_semaphore(args, kwargs) for args, kwargs in operations]

        return await asyncio.gather(*tasks, return_exceptions=True)


# Test data constants
TEST_IMAGE_FORMATS = ["JPEG", "PNG", "WEBP", "GIF"]
TEST_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
TEST_TIERS = ["bronze", "silver", "gold"]
TEST_PROCESSING_STATES = ["processed", "promoted", "rejected"]
TEST_EVENT_TYPES = ["holiday", "birthday", "custom"]
TEST_RELATIONSHIP_TYPES = [
    "spouse",
    "partner",
    "sibling",
    "parent",
    "child",
    "friend",
    "relative",
]


# Common test assertions
def assert_uuid_format(value: str):
    """Assert that a string is a valid UUID format."""
    try:
        uuid.UUID(value)
    except ValueError:
        raise AssertionError(f"'{value}' is not a valid UUID format")


def assert_datetime_recent(dt: datetime, max_age_seconds: int = 60):
    """Assert that a datetime is recent (within max_age_seconds)."""
    now = datetime.now()
    age = (now - dt).total_seconds()
    assert age <= max_age_seconds, f"Datetime {dt} is too old (age: {age:.1f}s)"


def assert_file_path_format(path: str):
    """Assert that a file path has correct format."""
    assert isinstance(path, str), "File path must be a string"
    assert len(path) > 0, "File path cannot be empty"
    assert not path.startswith("//"), "File path cannot start with '//'"
