"""
Comprehensive API Route Tests

Test suite for all API endpoints in the Pictallion Python backend,
including photo, people, collection, search, AI, and file management routes.
"""

import asyncio
import io
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List
from unittest.mock import AsyncMock, Mock, patch

import pytest
from app.main import app
from app.models import *
from fastapi.testclient import TestClient
from httpx import AsyncClient
from PIL import Image
from tests.utils import (APITestHelper, DatabaseTestHelper, FileTestHelper,
                         TestDataGenerator, assert_uuid_format)


@pytest.mark.api
class TestHealthEndpoints:
    """Test health and system endpoints."""

    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint returns basic info."""
        response = client.get("/")
        assert response.status_code == 200

        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "status" in data
        assert data["status"] == "healthy"

    def test_health_check(self, client: TestClient):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_api_response_structure(
            data, ["status", "version", "checks", "timestamp"]
        )
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "database" in data["checks"]
        assert "services" in data["checks"]

    def test_health_check_detailed(self, client: TestClient):
        """Test detailed health check endpoint."""
        response = client.get("/health/detailed")
        assert response.status_code == 200

        data = response.json()
        assert "database" in data
        assert "ai_services" in data
        assert "file_system" in data
        assert "external_apis" in data


@pytest.mark.api
class TestPhotoRoutes:
    """Test photo management API endpoints."""

    async def test_list_photos(self, async_client: AsyncClient, db_session):
        """Test photo listing with pagination."""
        # Create test photos
        for i in range(15):
            await DatabaseTestHelper.create_test_file_version(
                db_session, rating=i % 5 + 1
            )

        response = await async_client.get("/api/photos/")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) <= 10  # Default page size
        assert data["total"] == 15

    async def test_list_photos_with_filters(
        self, async_client: AsyncClient, db_session
    ):
        """Test photo listing with filters."""
        # Create photos with different ratings
        high_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=5, keywords=["vacation", "beach"]
        )
        low_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=2, keywords=["work", "office"]
        )

        # Filter by rating
        response = await async_client.get("/api/photos/?min_rating=4")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["id"] == high_rated.id

    async def test_get_photo_by_id(self, async_client: AsyncClient, db_session):
        """Test getting specific photo by ID."""
        photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            rating=4,
            keywords=["test", "photo"],
            ai_short_description="A test photo",
        )

        response = await async_client.get(f"/api/photos/{photo.id}")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_api_response_structure(
            data, ["id", "tier", "file_path", "rating", "keywords"]
        )
        assert data["id"] == photo.id
        assert data["rating"] == 4
        assert "test" in data["keywords"]

    async def test_get_nonexistent_photo(self, async_client: AsyncClient):
        """Test getting non-existent photo returns 404."""
        response = await async_client.get("/api/photos/nonexistent-id")
        assert response.status_code == 404

        data = response.json()
        assert "detail" in data

    async def test_update_photo(self, async_client: AsyncClient, db_session):
        """Test updating photo metadata."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        update_data = {
            "rating": 5,
            "keywords": ["updated", "photo", "test"],
            "is_reviewed": True,
        }

        response = await async_client.put(f"/api/photos/{photo.id}", json=update_data)
        assert response.status_code == 200

        data = response.json()
        assert data["rating"] == 5
        assert "updated" in data["keywords"]
        assert data["is_reviewed"] is True

    async def test_delete_photo(self, async_client: AsyncClient, db_session):
        """Test photo deletion."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        response = await async_client.delete(f"/api/photos/{photo.id}")
        assert response.status_code == 200

        # Verify photo is deleted
        get_response = await async_client.get(f"/api/photos/{photo.id}")
        assert get_response.status_code == 404

    async def test_get_photo_metadata(self, async_client: AsyncClient, db_session):
        """Test getting photo metadata."""
        metadata = {
            "exif": TestDataGenerator.generate_exif_metadata(),
            "ai": TestDataGenerator.generate_ai_metadata(),
        }
        photo = await DatabaseTestHelper.create_test_file_version(
            db_session, metadata=metadata
        )

        response = await async_client.get(f"/api/photos/{photo.id}/metadata")
        assert response.status_code == 200

        data = response.json()
        assert "exif" in data
        assert "ai" in data
        assert data["exif"]["camera"] == metadata["exif"]["camera"]

    async def test_bulk_update_photos(self, async_client: AsyncClient, db_session):
        """Test bulk photo updates."""
        photos = []
        for i in range(3):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            photos.append(photo)

        bulk_update = {
            "photo_ids": [photo.id for photo in photos],
            "updates": {"rating": 4, "keywords": ["bulk", "updated"]},
        }

        response = await async_client.post("/api/photos/bulk-update", json=bulk_update)
        assert response.status_code == 200

        data = response.json()
        assert data["updated_count"] == 3

    async def test_get_photo_similar(self, async_client: AsyncClient, db_session):
        """Test finding similar photos."""
        photo = await DatabaseTestHelper.create_test_file_version(
            db_session, perceptual_hash="abcd1234efgh5678"
        )
        similar_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, perceptual_hash="abcd1234efgh5679"  # Very similar
        )

        response = await async_client.get(f"/api/photos/{photo.id}/similar")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        # Should find similar photos based on perceptual hash


@pytest.mark.api
class TestPeopleRoutes:
    """Test people management API endpoints."""

    async def test_list_people(self, async_client: AsyncClient, db_session):
        """Test people listing."""
        # Create test people
        for i in range(5):
            await DatabaseTestHelper.create_test_person(
                db_session, name=f"Person {i+1}", face_count=i
            )

        response = await async_client.get("/api/people/")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) == 5

    async def test_get_person_by_id(self, async_client: AsyncClient, db_session):
        """Test getting specific person by ID."""
        person = await DatabaseTestHelper.create_test_person(
            db_session, name="John Doe", notes="Test person", face_count=5
        )

        response = await async_client.get(f"/api/people/{person.id}")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_api_response_structure(
            data, ["id", "name", "face_count", "created_at"]
        )
        assert data["name"] == "John Doe"
        assert data["face_count"] == 5

    async def test_create_person(self, async_client: AsyncClient, db_session):
        """Test person creation."""
        person_data = {
            "name": "New Person",
            "notes": "Created via API",
            "birthdate": "1990-05-15T00:00:00",
        }

        response = await async_client.post("/api/people/", json=person_data)
        assert response.status_code == 201

        data = response.json()
        assert_uuid_format(data["id"])
        assert data["name"] == "New Person"
        assert data["notes"] == "Created via API"

    async def test_update_person(self, async_client: AsyncClient, db_session):
        """Test person updates."""
        person = await DatabaseTestHelper.create_test_person(db_session)

        update_data = {"name": "Updated Name", "notes": "Updated notes"}

        response = await async_client.put(f"/api/people/{person.id}", json=update_data)
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["notes"] == "Updated notes"

    async def test_delete_person(self, async_client: AsyncClient, db_session):
        """Test person deletion."""
        person = await DatabaseTestHelper.create_test_person(db_session)

        response = await async_client.delete(f"/api/people/{person.id}")
        assert response.status_code == 200

        # Verify person is deleted
        get_response = await async_client.get(f"/api/people/{person.id}")
        assert get_response.status_code == 404

    async def test_get_person_photos(self, async_client: AsyncClient, db_session):
        """Test getting photos for a person."""
        person = await DatabaseTestHelper.create_test_person(db_session)

        # Create photos with faces
        for i in range(3):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            await DatabaseTestHelper.create_test_face(
                db_session, file_version=photo, person=person
            )

        response = await async_client.get(f"/api/people/{person.id}/photos")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) == 3

    async def test_search_people(self, async_client: AsyncClient, db_session):
        """Test people search functionality."""
        await DatabaseTestHelper.create_test_person(db_session, name="John Smith")
        await DatabaseTestHelper.create_test_person(db_session, name="Jane Doe")
        await DatabaseTestHelper.create_test_person(db_session, name="Johnny Walker")

        response = await async_client.get("/api/people/search?q=John")
        assert response.status_code == 200

        data = response.json()
        assert len(data) >= 2  # Should find "John Smith" and "Johnny Walker"
        names = [person["name"] for person in data]
        assert any("John" in name for name in names)

    async def test_merge_people(self, async_client: AsyncClient, db_session):
        """Test merging people functionality."""
        person1 = await DatabaseTestHelper.create_test_person(
            db_session, name="Person 1"
        )
        person2 = await DatabaseTestHelper.create_test_person(
            db_session, name="Person 2"
        )

        # Create faces for both people
        photo1 = await DatabaseTestHelper.create_test_file_version(db_session)
        photo2 = await DatabaseTestHelper.create_test_file_version(db_session)

        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo1, person=person1
        )
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo2, person=person2
        )

        merge_data = {"source_person_id": person2.id, "target_person_id": person1.id}

        response = await async_client.post("/api/people/merge", json=merge_data)
        assert response.status_code == 200

        data = response.json()
        assert "merged_faces_count" in data
        assert data["merged_faces_count"] >= 1


@pytest.mark.api
class TestCollectionRoutes:
    """Test collection management API endpoints."""

    async def test_list_collections(self, async_client: AsyncClient, db_session):
        """Test collection listing."""
        # Create test collections
        for i in range(3):
            await DatabaseTestHelper.create_test_collection(
                db_session, name=f"Collection {i+1}", is_public=(i % 2 == 0)
            )

        response = await async_client.get("/api/collections/")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) == 3

    async def test_create_collection(self, async_client: AsyncClient, db_session):
        """Test collection creation."""
        collection_data = {
            "name": "New Collection",
            "description": "Created via API",
            "is_public": True,
        }

        response = await async_client.post("/api/collections/", json=collection_data)
        assert response.status_code == 201

        data = response.json()
        assert_uuid_format(data["id"])
        assert data["name"] == "New Collection"
        assert data["is_public"] is True

    async def test_create_smart_collection(self, async_client: AsyncClient, db_session):
        """Test smart collection creation."""
        smart_rules = {
            "rules": [
                {"field": "rating", "operator": "greater_than", "value": 3},
                {"field": "keywords", "operator": "contains", "value": "vacation"},
            ],
            "operator": "AND",
        }

        collection_data = {
            "name": "High Rated Vacation Photos",
            "is_smart_collection": True,
            "smart_rules": smart_rules,
        }

        response = await async_client.post("/api/collections/", json=collection_data)
        assert response.status_code == 201

        data = response.json()
        assert data["is_smart_collection"] is True
        assert data["smart_rules"]["operator"] == "AND"

    async def test_get_collection_photos(self, async_client: AsyncClient, db_session):
        """Test getting photos in a collection."""
        collection = await DatabaseTestHelper.create_test_collection(db_session)

        # Add photos to collection
        for i in range(3):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            collection_photo = CollectionPhoto(
                collection_id=collection.id, photo_id=photo.id
            )
            db_session.add(collection_photo)

        await db_session.commit()

        response = await async_client.get(f"/api/collections/{collection.id}/photos")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) == 3

    async def test_add_photos_to_collection(
        self, async_client: AsyncClient, db_session
    ):
        """Test adding photos to collection."""
        collection = await DatabaseTestHelper.create_test_collection(db_session)
        photos = []

        for i in range(2):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            photos.append(photo)

        add_data = {"photo_ids": [photo.id for photo in photos]}

        response = await async_client.post(
            f"/api/collections/{collection.id}/photos", json=add_data
        )
        assert response.status_code == 200

        data = response.json()
        assert data["added_count"] == 2

    async def test_remove_photos_from_collection(
        self, async_client: AsyncClient, db_session
    ):
        """Test removing photos from collection."""
        collection = await DatabaseTestHelper.create_test_collection(db_session)
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        # Add photo to collection first
        collection_photo = CollectionPhoto(
            collection_id=collection.id, photo_id=photo.id
        )
        db_session.add(collection_photo)
        await db_session.commit()

        response = await async_client.delete(
            f"/api/collections/{collection.id}/photos/{photo.id}"
        )
        assert response.status_code == 200

    async def test_update_collection(self, async_client: AsyncClient, db_session):
        """Test collection updates."""
        collection = await DatabaseTestHelper.create_test_collection(db_session)

        update_data = {
            "name": "Updated Collection",
            "description": "Updated description",
            "is_public": not collection.is_public,
        }

        response = await async_client.put(
            f"/api/collections/{collection.id}", json=update_data
        )
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Updated Collection"
        assert data["is_public"] == (not collection.is_public)


@pytest.mark.api
class TestSearchRoutes:
    """Test search API endpoints."""

    async def test_text_search(self, async_client: AsyncClient, db_session):
        """Test text-based search."""
        # Create photos with searchable content
        photo1 = await DatabaseTestHelper.create_test_file_version(
            db_session,
            keywords=["sunset", "beach", "vacation"],
            ai_short_description="Beautiful sunset at the beach",
        )
        photo2 = await DatabaseTestHelper.create_test_file_version(
            db_session,
            keywords=["mountain", "hiking"],
            ai_short_description="Mountain hiking trail",
        )

        response = await async_client.get("/api/search?q=sunset")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)

        # Should find photo1 but not photo2
        result_ids = [item["id"] for item in data["items"]]
        assert photo1.id in result_ids

    async def test_advanced_search(self, async_client: AsyncClient, db_session):
        """Test advanced search with multiple criteria."""
        # Create test photos
        target_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            rating=5,
            keywords=["vacation", "beach"],
            location="40.7589,-73.9851",
        )
        other_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=2, keywords=["work"]
        )

        search_params = {
            "min_rating": 4,
            "keywords": ["vacation"],
            "has_location": True,
        }

        response = await async_client.post("/api/search/advanced", json=search_params)
        assert response.status_code == 200

        data = response.json()
        result_ids = [item["id"] for item in data["items"]]
        assert target_photo.id in result_ids
        assert other_photo.id not in result_ids

    async def test_search_by_face(self, async_client: AsyncClient, db_session):
        """Test face-based search."""
        person = await DatabaseTestHelper.create_test_person(db_session)
        photo_with_person = await DatabaseTestHelper.create_test_file_version(
            db_session
        )
        photo_without_person = await DatabaseTestHelper.create_test_file_version(
            db_session
        )

        # Add face to one photo
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo_with_person, person=person
        )

        response = await async_client.get(f"/api/search/faces?person_id={person.id}")
        assert response.status_code == 200

        data = response.json()
        result_ids = [item["id"] for item in data["items"]]
        assert photo_with_person.id in result_ids
        assert photo_without_person.id not in result_ids

    async def test_search_by_location(self, async_client: AsyncClient, db_session):
        """Test location-based search."""
        # Central Park area
        central_park_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, location="40.7812,-73.9665"
        )
        # Times Square area
        times_square_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, location="40.7580,-73.9855"
        )

        # Search near Central Park
        params = {"latitude": 40.7812, "longitude": -73.9665, "radius_km": 1.0}

        response = await async_client.get("/api/search/location", params=params)
        assert response.status_code == 200

        data = response.json()
        # Should find central_park_photo within radius
        assert len(data["items"]) >= 1

    async def test_search_suggestions(self, async_client: AsyncClient, db_session):
        """Test search suggestions/autocomplete."""
        # Create photos with various keywords
        await DatabaseTestHelper.create_test_file_version(
            db_session, keywords=["vacation", "beach", "summer"]
        )
        await DatabaseTestHelper.create_test_file_version(
            db_session, keywords=["vacation", "mountain", "winter"]
        )

        response = await async_client.get("/api/search/suggestions?q=vac")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        suggestions = [item["text"] for item in data]
        assert "vacation" in suggestions


@pytest.mark.api
class TestAIRoutes:
    """Test AI processing API endpoints."""

    async def test_analyze_photo(self, async_client: AsyncClient, db_session):
        """Test AI photo analysis."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        with patch("app.services.ai_service.ai_service.analyze_image") as mock_analyze:
            mock_analyze.return_value = {
                "tags": ["landscape", "nature"],
                "description": "Beautiful landscape photo",
                "confidence": 92,
                "provider": "mock",
            }

            response = await async_client.post(f"/api/ai/analyze/{photo.id}")
            assert response.status_code == 200

            data = response.json()
            assert "tags" in data
            assert "description" in data
            assert "confidence" in data
            assert data["confidence"] > 0

    async def test_batch_analyze_photos(self, async_client: AsyncClient, db_session):
        """Test batch AI analysis."""
        photos = []
        for i in range(3):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            photos.append(photo)

        with patch("app.services.ai_service.ai_service.analyze_image") as mock_analyze:
            mock_analyze.return_value = {
                "tags": ["test", "photo"],
                "description": "Test photo",
                "confidence": 85,
                "provider": "mock",
            }

            batch_data = {"photo_ids": [photo.id for photo in photos]}

            response = await async_client.post("/api/ai/batch-analyze", json=batch_data)
            assert response.status_code == 200

            data = response.json()
            assert "results" in data
            assert len(data["results"]) == 3

    async def test_generate_tags(self, async_client: AsyncClient, db_session):
        """Test AI tag generation."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        with patch("app.services.ai_service.ai_service.generate_tags") as mock_tags:
            mock_tags.return_value = ["nature", "landscape", "outdoor"]

            response = await async_client.post(f"/api/ai/tags/{photo.id}")
            assert response.status_code == 200

            data = response.json()
            assert "tags" in data
            assert isinstance(data["tags"], list)
            assert len(data["tags"]) > 0

    async def test_ai_health_check(self, async_client: AsyncClient):
        """Test AI services health check."""
        with patch("app.services.ai_service.ai_service.health_check") as mock_health:
            mock_health.return_value = {
                "openai": {"available": True, "model": "gpt-4"},
                "ollama": {"available": False, "error": "Connection failed"},
            }

            response = await async_client.get("/api/ai/health")
            assert response.status_code == 200

            data = response.json()
            assert "openai" in data
            assert "ollama" in data

    async def test_ai_prompts(self, async_client: AsyncClient, db_session):
        """Test AI prompt management."""
        # Create test prompt
        prompt_data = {
            "name": "Test Analysis",
            "category": "analysis",
            "provider": "openai",
            "system_prompt": "You are an expert image analyst",
            "user_prompt": "Analyze this image: {image}",
            "is_active": True,
        }

        response = await async_client.post("/api/ai/prompts", json=prompt_data)
        assert response.status_code == 201

        data = response.json()
        assert_uuid_format(data["id"])
        assert data["name"] == "Test Analysis"

        # Test getting prompts
        response = await async_client.get("/api/ai/prompts")
        assert response.status_code == 200

        data = response.json()
        assert len(data) >= 1


@pytest.mark.api
class TestFaceRoutes:
    """Test face detection and management API endpoints."""

    async def test_detect_faces_in_photo(self, async_client: AsyncClient, db_session):
        """Test face detection in photo."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        with patch(
            "app.services.face_detection_service.face_detection_service.detect_faces"
        ) as mock_detect:
            mock_detect.return_value = [
                {
                    "location": {"top": 10, "left": 20, "bottom": 100, "right": 120},
                    "encoding": [0.1] * 128,
                    "confidence": 95,
                }
            ]

            response = await async_client.post(f"/api/faces/detect/{photo.id}")
            assert response.status_code == 200

            data = response.json()
            assert "faces" in data
            assert len(data["faces"]) == 1

            face = data["faces"][0]
            assert "location" in face
            assert "confidence" in face

    async def test_list_unassigned_faces(self, async_client: AsyncClient, db_session):
        """Test listing unassigned faces."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        # Create unassigned face
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo, person=None
        )

        response = await async_client.get("/api/faces/unassigned")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) >= 1

    async def test_assign_face_to_person(self, async_client: AsyncClient, db_session):
        """Test assigning face to person."""
        person = await DatabaseTestHelper.create_test_person(db_session)
        photo = await DatabaseTestHelper.create_test_file_version(db_session)
        face = await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo, person=None
        )

        assign_data = {"person_id": person.id}

        response = await async_client.post(
            f"/api/faces/{face.id}/assign", json=assign_data
        )
        assert response.status_code == 200

        data = response.json()
        assert data["person_id"] == person.id

    async def test_ignore_face(self, async_client: AsyncClient, db_session):
        """Test ignoring/hiding face."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)
        face = await DatabaseTestHelper.create_test_face(db_session, file_version=photo)

        response = await async_client.post(f"/api/faces/{face.id}/ignore")
        assert response.status_code == 200

        data = response.json()
        assert data["ignored"] is True

    async def test_face_similarity_search(self, async_client: AsyncClient, db_session):
        """Test finding similar faces."""
        person = await DatabaseTestHelper.create_test_person(db_session)
        photo = await DatabaseTestHelper.create_test_file_version(db_session)
        face = await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo, person=person
        )

        with patch(
            "app.services.face_detection_service.face_detection_service.find_similar_faces"
        ) as mock_similar:
            mock_similar.return_value = [
                {"face_id": "similar-face-1", "similarity": 0.95},
                {"face_id": "similar-face-2", "similarity": 0.87},
            ]

            response = await async_client.get(f"/api/faces/{face.id}/similar")
            assert response.status_code == 200

            data = response.json()
            assert isinstance(data, list)
            assert len(data) >= 1


