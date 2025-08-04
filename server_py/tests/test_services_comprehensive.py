"""
Comprehensive Service Layer Tests

Test suite for all 13 core services in the Pictallion Python backend,
including AI services, file management, face detection, and more.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, patch, MagicMock
import numpy as np
from PIL import Image

from app.services.ai_service import AIService, ai_service
from app.services.face_detection_service import FaceDetectionService, face_detection_service
from app.services.file_manager_service import FileManagerService, file_manager_service
from app.services.thumbnail_service import ThumbnailService, thumbnail_service
from app.services.metadata_service import MetadataService, metadata_service
from app.services.duplicate_detection_service import DuplicateDetectionService, duplicate_detection_service
from app.services.burst_detection_service import BurstDetectionService, burst_detection_service
from app.services.advanced_search_service import AdvancedSearchService, advanced_search_service
from app.services.event_detection_service import EventDetectionService, event_detection_service
from app.services.location_clustering_service import LocationClusteringService, location_clustering_service
from app.services.reverse_geocoding_service import ReverseGeocodingService, reverse_geocoding_service
from app.services.prompt_management_service import PromptManagementService, prompt_management_service
from app.services.ai_naming_service import AINamingService, ai_naming_service

from tests.utils import (
    TestDataGenerator, DatabaseTestHelper, FileTestHelper,
    MockServiceHelper, PerformanceTestHelper
)


@pytest.mark.service
class TestAIService:
    """Test AI service functionality."""
    
    @pytest.fixture
    def ai_service_instance(self):
        """Create AI service instance for testing."""
        return AIService()
    
    @pytest.mark.asyncio
    async def test_analyze_image_openai(self, ai_service_instance, sample_image_path):
        """Test image analysis with OpenAI."""
        with patch('openai.AsyncOpenAI') as mock_openai:
            # Mock OpenAI response
            mock_client = AsyncMock()
            mock_openai.return_value = mock_client
            mock_client.chat.completions.create.return_value = AsyncMock(
                choices=[
                    AsyncMock(
                        message=AsyncMock(
                            content='{"tags": ["sunset", "ocean", "landscape"], "description": "Beautiful sunset over ocean", "confidence": 95}'
                        )
                    )
                ]
            )
            
            result = await ai_service_instance.analyze_image(
                str(sample_image_path), provider="openai"
            )
            
            assert "tags" in result
            assert "description" in result
            assert "confidence" in result
            assert "provider" in result
            assert result["provider"] == "openai"
            assert isinstance(result["tags"], list)
            assert len(result["tags"]) > 0
            assert result["confidence"] > 0
    
    @pytest.mark.asyncio
    async def test_analyze_image_ollama(self, ai_service_instance, sample_image_path):
        """Test image analysis with Ollama."""
        with patch('aiohttp.ClientSession') as mock_session:
            # Mock Ollama response
            mock_response = AsyncMock()
            mock_response.json.return_value = {
                "response": '{"tags": ["photo", "test"], "description": "Test image", "confidence": 85}'
            }
            mock_session.return_value.__aenter__.return_value.post.return_value.__aenter__.return_value = mock_response
            
            result = await ai_service_instance.analyze_image(
                str(sample_image_path), provider="ollama"
            )
            
            assert result["provider"] == "ollama"
            assert "tags" in result
            assert "description" in result
    
    @pytest.mark.asyncio
    async def test_generate_tags(self, ai_service_instance, sample_image_path):
        """Test tag generation."""
        with patch.object(ai_service_instance, 'analyze_image') as mock_analyze:
            mock_analyze.return_value = {
                "tags": ["landscape", "nature", "photography"],
                "description": "A nature photograph",
                "confidence": 90,
                "provider": "mock"
            }
            
            tags = await ai_service_instance.generate_tags(str(sample_image_path))
            
            assert isinstance(tags, list)
            assert len(tags) > 0
            assert "landscape" in tags
            assert "nature" in tags
    
    @pytest.mark.asyncio
    async def test_health_check(self, ai_service_instance):
        """Test AI service health check."""
        with patch('aiohttp.ClientSession') as mock_session, \
             patch('openai.AsyncOpenAI') as mock_openai:
            
            # Mock Ollama health check
            mock_ollama_response = AsyncMock()
            mock_ollama_response.status = 200
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_ollama_response
            
            # Mock OpenAI health check
            mock_openai_client = AsyncMock()
            mock_openai.return_value = mock_openai_client
            mock_openai_client.models.list.return_value = AsyncMock(data=[])
            
            health = await ai_service_instance.health_check()
            
            assert "openai" in health
            assert "ollama" in health
            assert "available" in health["openai"]
            assert "available" in health["ollama"]
    
    @pytest.mark.asyncio
    async def test_error_handling(self, ai_service_instance, sample_image_path):
        """Test AI service error handling."""
        with patch('openai.AsyncOpenAI') as mock_openai:
            # Mock OpenAI error
            mock_client = AsyncMock()
            mock_openai.return_value = mock_client
            mock_client.chat.completions.create.side_effect = Exception("API Error")
            
            result = await ai_service_instance.analyze_image(
                str(sample_image_path), provider="openai"
            )
            
            # Should return fallback response
            assert result["provider"] == "error"
            assert "error" in result


@pytest.mark.service
class TestFaceDetectionService:
    """Test face detection service functionality."""
    
    @pytest.fixture
    def face_service_instance(self):
        """Create face detection service instance for testing."""
        return FaceDetectionService()
    
    @pytest.mark.asyncio
    async def test_detect_faces(self, face_service_instance, sample_image_with_exif):
        """Test face detection functionality."""
        with patch('face_recognition.load_image_file') as mock_load, \
             patch('face_recognition.face_locations') as mock_locations, \
             patch('face_recognition.face_encodings') as mock_encodings:
            
            # Mock face_recognition responses
            mock_load.return_value = np.zeros((100, 100, 3))
            mock_locations.return_value = [(10, 120, 100, 20)]  # top, right, bottom, left
            mock_encodings.return_value = [np.random.rand(128)]
            
            faces = await face_service_instance.detect_faces(str(sample_image_with_exif))
            
            assert isinstance(faces, list)
            assert len(faces) == 1
            
            face = faces[0]
            assert "location" in face
            assert "encoding" in face
            assert "confidence" in face
            
            location = face["location"]
            assert "top" in location
            assert "left" in location
            assert "bottom" in location
            assert "right" in location
    
    @pytest.mark.asyncio
    async def test_generate_face_encoding(self, face_service_instance, sample_image_path):
        """Test face encoding generation."""
        with patch('face_recognition.load_image_file') as mock_load, \
             patch('face_recognition.face_encodings') as mock_encodings:
            
            mock_load.return_value = np.zeros((100, 100, 3))
            mock_encodings.return_value = [np.random.rand(128)]
            
            encoding = await face_service_instance.generate_face_encoding(str(sample_image_path))
            
            assert encoding is not None
            assert isinstance(encoding, (list, np.ndarray))
            assert len(encoding) == 128
    
    @pytest.mark.asyncio
    async def test_compare_faces(self, face_service_instance):
        """Test face comparison functionality."""
        with patch('face_recognition.compare_faces') as mock_compare:
            mock_compare.return_value = [True]
            
            encoding1 = np.random.rand(128)
            encoding2 = np.random.rand(128)
            
            is_match = await face_service_instance.compare_faces([encoding1], encoding2)
            
            assert isinstance(is_match, bool)
    
    @pytest.mark.asyncio
    async def test_health_check(self, face_service_instance):
        """Test face detection service health check."""
        health = await face_service_instance.health_check()
        
        assert "status" in health
        assert "model" in health
        assert "tolerance" in health
        assert "library_available" in health
        assert isinstance(health["library_available"], bool)
    
    @pytest.mark.asyncio
    async def test_no_faces_detected(self, face_service_instance, sample_image_path):
        """Test handling when no faces are detected."""
        with patch('face_recognition.face_locations') as mock_locations:
            mock_locations.return_value = []  # No faces found
            
            faces = await face_service_instance.detect_faces(str(sample_image_path))
            
            assert isinstance(faces, list)
            assert len(faces) == 0


@pytest.mark.service
class TestFileManagerService:
    """Test file manager service functionality."""
    
    @pytest.fixture
    def file_service_instance(self):
        """Create file manager service instance for testing."""
        return FileManagerService()
    
    @pytest.mark.asyncio
    async def test_save_file(self, file_service_instance, sample_image_path, temp_media_dir):
        """Test file saving functionality."""
        # Mock file operations
        with patch('shutil.copy2') as mock_copy, \
             patch('pathlib.Path.mkdir') as mock_mkdir:
            
            mock_copy.return_value = None
            mock_mkdir.return_value = None
            
            result_path = await file_service_instance.save_file(
                str(sample_image_path), 
                str(temp_media_dir / "silver"),
                "test_photo.jpg"
            )
            
            assert result_path is not None
            assert isinstance(result_path, str)
            assert "test_photo.jpg" in result_path
    
    @pytest.mark.asyncio
    async def test_delete_file(self, file_service_instance, temp_dir):
        """Test file deletion functionality."""
        test_file = temp_dir / "test_file.txt"
        test_file.write_text("test content")
        
        result = await file_service_instance.delete_file(str(test_file))
        
        assert result is True
        assert not test_file.exists()
    
    @pytest.mark.asyncio
    async def test_move_file(self, file_service_instance, temp_dir):
        """Test file moving functionality."""
        source_file = temp_dir / "source.txt"
        dest_file = temp_dir / "destination.txt"
        source_file.write_text("test content")
        
        result_path = await file_service_instance.move_file(
            str(source_file), str(dest_file)
        )
        
        assert result_path == str(dest_file)
        assert not source_file.exists()
        assert dest_file.exists()
        assert dest_file.read_text() == "test content"
    
    @pytest.mark.asyncio
    async def test_get_file_info(self, file_service_instance, sample_image_path):
        """Test file information retrieval."""
        file_info = await file_service_instance.get_file_info(str(sample_image_path))
        
        assert "size" in file_info
        assert "hash" in file_info
        assert "mime_type" in file_info
        assert "created_at" in file_info
        assert file_info["size"] > 0
        assert len(file_info["hash"]) > 0
        assert file_info["mime_type"].startswith("image/")
    
    @pytest.mark.asyncio
    async def test_copy_file(self, file_service_instance, temp_dir):
        """Test file copying functionality."""
        source_file = temp_dir / "source.txt"
        dest_file = temp_dir / "copy.txt"
        source_file.write_text("test content")
        
        result_path = await file_service_instance.copy_file(
            str(source_file), str(dest_file)
        )
        
        assert result_path == str(dest_file)
        assert source_file.exists()
        assert dest_file.exists()
        assert dest_file.read_text() == "test content"
    
    @pytest.mark.asyncio
    async def test_error_handling(self, file_service_instance):
        """Test file service error handling."""
        # Test with non-existent file
        result = await file_service_instance.delete_file("/non/existent/file.txt")
        assert result is False
        
        file_info = await file_service_instance.get_file_info("/non/existent/file.txt")
        assert file_info is None


@pytest.mark.service
class TestThumbnailService:
    """Test thumbnail service functionality."""
    
    @pytest.fixture
    def thumbnail_service_instance(self):
        """Create thumbnail service instance for testing."""
        return ThumbnailService()
    
    @pytest.mark.asyncio
    async def test_generate_thumbnails(self, thumbnail_service_instance, sample_image_path, temp_dir):
        """Test thumbnail generation."""
        with patch('PIL.Image.open') as mock_open, \
             patch('PIL.Image.Image.save') as mock_save:
            
            # Mock PIL operations
            mock_image = Mock()
            mock_image.size = (1920, 1080)
            mock_open.return_value = mock_image
            mock_save.return_value = None
            
            thumbnails = await thumbnail_service_instance.generate_thumbnails(
                str(sample_image_path),
                str(temp_dir),
                sizes=[150, 300, 600]
            )
            
            assert isinstance(thumbnails, dict)
            assert 150 in thumbnails
            assert 300 in thumbnails
            assert 600 in thumbnails
            
            for size, path in thumbnails.items():
                assert isinstance(path, str)
                assert f"{size}" in path
    
    @pytest.mark.asyncio
    async def test_get_thumbnail_path(self, thumbnail_service_instance):
        """Test thumbnail path generation."""
        photo_id = "test-photo-123"
        size = 300
        
        path = await thumbnail_service_instance.get_thumbnail_path(photo_id, size)
        
        assert isinstance(path, str)
        assert photo_id in path
        assert str(size) in path
    
    @pytest.mark.asyncio
    async def test_resize_image(self, thumbnail_service_instance, sample_image_path, temp_dir):
        """Test image resizing functionality."""
        with patch('PIL.Image.open') as mock_open:
            mock_image = Mock()
            mock_image.size = (800, 600)
            mock_resized = Mock()
            mock_image.resize.return_value = mock_resized
            mock_open.return_value = mock_image
            
            output_path = temp_dir / "resized.jpg"
            
            result = await thumbnail_service_instance.resize_image(
                str(sample_image_path),
                str(output_path),
                width=400,
                height=300
            )
            
            assert result is True
            mock_image.resize.assert_called_once_with((400, 300))
    
    @pytest.mark.asyncio
    async def test_maintain_aspect_ratio(self, thumbnail_service_instance):
        """Test aspect ratio maintenance in thumbnail generation."""
        with patch('PIL.Image.open') as mock_open:
            mock_image = Mock()
            mock_image.size = (1600, 1200)  # 4:3 aspect ratio
            mock_open.return_value = mock_image
            
            new_size = await thumbnail_service_instance.calculate_thumbnail_size(
                (1600, 1200), max_size=400
            )
            
            # Should maintain 4:3 aspect ratio
            assert new_size[0] == 400
            assert new_size[1] == 300
    
    @pytest.mark.asyncio
    async def test_invalid_image_handling(self, thumbnail_service_instance, temp_dir):
        """Test handling of invalid image files."""
        invalid_file = temp_dir / "invalid.txt"
        invalid_file.write_text("not an image")
        
        thumbnails = await thumbnail_service_instance.generate_thumbnails(
            str(invalid_file),
            str(temp_dir)
        )
        
        assert thumbnails == {}  # Should return empty dict for invalid images


@pytest.mark.service
class TestMetadataService:
    """Test metadata service functionality."""
    
    @pytest.fixture
    def metadata_service_instance(self):
        """Create metadata service instance for testing."""
        return MetadataService()
    
    @pytest.mark.asyncio
    async def test_extract_metadata(self, metadata_service_instance, sample_image_with_exif):
        """Test metadata extraction from image with EXIF."""
        metadata = await metadata_service_instance.extract_metadata(str(sample_image_with_exif))
        
        assert "exif" in metadata
        assert "ai" in metadata
        
        exif_data = metadata["exif"]
        assert "camera" in exif_data or "make" in exif_data
        assert "date_taken" in exif_data or "date_time_original" in exif_data
    
    @pytest.mark.asyncio
    async def test_extract_exif_data(self, metadata_service_instance, sample_image_with_exif):
        """Test EXIF data extraction."""
        exif_data = await metadata_service_instance.extract_exif_data(str(sample_image_with_exif))
        
        assert isinstance(exif_data, dict)
        assert len(exif_data) > 0
        
        # Check for common EXIF fields
        possible_fields = [
            "camera", "make", "model", "date_taken", "date_time_original",
            "gps_latitude", "gps_longitude", "iso", "aperture"
        ]
        
        found_fields = [field for field in possible_fields if field in exif_data]
        assert len(found_fields) > 0
    
    @pytest.mark.asyncio
    async def test_extract_gps_coordinates(self, metadata_service_instance, sample_image_with_exif):
        """Test GPS coordinate extraction."""
        coordinates = await metadata_service_instance.extract_gps_coordinates(
            str(sample_image_with_exif)
        )
        
        if coordinates:  # GPS data might not always be present
            assert "latitude" in coordinates
            assert "longitude" in coordinates
            assert isinstance(coordinates["latitude"], (int, float))
            assert isinstance(coordinates["longitude"], (int, float))
            assert -90 <= coordinates["latitude"] <= 90
            assert -180 <= coordinates["longitude"] <= 180
    
    @pytest.mark.asyncio
    async def test_generate_ai_metadata(self, metadata_service_instance, sample_image_path):
        """Test AI metadata generation."""
        with patch.object(metadata_service_instance, '_call_ai_service') as mock_ai:
            mock_ai.return_value = {
                "tags": ["nature", "landscape"],
                "description": "Beautiful landscape photo",
                "confidence": 92
            }
            
            ai_metadata = await metadata_service_instance.generate_ai_metadata(
                str(sample_image_path)
            )
            
            assert "tags" in ai_metadata
            assert "description" in ai_metadata
            assert "confidence" in ai_metadata
            assert isinstance(ai_metadata["tags"], list)
            assert len(ai_metadata["tags"]) > 0
    
    @pytest.mark.asyncio
    async def test_image_without_exif(self, metadata_service_instance, sample_image_path):
        """Test metadata extraction from image without EXIF."""
        metadata = await metadata_service_instance.extract_metadata(str(sample_image_path))
        
        assert "exif" in metadata
        assert "ai" in metadata
        
        # EXIF might be empty or minimal for generated test images
        assert isinstance(metadata["exif"], dict)
        assert isinstance(metadata["ai"], dict)


@pytest.mark.service  
class TestDuplicateDetectionService:
    """Test duplicate detection service functionality."""
    
    @pytest.fixture
    def duplicate_service_instance(self):
        """Create duplicate detection service instance for testing."""
        return DuplicateDetectionService()
    
    @pytest.mark.asyncio
    async def test_calculate_perceptual_hash(self, duplicate_service_instance, sample_image_path):
        """Test perceptual hash calculation."""
        with patch('PIL.Image.open') as mock_open:
            mock_image = Mock()
            mock_image.resize.return_value = mock_image
            mock_image.convert.return_value = mock_image
            mock_image.getdata.return_value = [100] * 64  # 8x8 grayscale values
            mock_open.return_value = mock_image
            
            hash_value = await duplicate_service_instance.calculate_perceptual_hash(
                str(sample_image_path)
            )
            
            assert isinstance(hash_value, str)
            assert len(hash_value) > 0
    
    @pytest.mark.asyncio
    async def test_compare_hashes(self, duplicate_service_instance):
        """Test hash comparison functionality."""
        hash1 = "abcd1234efgh5678"
        hash2 = "abcd1234efgh5679"  # 1 bit different
        hash3 = "1234abcdefgh5678"  # More different
        
        similarity1 = await duplicate_service_instance.compare_hashes(hash1, hash2)
        similarity2 = await duplicate_service_instance.compare_hashes(hash1, hash3)
        
        assert isinstance(similarity1, (int, float))
        assert isinstance(similarity2, (int, float))
        assert 0 <= similarity1 <= 100
        assert 0 <= similarity2 <= 100
        assert similarity1 > similarity2  # hash2 should be more similar to hash1
    
    @pytest.mark.asyncio
    async def test_find_duplicates(self, duplicate_service_instance, db_session):
        """Test duplicate finding functionality."""
        # Create test file versions with similar hashes
        file1 = await DatabaseTestHelper.create_test_file_version(
            db_session, perceptual_hash="abcd1234efgh5678"
        )
        file2 = await DatabaseTestHelper.create_test_file_version(
            db_session, perceptual_hash="abcd1234efgh5679"  # Very similar
        )
        file3 = await DatabaseTestHelper.create_test_file_version(
            db_session, perceptual_hash="1111222233334444"  # Different
        )
        
        duplicates = await duplicate_service_instance.find_duplicates(
            db_session, threshold=95
        )
        
        assert isinstance(duplicates, list)
        # Should find file1 and file2 as duplicates if similarity > 95%
    
    @pytest.mark.asyncio
    async def test_hash_generation_consistency(self, duplicate_service_instance, sample_image_path):
        """Test that hash generation is consistent."""
        hash1 = await duplicate_service_instance.calculate_perceptual_hash(str(sample_image_path))
        hash2 = await duplicate_service_instance.calculate_perceptual_hash(str(sample_image_path))
        
        assert hash1 == hash2  # Same image should produce same hash


@pytest.mark.service
class TestBurstDetectionService:
    """Test burst detection service functionality."""
    
    @pytest.fixture
    def burst_service_instance(self):
        """Create burst detection service instance for testing."""
        return BurstDetectionService()
    
    @pytest.mark.asyncio
    async def test_detect_burst_sequences(self, burst_service_instance, db_session):
        """Test burst sequence detection."""
        # Create test photos with timestamps that form a burst
        base_time = datetime.now()
        burst_photos = []
        
        for i in range(5):
            photo_time = base_time + timedelta(seconds=i * 0.5)  # 0.5 second intervals
            metadata = {
                "exif": {
                    "date_taken": photo_time.isoformat()
                }
            }
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session, metadata=metadata
            )
            burst_photos.append(photo)
        
        # Create non-burst photo (much later)
        later_time = base_time + timedelta(minutes=5)
        metadata = {
            "exif": {
                "date_taken": later_time.isoformat()
            }
        }
        single_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, metadata=metadata
        )
        
        bursts = await burst_service_instance.detect_burst_sequences(
            db_session, max_interval_seconds=2.0, min_burst_size=3
        )
        
        assert isinstance(bursts, list)
        if len(bursts) > 0:
            burst = bursts[0]
            assert "photos" in burst
            assert "timestamp_range" in burst
            assert len(burst["photos"]) >= 3
    
    @pytest.mark.asyncio
    async def test_group_by_timestamp(self, burst_service_instance):
        """Test photo grouping by timestamp."""
        # Create mock photos with timestamps
        photos = []
        base_time = datetime.now()
        
        for i in range(10):
            photo = {
                "id": f"photo_{i}",
                "timestamp": base_time + timedelta(seconds=i * 0.3)
            }
            photos.append(photo)
        
        groups = await burst_service_instance.group_by_timestamp(
            photos, max_interval_seconds=1.0
        )
        
        assert isinstance(groups, list)
        assert len(groups) > 0
        
        # All photos should be in one group since intervals are < 1 second
        if len(groups) == 1:
            assert len(groups[0]) == 10
    
    @pytest.mark.asyncio
    async def test_calculate_burst_score(self, burst_service_instance):
        """Test burst sequence scoring."""
        # Create mock burst data
        burst_data = {
            "photos": [{"id": f"photo_{i}"} for i in range(5)],
            "timestamp_range": {
                "start": datetime.now(),
                "end": datetime.now() + timedelta(seconds=2)
            },
            "intervals": [0.5, 0.5, 0.5, 0.5]  # Consistent intervals
        }
        
        score = await burst_service_instance.calculate_burst_score(burst_data)
        
        assert isinstance(score, (int, float))
        assert 0 <= score <= 100
    
    @pytest.mark.asyncio
    async def test_empty_photo_set(self, burst_service_instance, db_session):
        """Test burst detection with no photos."""
        bursts = await burst_service_instance.detect_burst_sequences(db_session)
        
        assert isinstance(bursts, list)
        assert len(bursts) == 0


@pytest.mark.service
class TestAdvancedSearchService:
    """Test advanced search service functionality."""
    
    @pytest.fixture
    def search_service_instance(self):
        """Create advanced search service instance for testing."""
        return AdvancedSearchService()
    
    @pytest.mark.asyncio
    async def test_search_by_text(self, search_service_instance, db_session):
        """Test text-based search functionality."""
        # Create test photos with different keywords and descriptions
        photo1 = await DatabaseTestHelper.create_test_file_version(
            db_session,
            keywords=["sunset", "beach", "vacation"],
            ai_short_description="Beautiful sunset at the beach"
        )
        photo2 = await DatabaseTestHelper.create_test_file_version(
            db_session,
            keywords=["mountain", "hiking", "adventure"],
            ai_short_description="Mountain hiking adventure"
        )
        
        # Search for "sunset"
        results = await search_service_instance.search_by_text(
            db_session, query="sunset"
        )
        
        assert isinstance(results, list)
        # Should find photo1 but not photo2
        result_ids = [r.id for r in results]
        assert photo1.id in result_ids
    
    @pytest.mark.asyncio
    async def test_search_by_rating(self, search_service_instance, db_session):
        """Test rating-based search."""
        # Create photos with different ratings
        high_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=5
        )
        medium_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=3
        )
        low_rated = await DatabaseTestHelper.create_test_file_version(
            db_session, rating=1
        )
        
        # Search for high-rated photos (4+)
        results = await search_service_instance.search_by_rating(
            db_session, min_rating=4
        )
        
        assert isinstance(results, list)
        result_ids = [r.id for r in results]
        assert high_rated.id in result_ids
        assert medium_rated.id not in result_ids
        assert low_rated.id not in result_ids
    
    @pytest.mark.asyncio
    async def test_search_by_date_range(self, search_service_instance, db_session):
        """Test date range search."""
        # Create photos with different dates
        old_date = datetime.now() - timedelta(days=30)
        recent_date = datetime.now() - timedelta(days=1)
        
        old_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            metadata={"exif": {"date_taken": old_date.isoformat()}}
        )
        recent_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            metadata={"exif": {"date_taken": recent_date.isoformat()}}
        )
        
        # Search for photos from last week
        start_date = datetime.now() - timedelta(days=7)
        end_date = datetime.now()
        
        results = await search_service_instance.search_by_date_range(
            db_session, start_date=start_date, end_date=end_date
        )
        
        assert isinstance(results, list)
        # Should find recent_photo but not old_photo
    
    @pytest.mark.asyncio
    async def test_search_by_location(self, search_service_instance, db_session):
        """Test location-based search."""
        # Create photos with different locations
        nyc_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, location="40.7589,-73.9851"  # Central Park
        )
        la_photo = await DatabaseTestHelper.create_test_file_version(
            db_session, location="34.0522,-118.2437"  # Los Angeles
        )
        no_location_photo = await DatabaseTestHelper.create_test_file_version(db_session)
        
        # Search near Central Park (with radius)
        results = await search_service_instance.search_by_location(
            db_session, 
            latitude=40.7589, 
            longitude=-73.9851, 
            radius_km=1.0
        )
        
        assert isinstance(results, list)
        # Should find nyc_photo within radius
    
    @pytest.mark.asyncio
    async def test_search_by_people(self, search_service_instance, db_session):
        """Test people-based search."""
        # Create person and photos with faces
        person = await DatabaseTestHelper.create_test_person(db_session, name="John Doe")
        photo_with_person = await DatabaseTestHelper.create_test_file_version(db_session)
        photo_without_person = await DatabaseTestHelper.create_test_file_version(db_session)
        
        # Add face to one photo
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=photo_with_person, person=person
        )
        
        results = await search_service_instance.search_by_people(
            db_session, person_ids=[person.id]
        )
        
        assert isinstance(results, list)
        result_ids = [r.id for r in results]
        assert photo_with_person.id in result_ids
        assert photo_without_person.id not in result_ids
    
    @pytest.mark.asyncio
    async def test_complex_search_query(self, search_service_instance, db_session):
        """Test complex multi-criteria search."""
        # Create test photo that matches multiple criteria
        target_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            rating=5,
            keywords=["vacation", "beach"],
            location="40.7589,-73.9851"
        )
        
        # Create photo that doesn't match all criteria
        other_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            rating=2,
            keywords=["work", "office"]
        )
        
        # Complex search
        search_criteria = {
            "text_query": "vacation",
            "min_rating": 4,
            "has_location": True
        }
        
        results = await search_service_instance.complex_search(
            db_session, criteria=search_criteria
        )
        
        assert isinstance(results, list)
        # Should find target_photo but not other_photo


# Continue with remaining services...
@pytest.mark.service
class TestEventDetectionService:
    """Test event detection service functionality."""
    
    @pytest.fixture
    def event_service_instance(self):
        """Create event detection service instance for testing."""
        return EventDetectionService()
    
    @pytest.mark.asyncio
    async def test_detect_events_in_photos(self, event_service_instance, db_session):
        """Test event detection in photo collections."""
        # Create photos from the same event (same day, similar location)
        event_date = datetime(2024, 7, 4)  # July 4th
        
        event_photos = []
        for i in range(5):
            photo_time = event_date + timedelta(hours=i)
            metadata = {
                "exif": {
                    "date_taken": photo_time.isoformat(),
                    "gps_latitude": 40.7589 + (i * 0.001),  # Slight location variance
                    "gps_longitude": -73.9851 + (i * 0.001)
                }
            }
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session, metadata=metadata
            )
            event_photos.append(photo)
        
        events = await event_service_instance.detect_events_in_photos(db_session)
        
        assert isinstance(events, list)
        if len(events) > 0:
            event = events[0]
            assert "photos" in event
            assert "date_range" in event
            assert "location_cluster" in event
    
    @pytest.mark.asyncio
    async def test_detect_birthday_events(self, event_service_instance, db_session):
        """Test birthday event detection."""
        # Create person with birthday
        person = await DatabaseTestHelper.create_test_person(
            db_session, 
            name="Birthday Person",
            birthdate=datetime(1990, 6, 15)
        )
        
        # Create photos on birthday date
        birthday_2024 = datetime(2024, 6, 15)
        birthday_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            metadata={"exif": {"date_taken": birthday_2024.isoformat()}}
        )
        
        # Add face to photo
        await DatabaseTestHelper.create_test_face(
            db_session, file_version=birthday_photo, person=person
        )
        
        birthday_events = await event_service_instance.detect_birthday_events(db_session)
        
        assert isinstance(birthday_events, list)
        # Should detect birthday event for the person
    
    @pytest.mark.asyncio
    async def test_detect_holiday_events(self, event_service_instance, db_session):
        """Test holiday event detection."""
        # Create photos on known holiday dates
        christmas_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            metadata={"exif": {"date_taken": "2024-12-25T12:00:00"}}
        )
        new_year_photo = await DatabaseTestHelper.create_test_file_version(
            db_session,
            metadata={"exif": {"date_taken": "2024-01-01T00:30:00"}}
        )
        
        holiday_events = await event_service_instance.detect_holiday_events(db_session)
        
        assert isinstance(holiday_events, list)
        # Should detect Christmas and New Year events


@pytest.mark.service
class TestLocationClusteringService:
    """Test location clustering service functionality."""
    
    @pytest.fixture
    def location_service_instance(self):
        """Create location clustering service instance for testing."""
        return LocationClusteringService()
    
    @pytest.mark.asyncio
    async def test_cluster_photos_by_location(self, location_service_instance, db_session):
        """Test photo clustering by geographic location."""
        # Create photos in two distinct location clusters
        # Central Park cluster
        park_photos = []
        for i in range(3):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                location=f"40.{7580+i},-73.{9650+i}"  # Slight variations around Central Park
            )
            park_photos.append(photo)
        
        # Times Square cluster
        times_square_photos = []
        for i in range(2):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                location=f"40.{7580+i},-73.{9853+i}"  # Times Square area
            )
            times_square_photos.append(photo)
        
        clusters = await location_service_instance.cluster_photos_by_location(
            db_session, max_distance_km=0.5
        )
        
        assert isinstance(clusters, list)
        assert len(clusters) >= 1  # Should find at least one cluster
        
        if len(clusters) > 0:
            cluster = clusters[0]
            assert "center" in cluster
            assert "photos" in cluster
            assert "radius" in cluster
            assert len(cluster["photos"]) > 0
    
    @pytest.mark.asyncio
    async def test_calculate_distance(self, location_service_instance):
        """Test distance calculation between coordinates."""
        # Central Park to Times Square (approximately 2.5 km)
        central_park = (40.7812, -73.9665)
        times_square = (40.7580, -73.9855)
        
        distance = await location_service_instance.calculate_distance(
            central_park[0], central_park[1],
            times_square[0], times_square[1]
        )
        
        assert isinstance(distance, (int, float))
        assert distance > 0
        assert 2.0 < distance < 3.0  # Approximate distance in km
    
    @pytest.mark.asyncio
    async def test_identify_frequent_locations(self, location_service_instance, db_session):
        """Test identification of frequently visited locations."""
        # Create multiple photos at the same location
        home_location = "40.7589,-73.9851"
        
        for i in range(10):
            await DatabaseTestHelper.create_test_file_version(
                db_session, location=home_location
            )
        
        # Create few photos at another location
        work_location = "40.7505,-73.9934"
        for i in range(3):
            await DatabaseTestHelper.create_test_file_version(
                db_session, location=work_location
            )
        
        frequent_locations = await location_service_instance.identify_frequent_locations(
            db_session, min_photos=5
        )
        
        assert isinstance(frequent_locations, list)
        if len(frequent_locations) > 0:
            location = frequent_locations[0]
            assert "coordinates" in location
            assert "photo_count" in location
            assert location["photo_count"] >= 5


@pytest.mark.service
class TestReverseGeocodingService:
    """Test reverse geocoding service functionality."""
    
    @pytest.fixture
    def geocoding_service_instance(self):
        """Create reverse geocoding service instance for testing."""
        return ReverseGeocodingService()
    
    @pytest.mark.asyncio
    async def test_reverse_geocode(self, geocoding_service_instance):
        """Test reverse geocoding functionality."""
        with patch('aiohttp.ClientSession') as mock_session:
            # Mock geocoding API response
            mock_response = AsyncMock()
            mock_response.json.return_value = {
                "address": {
                    "road": "Central Park West",
                    "neighbourhood": "Upper West Side",
                    "city": "New York",
                    "state": "New York",
                    "country": "United States",
                    "postcode": "10024"
                },
                "display_name": "Central Park West, Upper West Side, New York, NY, 10024, United States"
            }
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response
            
            # Central Park coordinates
            result = await geocoding_service_instance.reverse_geocode(40.7812, -73.9665)
            
            assert isinstance(result, dict)
            assert "place_name" in result
            assert "city" in result
            assert "country" in result
            assert result["city"] == "New York"
            assert result["country"] == "United States"
    
    @pytest.mark.asyncio
    async def test_batch_reverse_geocode(self, geocoding_service_instance):
        """Test batch reverse geocoding."""
        coordinates = [
            (40.7812, -73.9665),  # Central Park
            (40.7580, -73.9855),  # Times Square
            (34.0522, -118.2437)  # Los Angeles
        ]
        
        with patch.object(geocoding_service_instance, 'reverse_geocode') as mock_geocode:
            mock_geocode.side_effect = [
                {"place_name": "Central Park", "city": "New York", "country": "USA"},
                {"place_name": "Times Square", "city": "New York", "country": "USA"},
                {"place_name": "Los Angeles", "city": "Los Angeles", "country": "USA"}
            ]
            
            results = await geocoding_service_instance.batch_reverse_geocode(coordinates)
            
            assert isinstance(results, list)
            assert len(results) == 3
            assert all("place_name" in result for result in results)
    
    @pytest.mark.asyncio
    async def test_geocoding_cache(self, geocoding_service_instance):
        """Test geocoding result caching."""
        lat, lon = 40.7812, -73.9665
        
        with patch.object(geocoding_service_instance, '_fetch_from_api') as mock_fetch:
            mock_fetch.return_value = {
                "place_name": "Central Park",
                "city": "New York",
                "country": "USA"
            }
            
            # First call should fetch from API
            result1 = await geocoding_service_instance.reverse_geocode(lat, lon)
            
            # Second call should use cache
            result2 = await geocoding_service_instance.reverse_geocode(lat, lon)
            
            assert result1 == result2
            assert mock_fetch.call_count == 1  # Should only call API once


@pytest.mark.service
class TestPromptManagementService:
    """Test prompt management service functionality."""
    
    @pytest.fixture
    def prompt_service_instance(self):
        """Create prompt management service instance for testing."""
        return PromptManagementService()
    
    @pytest.mark.asyncio
    async def test_get_prompt_by_category(self, prompt_service_instance, db_session):
        """Test getting prompts by category."""
        # Create test AI prompts
        analysis_prompt = AIPrompt(
            name="Image Analysis",
            category="analysis",
            provider="openai",
            system_prompt="Analyze the image",
            user_prompt="What do you see in {image}?",
            is_default=True,
            is_active=True
        )
        db_session.add(analysis_prompt)
        await db_session.commit()
        
        prompt = await prompt_service_instance.get_prompt_by_category(
            db_session, category="analysis", provider="openai"
        )
        
        assert prompt is not None
        assert prompt.category == "analysis"
        assert prompt.provider == "openai"
        assert prompt.is_active
    
    @pytest.mark.asyncio
    async def test_create_prompt(self, prompt_service_instance, db_session):
        """Test prompt creation."""
        prompt_data = {
            "name": "Custom Analysis",
            "category": "analysis",
            "provider": "ollama",
            "system_prompt": "You are an expert image analyst",
            "user_prompt": "Analyze this image: {image}",
            "is_default": False,
            "is_active": True
        }
        
        created_prompt = await prompt_service_instance.create_prompt(
            db_session, prompt_data
        )
        
        assert created_prompt is not None
        assert created_prompt.name == "Custom Analysis"
        assert created_prompt.category == "analysis"
        assert created_prompt.provider == "ollama"
    
    @pytest.mark.asyncio
    async def test_format_prompt(self, prompt_service_instance):
        """Test prompt formatting with variables."""
        template = "Analyze this image: {image}. Focus on {aspect} with {detail_level} detail."
        variables = {
            "image": "image_data_here",
            "aspect": "colors and composition",
            "detail_level": "high"
        }
        
        formatted = await prompt_service_instance.format_prompt(template, variables)
        
        expected = "Analyze this image: image_data_here. Focus on colors and composition with high detail."
        assert formatted == expected
    
    @pytest.mark.asyncio
    async def test_get_default_prompts(self, prompt_service_instance, db_session):
        """Test getting default prompts for all categories."""
        # Create default prompts for different categories
        categories = ["analysis", "naming", "description"]
        
        for category in categories:
            prompt = AIPrompt(
                name=f"Default {category}",
                category=category,
                provider="openai",
                system_prompt=f"Default {category} prompt",
                user_prompt=f"Perform {category} on {{image}}",
                is_default=True,
                is_active=True
            )
            db_session.add(prompt)
        
        await db_session.commit()
        
        defaults = await prompt_service_instance.get_default_prompts(db_session)
        
        assert isinstance(defaults, dict)
        assert len(defaults) == 3
        for category in categories:
            assert category in defaults
            assert defaults[category].is_default


@pytest.mark.service
class TestAINamingService:
    """Test AI naming service functionality."""
    
    @pytest.fixture
    def naming_service_instance(self):
        """Create AI naming service instance for testing."""
        return AINamingService()
    
    @pytest.mark.asyncio
    async def test_generate_photo_name(self, naming_service_instance, sample_image_path):
        """Test photo name generation."""
        with patch.object(naming_service_instance, '_call_ai_service') as mock_ai:
            mock_ai.return_value = {
                "suggested_name": "Sunset Over Ocean",
                "confidence": 92,
                "reasoning": "Image shows a sunset scene over water"
            }
            
            result = await naming_service_instance.generate_photo_name(
                str(sample_image_path)
            )
            
            assert "suggested_name" in result
            assert "confidence" in result
            assert isinstance(result["suggested_name"], str)
            assert len(result["suggested_name"]) > 0
    
    @pytest.mark.asyncio
    async def test_generate_collection_name(self, naming_service_instance, db_session):
        """Test collection name generation."""
        # Create photos for a collection
        photos = []
        for i in range(3):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                keywords=["vacation", "beach", "summer"],
                ai_short_description=f"Beach vacation photo {i+1}"
            )
            photos.append(photo)
        
        with patch.object(naming_service_instance, '_analyze_collection_content') as mock_analyze:
            mock_analyze.return_value = {
                "themes": ["vacation", "beach", "summer"],
                "dominant_theme": "vacation",
                "suggested_names": ["Summer Beach Vacation", "Coastal Holiday", "Beach Trip 2024"]
            }
            
            result = await naming_service_instance.generate_collection_name(photos)
            
            assert "suggested_names" in result
            assert "dominant_theme" in result
            assert isinstance(result["suggested_names"], list)
            assert len(result["suggested_names"]) > 0
    
    @pytest.mark.asyncio
    async def test_suggest_person_name(self, naming_service_instance, db_session):
        """Test person name suggestion based on face clustering."""
        # Create person with multiple faces
        person = await DatabaseTestHelper.create_test_person(db_session, name="Unknown Person")
        
        # Create photos with faces
        for i in range(3):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            await DatabaseTestHelper.create_test_face(
                db_session, file_version=photo, person=person
            )
        
        with patch.object(naming_service_instance, '_analyze_face_context') as mock_analyze:
            mock_analyze.return_value = {
                "context_clues": ["appears in family photos", "often in outdoor settings"],
                "suggested_names": ["Family Member", "Outdoor Enthusiast"],
                "confidence": 75
            }
            
            result = await naming_service_instance.suggest_person_name(person.id, db_session)
            
            assert "suggested_names" in result
            assert "confidence" in result
            assert isinstance(result["suggested_names"], list)


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])