"""
Integration Tests for Complete Workflows

Test suite for end-to-end workflows in the Pictallion Python backend,
covering photo upload and processing pipelines, AI analysis workflows,
collection management, and search functionality.
"""

import pytest
import asyncio
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
from unittest.mock import Mock, AsyncMock, patch

from app.models import *
from tests.utils import (
    TestDataGenerator, DatabaseTestHelper, APITestHelper,
    FileTestHelper, assert_uuid_format
)


@pytest.mark.integration
class TestPhotoUploadAndProcessingWorkflow:
    """Test complete photo upload and processing workflow."""
    
    async def test_full_photo_upload_pipeline(self, async_client, db_session, temp_dir):
        """Test complete photo upload, analysis, and indexing workflow."""
        # Create test image with EXIF data
        image_path = FileTestHelper.create_test_image_with_exif(
            temp_dir / "vacation_photo.jpg",
            exif_data={
                "DateTime": "2024:07:15 14:30:00",
                "GPS": {"latitude": 40.7589, "longitude": -73.9851},
                "Camera": "Canon EOS R5",
                "ISO": 200
            }
        )
        
        # Mock all services that would be called during upload
        with patch('app.services.ai_service.ai_service.analyze_image') as mock_ai, \
             patch('app.services.face_detection_service.face_detection_service.detect_faces') as mock_faces, \
             patch('app.services.metadata_service.metadata_service.extract_metadata') as mock_metadata, \
             patch('app.services.thumbnail_service.thumbnail_service.generate_thumbnails') as mock_thumbnails, \
             patch('app.services.duplicate_detection_service.duplicate_detection_service.check_for_duplicates') as mock_duplicates:
            
            # Configure mocks
            mock_ai.return_value = {
                "tags": ["vacation", "beach", "sunset"],
                "description": "Beautiful sunset at the beach during vacation",
                "confidence": 92,
                "provider": "openai"
            }
            
            mock_faces.return_value = [
                {
                    "location": {"top": 100, "left": 200, "bottom": 300, "right": 400},
                    "encoding": [0.1] * 128,
                    "confidence": 95
                }
            ]
            
            mock_metadata.return_value = {
                "exif": {
                    "camera": "Canon EOS R5",
                    "iso": 200,
                    "date_taken": "2024-07-15T14:30:00",
                    "gps": {"latitude": 40.7589, "longitude": -73.9851}
                },
                "file": {
                    "size": 2048000,
                    "format": "JPEG",
                    "dimensions": {"width": 1920, "height": 1080}
                }
            }
            
            mock_thumbnails.return_value = {
                "small": "/thumbnails/small_123.jpg",
                "medium": "/thumbnails/medium_123.jpg",
                "large": "/thumbnails/large_123.jpg"
            }
            
            mock_duplicates.return_value = []
            
            # Step 1: Upload photo
            with open(image_path, "rb") as f:
                files = {"file": ("vacation_photo.jpg", f, "image/jpeg")}
                upload_response = await async_client.post("/api/files/upload", files=files)
            
            assert upload_response.status_code == 201
            upload_data = upload_response.json()
            photo_id = upload_data["file_id"]
            
            # Step 2: Verify photo was created in database
            photo_response = await async_client.get(f"/api/photos/{photo_id}")
            assert photo_response.status_code == 200
            photo_data = photo_response.json()
            
            # Step 3: Trigger AI analysis
            ai_response = await async_client.post(f"/api/ai/analyze/{photo_id}")
            assert ai_response.status_code == 200
            ai_data = ai_response.json()
            
            # Verify AI analysis results
            assert "vacation" in ai_data["tags"]
            assert "beach" in ai_data["tags"]
            assert ai_data["confidence"] > 90
            
            # Step 4: Trigger face detection
            face_response = await async_client.post(f"/api/faces/detect/{photo_id}")
            assert face_response.status_code == 200
            face_data = face_response.json()
            
            # Verify face detection results
            assert len(face_data["faces"]) == 1
            face = face_data["faces"][0]
            assert face["confidence"] == 95
            
            # Step 5: Verify photo is searchable
            search_response = await async_client.get("/api/search?q=vacation")
            assert search_response.status_code == 200
            search_data = search_response.json()
            
            # Photo should appear in search results
            photo_ids = [item["id"] for item in search_data["items"]]
            assert photo_id in photo_ids
            
            # Step 6: Verify location-based search works
            location_response = await async_client.get(
                "/api/search/location?latitude=40.7589&longitude=-73.9851&radius_km=1"
            )
            assert location_response.status_code == 200
            location_data = location_response.json()
            
            # Photo should appear in location search
            location_photo_ids = [item["id"] for item in location_data["items"]]
            assert photo_id in location_photo_ids
    
    async def test_batch_photo_processing_workflow(self, async_client, db_session, temp_dir):
        """Test batch photo upload and processing workflow."""
        # Create multiple test images
        image_paths = []
        for i in range(5):
            image_path = FileTestHelper.create_test_image_file(
                temp_dir / f"batch_photo_{i}.jpg", format="JPEG"
            )
            image_paths.append(image_path)
        
        with patch('app.services.ai_service.ai_service.analyze_image') as mock_ai:
            mock_ai.return_value = {
                "tags": ["batch", "test"],
                "description": "Batch processed photo",
                "confidence": 85,
                "provider": "openai"
            }
            
            # Upload multiple files
            files_data = []
            for i, image_path in enumerate(image_paths):
                files_data.append(
                    ("files", (f"batch_photo_{i}.jpg", open(image_path, "rb"), "image/jpeg"))
                )
            
            try:
                upload_response = await async_client.post(
                    "/api/files/upload-multiple", 
                    files=files_data
                )
                assert upload_response.status_code == 201
                upload_data = upload_response.json()
                
                photo_ids = [file["file_id"] for file in upload_data["uploaded_files"]]
                assert len(photo_ids) == 5
                
                # Trigger batch AI analysis
                batch_data = {"photo_ids": photo_ids}
                batch_response = await async_client.post(
                    "/api/ai/batch-analyze", 
                    json=batch_data
                )
                assert batch_response.status_code == 200
                batch_results = batch_response.json()
                
                # Verify all photos were processed
                assert len(batch_results["results"]) == 5
                
            finally:
                # Close file handles
                for _, (_, file_handle, _) in files_data:
                    file_handle.close()