@pytest.mark.api
class TestFileRoutes:
    """Test file management API endpoints."""

    async def test_upload_file(self, async_client: AsyncClient, sample_image_path):
        """Test file upload."""
        with open(sample_image_path, "rb") as f:
            files = {"file": ("test_image.jpg", f, "image/jpeg")}
            response = await async_client.post("/api/files/upload", files=files)

        assert response.status_code == 201

        data = response.json()
        assert "file_id" in data
        assert "file_path" in data
        assert "tier" in data
        assert_uuid_format(data["file_id"])

    async def test_upload_multiple_files(self, async_client: AsyncClient, temp_dir):
        """Test multiple file upload."""
        # Create multiple test images
        files_data = []
        for i in range(3):
            image_path = FileTestHelper.create_test_image_file(
                temp_dir / f"test_{i}.jpg", format="JPEG"
            )
            files_data.append(
                ("files", (f"test_{i}.jpg", open(image_path, "rb"), "image/jpeg"))
            )

        try:
            response = await async_client.post(
                "/api/files/upload-multiple", files=files_data
            )
            assert response.status_code == 201

            data = response.json()
            assert "uploaded_files" in data
            assert len(data["uploaded_files"]) == 3
        finally:
            # Close all file handles
            for _, (_, file_handle, _) in files_data:
                file_handle.close()

    async def test_get_file_info(self, async_client: AsyncClient, db_session):
        """Test getting file information."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        response = await async_client.get(f"/api/files/{photo.id}/info")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_api_response_structure(
            data, ["id", "file_path", "file_size", "mime_type", "file_hash"]
        )

    async def test_download_file(self, async_client: AsyncClient, db_session):
        """Test file download."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        with patch("aiofiles.open") as mock_open:
            mock_file = AsyncMock()
            mock_file.read.return_value = b"fake_image_data"
            mock_open.return_value.__aenter__.return_value = mock_file

            response = await async_client.get(f"/api/files/{photo.id}/download")
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("image/")

    async def test_get_thumbnail(self, async_client: AsyncClient, db_session):
        """Test thumbnail retrieval."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        with patch(
            "app.services.thumbnail_service.thumbnail_service.get_thumbnail_path"
        ) as mock_thumbnail:
            mock_thumbnail.return_value = "/path/to/thumbnail.jpg"

            response = await async_client.get(
                f"/api/files/{photo.id}/thumbnail?size=300"
            )
            assert response.status_code == 200

    async def test_delete_file(self, async_client: AsyncClient, db_session):
        """Test file deletion."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)

        with patch(
            "app.services.file_manager_service.file_manager_service.delete_file"
        ) as mock_delete:
            mock_delete.return_value = True

            response = await async_client.delete(f"/api/files/{photo.id}")
            assert response.status_code == 200