@pytest.mark.integration
class TestPeopleManagementWorkflow:
    """Test complete people management workflow."""
    
    async def test_person_identification_workflow(self, async_client, db_session, temp_dir):
        """Test person identification and photo association workflow."""
        # Step 1: Create a person
        person_data = {
            "name": "John Doe",
            "notes": "Test person for workflow"
        }
        
        person_response = await async_client.post("/api/people/", json=person_data)
        assert person_response.status_code == 201
        person_data = person_response.json()
        person_id = person_data["id"]
        
        # Step 2: Upload photos with faces
        photos_with_faces = []
        for i in range(3):
            image_path = FileTestHelper.create_test_image_file(
                temp_dir / f"person_photo_{i}.jpg", format="JPEG"
            )
            
            with patch('app.services.face_detection_service.face_detection_service.detect_faces') as mock_faces:
                mock_faces.return_value = [
                    {
                        "location": {"top": 50, "left": 100, "bottom": 200, "right": 250},
                        "encoding": [0.2 + i * 0.01] * 128,  # Slightly different encodings
                        "confidence": 90 + i
                    }
                ]
                
                with open(image_path, "rb") as f:
                    files = {"file": (f"person_photo_{i}.jpg", f, "image/jpeg")}
                    upload_response = await async_client.post("/api/files/upload", files=files)
                
                assert upload_response.status_code == 201
                upload_data = upload_response.json()
                photo_id = upload_data["file_id"]
                
                # Detect faces in the uploaded photo
                face_response = await async_client.post(f"/api/faces/detect/{photo_id}")
                assert face_response.status_code == 200
                face_data = face_response.json()
                
                photos_with_faces.append({
                    "photo_id": photo_id,
                    "faces": face_data["faces"]
                })
        
        # Step 3: Get unassigned faces
        unassigned_response = await async_client.get("/api/faces/unassigned")
        assert unassigned_response.status_code == 200
        unassigned_data = unassigned_response.json()
        
        # Should have detected faces from uploaded photos
        assert len(unassigned_data["items"]) >= 3
        
        # Step 4: Assign faces to the person
        assigned_faces = []
        for face in unassigned_data["items"][:3]:  # Assign first 3 faces
            assign_data = {"person_id": person_id}
            assign_response = await async_client.post(
                f"/api/faces/{face['id']}/assign",
                json=assign_data
            )
            assert assign_response.status_code == 200
            assigned_faces.append(face["id"])
        
        # Step 5: Verify person now has associated photos
        person_photos_response = await async_client.get(f"/api/people/{person_id}/photos")
        assert person_photos_response.status_code == 200
        person_photos_data = person_photos_response.json()
        
        # Should have 3 photos associated with the person
        assert len(person_photos_data["items"]) == 3
        
        # Step 6: Search for photos by person
        face_search_response = await async_client.get(f"/api/search/faces?person_id={person_id}")
        assert face_search_response.status_code == 200
        face_search_data = face_search_response.json()
        
        # Should find all photos with this person
        assert len(face_search_data["items"]) == 3
    
    async def test_person_merging_workflow(self, async_client, db_session, temp_dir):
        """Test workflow for merging duplicate people."""
        # Step 1: Create two people (duplicates)
        person1_data = {"name": "Jane Smith", "notes": "First instance"}
        person2_data = {"name": "Jane Smith", "notes": "Duplicate instance"}
        
        person1_response = await async_client.post("/api/people/", json=person1_data)
        person2_response = await async_client.post("/api/people/", json=person2_data)
        
        assert person1_response.status_code == 201
        assert person2_response.status_code == 201
        
        person1_id = person1_response.json()["id"]
        person2_id = person2_response.json()["id"]
        
        # Step 2: Create photos and assign faces to both people
        for person_id, suffix in [(person1_id, "a"), (person2_id, "b")]:
            for i in range(2):
                photo = await DatabaseTestHelper.create_test_file_version(db_session)
                face = await DatabaseTestHelper.create_test_face(
                    db_session, 
                    file_version=photo,
                    person_id=person_id
                )
        
        # Step 3: Verify both people have faces
        person1_photos = await async_client.get(f"/api/people/{person1_id}/photos")
        person2_photos = await async_client.get(f"/api/people/{person2_id}/photos")
        
        assert len(person1_photos.json()["items"]) == 2
        assert len(person2_photos.json()["items"]) == 2
        
        # Step 4: Merge person2 into person1
        merge_data = {
            "source_person_id": person2_id,
            "target_person_id": person1_id
        }
        
        merge_response = await async_client.post("/api/people/merge", json=merge_data)
        assert merge_response.status_code == 200
        merge_result = merge_response.json()
        
        # Step 5: Verify merge results
        assert merge_result["merged_faces_count"] == 2
        
        # Person1 should now have all faces
        person1_final_photos = await async_client.get(f"/api/people/{person1_id}/photos")
        assert len(person1_final_photos.json()["items"]) == 4
        
        # Person2 should be deleted or have no faces
        person2_final = await async_client.get(f"/api/people/{person2_id}")
        # Depending on implementation, person might be deleted or just have no faces
        if person2_final.status_code == 200:
            person2_final_photos = await async_client.get(f"/api/people/{person2_id}/photos")
            assert len(person2_final_photos.json()["items"]) == 0


@pytest.mark.integration
class TestCollectionManagementWorkflow:
    """Test complete collection management workflow."""
    
    async def test_manual_collection_workflow(self, async_client, db_session):
        """Test creating and managing manual collections."""
        # Step 1: Create photos
        photos = []
        for i in range(5):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                keywords=["vacation", "beach"] if i < 3 else ["work", "office"],
                rating=5 if i < 3 else 2
            )
            photos.append(photo)
        
        # Step 2: Create a manual collection
        collection_data = {
            "name": "Vacation Photos",
            "description": "Best photos from our vacation",
            "is_public": False
        }
        
        collection_response = await async_client.post("/api/collections/", json=collection_data)
        assert collection_response.status_code == 201
        collection_data = collection_response.json()
        collection_id = collection_data["id"]
        
        # Step 3: Add selected photos to collection
        vacation_photos = photos[:3]  # First 3 photos
        add_data = {
            "photo_ids": [photo.id for photo in vacation_photos]
        }
        
        add_response = await async_client.post(
            f"/api/collections/{collection_id}/photos",
            json=add_data
        )
        assert add_response.status_code == 200
        add_result = add_response.json()
        assert add_result["added_count"] == 3
        
        # Step 4: Verify photos are in collection
        collection_photos_response = await async_client.get(
            f"/api/collections/{collection_id}/photos"
        )
        assert collection_photos_response.status_code == 200
        collection_photos_data = collection_photos_response.json()
        
        assert len(collection_photos_data["items"]) == 3
        
        # Step 5: Remove one photo from collection
        remove_photo = vacation_photos[0]
        remove_response = await async_client.delete(
            f"/api/collections/{collection_id}/photos/{remove_photo.id}"
        )
        assert remove_response.status_code == 200
        
        # Step 6: Verify photo was removed
        final_photos_response = await async_client.get(
            f"/api/collections/{collection_id}/photos"
        )
        final_photos_data = final_photos_response.json()
        assert len(final_photos_data["items"]) == 2
        
        remaining_ids = [item["id"] for item in final_photos_data["items"]]
        assert remove_photo.id not in remaining_ids
    
    async def test_smart_collection_workflow(self, async_client, db_session):
        """Test creating and managing smart collections."""
        # Step 1: Create photos with various attributes
        photos = []
        for i in range(10):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                rating=1 + (i % 5),  # Ratings from 1-5
                keywords=["vacation"] if i < 5 else ["work"],
                location="40.7589,-73.9851" if i % 2 == 0 else None
            )
            photos.append(photo)
        
        # Step 2: Create smart collection for high-rated vacation photos
        smart_rules = {
            "rules": [
                {"field": "rating", "operator": "greater_than_or_equal", "value": 4},
                {"field": "keywords", "operator": "contains", "value": "vacation"}
            ],
            "operator": "AND"
        }
        
        smart_collection_data = {
            "name": "Best Vacation Photos",
            "description": "Automatically collected high-rated vacation photos",
            "is_smart_collection": True,
            "smart_rules": smart_rules
        }
        
        smart_response = await async_client.post("/api/collections/", json=smart_collection_data)
        assert smart_response.status_code == 201
        smart_collection = smart_response.json()
        smart_collection_id = smart_collection["id"]
        
        # Step 3: Get smart collection photos (should auto-populate)
        with patch('app.services.advanced_search_service.advanced_search_service.execute_smart_collection_query') as mock_query:
            # Mock the smart collection query to return matching photos
            matching_photos = [
                photo for photo in photos[:5]  # vacation photos
                if photo.rating >= 4
            ]
            
            mock_query.return_value = {
                "items": [{"id": photo.id, "rating": photo.rating} for photo in matching_photos],
                "total": len(matching_photos),
                "page": 1,
                "per_page": 10
            }
            
            smart_photos_response = await async_client.get(
                f"/api/collections/{smart_collection_id}/photos"
            )
            assert smart_photos_response.status_code == 200
            smart_photos_data = smart_photos_response.json()
            
            # Should automatically include high-rated vacation photos
            assert len(smart_photos_data["items"]) >= 1
            
            # Verify all returned photos meet the criteria
            for item in smart_photos_data["items"]:
                assert item["rating"] >= 4