@pytest.mark.api
class TestEventRoutes:
    """Test event management API endpoints."""

    async def test_list_events(self, async_client: AsyncClient, db_session):
        """Test event listing."""
        # Create test events
        christmas = Event(
            name="Christmas",
            type="holiday",
            date=datetime(2024, 12, 25),
            is_recurring=True,
            recurring_type="yearly",
        )
        db_session.add(christmas)
        await db_session.commit()

        response = await async_client.get("/api/events/")
        assert response.status_code == 200

        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) >= 1

    async def test_create_event(self, async_client: AsyncClient):
        """Test event creation."""
        event_data = {
            "name": "New Year's Eve",
            "type": "holiday",
            "date": "2024-12-31T23:00:00",
            "is_recurring": True,
            "recurring_type": "yearly",
            "description": "New Year celebration",
        }

        response = await async_client.post("/api/events/", json=event_data)
        assert response.status_code == 201

        data = response.json()
        assert_uuid_format(data["id"])
        assert data["name"] == "New Year's Eve"
        assert data["type"] == "holiday"

    async def test_detect_events(self, async_client: AsyncClient, db_session):
        """Test automatic event detection."""
        # Create photos on holiday dates
        christmas_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, metadata={"exif": {"date_taken": "2024-12-25T12:00:00"}}
        )

        with patch(
            "app.services.event_detection_service.event_detection_service.detect_events_in_photos"
        ) as mock_detect:
            mock_detect.return_value = [
                {
                    "event_type": "holiday",
                    "event_name": "Christmas",
                    "date": "2024-12-25",
                    "photos": [christmas_photo.id],
                    "confidence": 95,
                }
            ]

            response = await async_client.post("/api/events/detect")
            assert response.status_code == 200

            data = response.json()
            assert "detected_events" in data
            assert len(data["detected_events"]) >= 1