@pytest.mark.integration
class TestSearchWorkflow:
    """Test complete search functionality workflow."""
    
    async def test_comprehensive_search_workflow(self, async_client, db_session):
        """Test various search methods and their integration."""
        # Step 1: Create diverse photo dataset
        photos_data = [
            {
                "keywords": ["vacation", "beach", "sunset"],
                "rating": 5,
                "location": "40.7589,-73.9851",  # NYC
                "ai_description": "Beautiful sunset at the beach"
            },
            {
                "keywords": ["work", "meeting", "office"],
                "rating": 3,
                "location": "34.0522,-118.2437",  # LA
                "ai_description": "Office meeting room"
            },
            {
                "keywords": ["family", "vacation", "mountains"],
                "rating": 4,
                "location": "39.7392,-104.9903",  # Denver
                "ai_description": "Family hiking in mountains"
            },
            {
                "keywords": ["food", "restaurant", "dinner"],
                "rating": 4,
                "location": "40.7589,-73.9851",  # NYC
                "ai_description": "Delicious dinner at restaurant"
            }
        ]
        
        created_photos = []
        for photo_data in photos_data:
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                keywords=photo_data["keywords"],
                rating=photo_data["rating"],
                location=photo_data["location"],
                ai_short_description=photo_data["ai_description"]
            )
            created_photos.append(photo)
        
        # Step 2: Test text search
        text_search_response = await async_client.get("/api/search?q=vacation")
        assert text_search_response.status_code == 200
        text_results = text_search_response.json()
        
        # Should find vacation photos
        vacation_results = [
            item for item in text_results["items"]
            if any("vacation" in keyword for keyword in item.get("keywords", []))
        ]
        assert len(vacation_results) >= 2
        
        # Step 3: Test advanced search
        advanced_criteria = {
            "min_rating": 4,
            "keywords": ["vacation"],
            "has_location": True
        }
        
        advanced_response = await async_client.post(
            "/api/search/advanced", 
            json=advanced_criteria
        )
        assert advanced_response.status_code == 200
        advanced_results = advanced_response.json()
        
        # Should find high-rated vacation photos with location
        assert len(advanced_results["items"]) >= 1
        for item in advanced_results["items"]:
            assert item["rating"] >= 4
            assert "vacation" in item["keywords"]
        
        # Step 4: Test location-based search
        location_response = await async_client.get(
            "/api/search/location?latitude=40.7589&longitude=-73.9851&radius_km=5"
        )
        assert location_response.status_code == 200
        location_results = location_response.json()
        
        # Should find NYC photos
        assert len(location_results["items"]) >= 2
        
        # Step 5: Test search suggestions
        suggestions_response = await async_client.get("/api/search/suggestions?q=vac")
        assert suggestions_response.status_code == 200
        suggestions = suggestions_response.json()
        
        # Should suggest "vacation"
        suggestion_texts = [item["text"] for item in suggestions]
        assert "vacation" in suggestion_texts
    
    async def test_search_with_filters_workflow(self, async_client, db_session):
        """Test search with various filters and combinations."""
        # Create photos with specific date ranges
        base_date = datetime(2024, 1, 1)
        for i in range(12):  # 12 months of photos
            month_date = base_date + timedelta(days=30 * i)
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                keywords=["monthly", f"month_{i+1}"],
                rating=(i % 5) + 1,
                metadata={
                    "exif": {
                        "date_taken": month_date.isoformat()
                    }
                }
            )
        
        # Test date range filtering
        date_search_params = {
            "start_date": "2024-06-01",
            "end_date": "2024-08-31",
            "min_rating": 3
        }
        
        date_response = await async_client.post(
            "/api/search/advanced",
            json=date_search_params
        )
        assert date_response.status_code == 200
        date_results = date_response.json()
        
        # Should find summer photos with rating >= 3
        assert len(date_results["items"]) >= 1


@pytest.mark.integration
class TestAIWorkflow:
    """Test AI processing workflows."""
    
    async def test_ai_analysis_pipeline(self, async_client, db_session, temp_dir):
        """Test complete AI analysis pipeline."""
        # Step 1: Upload photo
        image_path = FileTestHelper.create_test_image_file(
            temp_dir / "ai_test.jpg", format="JPEG"
        )
        
        with open(image_path, "rb") as f:
            files = {"file": ("ai_test.jpg", f, "image/jpeg")}
            upload_response = await async_client.post("/api/files/upload", files=files)
        
        assert upload_response.status_code == 201
        photo_id = upload_response.json()["file_id"]
        
        # Step 2: Mock AI services and run analysis
        with patch('app.services.ai_service.ai_service.analyze_image') as mock_ai, \
             patch('app.services.ai_service.ai_service.generate_tags') as mock_tags, \
             patch('app.services.ai_service.ai_service.generate_description') as mock_desc:
            
            mock_ai.return_value = {
                "tags": ["nature", "landscape", "trees"],
                "description": "A beautiful landscape with trees",
                "confidence": 88,
                "provider": "openai"
            }
            
            mock_tags.return_value = ["outdoor", "scenery", "natural"]
            mock_desc.return_value = "Scenic outdoor landscape photograph"
            
            # Run AI analysis
            analysis_response = await async_client.post(f"/api/ai/analyze/{photo_id}")
            assert analysis_response.status_code == 200
            analysis_data = analysis_response.json()
            
            # Verify analysis results
            assert "nature" in analysis_data["tags"]
            assert "landscape" in analysis_data["tags"]
            assert analysis_data["confidence"] > 80
            
            # Step 3: Generate additional tags
            tags_response = await async_client.post(f"/api/ai/tags/{photo_id}")
            assert tags_response.status_code == 200
            tags_data = tags_response.json()
            
            assert "outdoor" in tags_data["tags"]
            assert "scenery" in tags_data["tags"]
            
            # Step 4: Verify photo metadata was updated
            photo_response = await async_client.get(f"/api/photos/{photo_id}")
            photo_data = photo_response.json()
            
            # Photo should now have AI-generated keywords
            combined_keywords = photo_data.get("keywords", [])
            assert any(tag in combined_keywords for tag in ["nature", "landscape", "outdoor"])