@pytest.mark.api
class TestErrorHandling:
    """Test API error handling and edge cases."""

    async def test_invalid_uuid_format(self, async_client: AsyncClient):
        """Test handling of invalid UUID format."""
        response = await async_client.get("/api/photos/invalid-uuid")
        assert response.status_code == 422  # Validation error

        data = response.json()
        assert "detail" in data

    async def test_missing_required_fields(self, async_client: AsyncClient):
        """Test handling of missing required fields."""
        response = await async_client.post("/api/people/", json={})
        assert response.status_code == 422

        data = response.json()
        assert "detail" in data

    async def test_invalid_file_upload(self, async_client: AsyncClient, temp_dir):
        """Test handling of invalid file upload."""
        # Create non-image file
        text_file = temp_dir / "test.txt"
        text_file.write_text("This is not an image")

        with open(text_file, "rb") as f:
            files = {"file": ("test.txt", f, "text/plain")}
            response = await async_client.post("/api/files/upload", files=files)

        assert response.status_code == 400

        data = response.json()
        assert "detail" in data

    async def test_rate_limiting(self, async_client: AsyncClient):
        """Test rate limiting on API endpoints."""
        # This test would depend on rate limiting configuration
        # For now, just ensure the endpoint responds
        responses = []
        for i in range(10):
            response = await async_client.get("/api/photos/")
            responses.append(response.status_code)

        # Should mostly get 200s, maybe some 429s if rate limited
        success_count = sum(1 for status in responses if status == 200)
        assert success_count > 0

    async def test_cors_headers(self, async_client: AsyncClient):
        """Test CORS headers are present."""
        response = await async_client.options("/api/photos/")
        assert response.status_code in [200, 405]  # OPTIONS might not be implemented

        # Check GET request has CORS headers
        response = await async_client.get("/api/photos/")
        # CORS headers should be present in development
        # In production, this depends on configuration


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