@pytest.mark.integration
class TestPerformanceWorkflows:
    """Test performance-critical workflows."""
    
    async def test_bulk_operations_performance(self, async_client, db_session):
        """Test performance of bulk operations."""
        import time
        
        # Create many photos for bulk operations
        photo_ids = []
        for i in range(50):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session, rating=i % 5 + 1
            )
            photo_ids.append(photo.id)
        
        # Test bulk update performance
        start_time = time.time()
        
        bulk_update_data = {
            "photo_ids": photo_ids,
            "updates": {
                "rating": 5,
                "keywords": ["bulk_updated"]
            }
        }
        
        bulk_response = await async_client.post(
            "/api/photos/bulk-update",
            json=bulk_update_data
        )
        
        end_time = time.time()
        bulk_duration = end_time - start_time
        
        assert bulk_response.status_code == 200
        assert bulk_response.json()["updated_count"] == 50
        
        # Bulk update should complete in reasonable time (< 5 seconds)
        assert bulk_duration < 5.0
        
        # Test search performance with many results
        start_time = time.time()
        
        search_response = await async_client.get("/api/search?q=bulk_updated")
        
        end_time = time.time()
        search_duration = end_time - start_time
        
        assert search_response.status_code == 200
        assert len(search_response.json()["items"]) > 0
        
        # Search should be fast (< 2 seconds)
        assert search_duration < 2.0


@pytest.mark.integration
class TestErrorRecoveryWorkflows:
    """Test error handling and recovery in workflows."""
    
    async def test_upload_failure_recovery(self, async_client, temp_dir):
        """Test handling of upload failures and recovery."""
        # Create invalid file (not an image)
        invalid_file = temp_dir / "invalid.txt"
        invalid_file.write_text("This is not an image file")
        
        # Attempt upload
        with open(invalid_file, "rb") as f:
            files = {"file": ("invalid.txt", f, "text/plain")}
            response = await async_client.post("/api/files/upload", files=files)
        
        assert response.status_code == 400
        error_data = response.json()
        assert "detail" in error_data
        
        # Verify system can still handle valid uploads after failure
        valid_image = FileTestHelper.create_test_image_file(
            temp_dir / "valid.jpg", format="JPEG"
        )
        
        with open(valid_image, "rb") as f:
            files = {"file": ("valid.jpg", f, "image/jpeg")}
            response = await async_client.post("/api/files/upload", files=files)
        
        assert response.status_code == 201
    
    async def test_ai_service_failure_recovery(self, async_client, db_session):
        """Test handling of AI service failures."""
        photo = await DatabaseTestHelper.create_test_file_version(db_session)
        
        # Mock AI service failure
        with patch('app.services.ai_service.ai_service.analyze_image') as mock_ai:
            mock_ai.side_effect = Exception("AI service unavailable")
            
            response = await async_client.post(f"/api/ai/analyze/{photo.id}")
            
            # Should handle error gracefully
            assert response.status_code in [500, 503]  # Internal error or service unavailable
            
            error_data = response.json()
            assert "detail" in error_data
        
        # Verify other endpoints still work after AI failure
        photo_response = await async_client.get(f"/api/photos/{photo.id}")
        assert photo_response.status_code == 200


if __name__ == "__main__":
    # Run integration tests
    pytest.main([__file__, "-v", "-m", "integration"])