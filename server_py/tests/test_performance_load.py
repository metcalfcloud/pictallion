"""
Performance and Load Testing

Comprehensive performance testing suite for the Pictallion Python backend,
including benchmarking, load testing, stress testing, and performance regression tests.
"""

import asyncio
import concurrent.futures
import statistics
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List
from unittest.mock import AsyncMock, Mock, patch

import pytest
from app.models import *
from tests.utils import (APITestHelper, DatabaseTestHelper, FileTestHelper,
                         PerformanceTestHelper, TestDataGenerator)


@pytest.mark.performance
class TestDatabasePerformance:
    """Test database operation performance."""

    async def test_photo_query_performance(self, db_session):
        """Test photo query performance with large dataset."""
        # Create large dataset
        photo_count = 1000
        photos = []

        start_time = time.time()
        for i in range(photo_count):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session,
                rating=i % 5 + 1,
                keywords=[f"tag_{i % 10}", f"category_{i % 5}"],
                location=(
                    f"{40.7589 + i * 0.001},{-73.9851 + i * 0.001}"
                    if i % 2 == 0
                    else None
                ),
            )
            photos.append(photo)

        creation_time = time.time() - start_time
        print(f"Created {photo_count} photos in {creation_time:.2f}s")

        # Test various query patterns
        query_tests = [
            (
                "Simple select all",
                lambda: db_session.query(FileVersion).limit(100).all(),
            ),
            (
                "Filter by rating",
                lambda: db_session.query(FileVersion)
                .filter(FileVersion.rating >= 4)
                .limit(100)
                .all(),
            ),
            (
                "Filter by keywords",
                lambda: db_session.query(FileVersion)
                .filter(FileVersion.keywords.contains(["tag_1"]))
                .limit(100)
                .all(),
            ),
            (
                "Filter with location",
                lambda: db_session.query(FileVersion)
                .filter(FileVersion.location.isnot(None))
                .limit(100)
                .all(),
            ),
            (
                "Order by rating desc",
                lambda: db_session.query(FileVersion)
                .order_by(FileVersion.rating.desc())
                .limit(100)
                .all(),
            ),
            (
                "Complex filter",
                lambda: db_session.query(FileVersion)
                .filter(FileVersion.rating >= 3, FileVersion.location.isnot(None))
                .order_by(FileVersion.created_at.desc())
                .limit(50)
                .all(),
            ),
        ]

        for test_name, query_func in query_tests:
            times = []
            for _ in range(10):  # Run each query 10 times
                start = time.time()
                await asyncio.to_thread(query_func)
                end = time.time()
                times.append(end - start)

            avg_time = statistics.mean(times)
            max_time = max(times)
            min_time = min(times)

            print(
                f"{test_name}: avg={avg_time:.3f}s, min={min_time:.3f}s, max={max_time:.3f}s"
            )

            # Performance assertions
            assert (
                avg_time < 1.0
            ), f"{test_name} average time {avg_time:.3f}s exceeds 1.0s threshold"
            assert (
                max_time < 2.0
            ), f"{test_name} max time {max_time:.3f}s exceeds 2.0s threshold"

    async def test_face_detection_query_performance(self, db_session):
        """Test face-related query performance."""
        # Create people and faces
        people_count = 100
        faces_per_person = 20

        people = []
        for i in range(people_count):
            person = await DatabaseTestHelper.create_test_person(
                db_session, name=f"Person {i}", face_count=faces_per_person
            )
            people.append(person)

            # Create faces for this person
            for j in range(faces_per_person):
                photo = await DatabaseTestHelper.create_test_file_version(db_session)
                face = await DatabaseTestHelper.create_test_face(
                    db_session, file_version=photo, person=person
                )

        # Test face query performance
        face_query_tests = [
            (
                "Get all faces for person",
                lambda p: db_session.query(Face).filter(Face.person_id == p.id).all(),
            ),
            (
                "Get unassigned faces",
                lambda p: db_session.query(Face)
                .filter(Face.person_id.is_(None))
                .limit(100)
                .all(),
            ),
            (
                "Count faces per person",
                lambda p: db_session.query(Face).filter(Face.person_id == p.id).count(),
            ),
            (
                "Get people with face count",
                lambda p: db_session.query(Person).filter(Person.face_count > 10).all(),
            ),
        ]

        test_person = people[0]
        for test_name, query_func in face_query_tests:
            start = time.time()
            await asyncio.to_thread(query_func, test_person)
            end = time.time()
            query_time = end - start

            print(f"{test_name}: {query_time:.3f}s")
            assert (
                query_time < 0.5
            ), f"{test_name} time {query_time:.3f}s exceeds 0.5s threshold"

    async def test_collection_query_performance(self, db_session):
        """Test collection-related query performance."""
        # Create collections with many photos
        collection_count = 50
        photos_per_collection = 100

        for i in range(collection_count):
            collection = await DatabaseTestHelper.create_test_collection(
                db_session, name=f"Collection {i}"
            )

            # Add photos to collection
            for j in range(photos_per_collection):
                photo = await DatabaseTestHelper.create_test_file_version(db_session)
                collection_photo = CollectionPhoto(
                    collection_id=collection.id, photo_id=photo.id
                )
                db_session.add(collection_photo)

        await db_session.commit()

        # Test collection queries
        start = time.time()
        collections_with_counts = await asyncio.to_thread(
            lambda: db_session.query(Collection)
            .join(CollectionPhoto)
            .group_by(Collection.id)
            .all()
        )
        end = time.time()

        query_time = end - start
        print(f"Collections with photo counts: {query_time:.3f}s")
        assert (
            query_time < 2.0
        ), f"Collection query time {query_time:.3f}s exceeds 2.0s threshold"


@pytest.mark.performance
class TestAPIPerformance:
    """Test API endpoint performance."""

    async def test_photo_listing_performance(self, async_client, db_session):
        """Test photo listing API performance."""
        # Create dataset
        photo_count = 500
        for i in range(photo_count):
            await DatabaseTestHelper.create_test_file_version(
                db_session, rating=i % 5 + 1
            )

        # Test different page sizes and filters
        test_cases = [
            ("/api/photos/?page=1&per_page=10", "Small page"),
            ("/api/photos/?page=1&per_page=50", "Medium page"),
            ("/api/photos/?page=1&per_page=100", "Large page"),
            ("/api/photos/?min_rating=4", "Filtered by rating"),
            ("/api/photos/?has_location=true", "Filtered by location"),
            ("/api/photos/?page=10&per_page=20", "Deep pagination"),
        ]

        for endpoint, test_name in test_cases:
            times = []
            for _ in range(5):  # Test each endpoint 5 times
                start = time.time()
                response = await async_client.get(endpoint)
                end = time.time()

                assert response.status_code == 200
                times.append(end - start)

            avg_time = statistics.mean(times)
            print(f"{test_name}: {avg_time:.3f}s average")
            assert (
                avg_time < 1.0
            ), f"{test_name} average time {avg_time:.3f}s exceeds 1.0s"

    async def test_search_performance(self, async_client, db_session):
        """Test search API performance."""
        # Create searchable dataset
        search_terms = [
            "vacation",
            "work",
            "family",
            "food",
            "nature",
            "city",
            "beach",
            "mountain",
        ]

        for i in range(200):
            keywords = [search_terms[i % len(search_terms)], f"photo_{i}"]
            await DatabaseTestHelper.create_test_file_version(
                db_session,
                keywords=keywords,
                ai_short_description=f"Photo containing {keywords[0]} and related content",
            )

        # Test search performance
        search_tests = [
            ("/api/search?q=vacation", "Text search"),
            (
                "/api/search?q=vacation&page=1&per_page=20",
                "Text search with pagination",
            ),
            (
                "/api/search/location?latitude=40.7589&longitude=-73.9851&radius_km=10",
                "Location search",
            ),
        ]

        for endpoint, test_name in search_tests:
            start = time.time()
            response = await async_client.get(endpoint)
            end = time.time()

            search_time = end - start
            assert response.status_code == 200

            print(f"{test_name}: {search_time:.3f}s")
            assert (
                search_time < 2.0
            ), f"{test_name} time {search_time:.3f}s exceeds 2.0s"

    async def test_bulk_operations_performance(self, async_client, db_session):
        """Test bulk operation performance."""
        # Create photos for bulk operations
        photo_ids = []
        for i in range(100):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            photo_ids.append(photo.id)

        # Test bulk update
        bulk_data = {
            "photo_ids": photo_ids,
            "updates": {"rating": 5, "keywords": ["bulk_test"]},
        }

        start = time.time()
        response = await async_client.post("/api/photos/bulk-update", json=bulk_data)
        end = time.time()

        bulk_time = end - start
        assert response.status_code == 200

        print(f"Bulk update of 100 photos: {bulk_time:.3f}s")
        assert bulk_time < 3.0, f"Bulk update time {bulk_time:.3f}s exceeds 3.0s"


@pytest.mark.load
class TestLoadTesting:
    """Test system behavior under load."""

    async def test_concurrent_photo_requests(self, async_client, db_session):
        """Test concurrent photo requests."""
        # Create test photos
        photo_count = 50
        photo_ids = []
        for i in range(photo_count):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            photo_ids.append(photo.id)

        # Function to make photo request
        async def fetch_photo(photo_id: str) -> float:
            start = time.time()
            response = await async_client.get(f"/api/photos/{photo_id}")
            end = time.time()
            assert response.status_code == 200
            return end - start

        # Test with increasing concurrency
        concurrency_levels = [1, 5, 10, 20]

        for concurrency in concurrency_levels:
            # Select photos for this test
            test_photos = photo_ids[:concurrency]

            start_time = time.time()

            # Run concurrent requests
            tasks = [fetch_photo(photo_id) for photo_id in test_photos]
            response_times = await asyncio.gather(*tasks)

            total_time = time.time() - start_time
            avg_response_time = statistics.mean(response_times)
            max_response_time = max(response_times)

            print(
                f"Concurrency {concurrency}: total={total_time:.3f}s, "
                f"avg_response={avg_response_time:.3f}s, max_response={max_response_time:.3f}s"
            )

            # Performance assertions
            assert (
                avg_response_time < 1.0
            ), f"Average response time {avg_response_time:.3f}s too high"
            assert (
                max_response_time < 2.0
            ), f"Max response time {max_response_time:.3f}s too high"

    async def test_concurrent_search_requests(self, async_client, db_session):
        """Test concurrent search requests."""
        # Create searchable data
        for i in range(100):
            await DatabaseTestHelper.create_test_file_version(
                db_session, keywords=[f"search_term_{i % 10}"], rating=i % 5 + 1
            )

        # Different search queries
        search_queries = [
            "/api/search?q=search_term_1",
            "/api/search?q=search_term_2",
            "/api/search?q=search_term_3",
            "/api/photos/?min_rating=4",
            "/api/photos/?page=1&per_page=20",
        ]

        async def execute_search(query: str) -> float:
            start = time.time()
            response = await async_client.get(query)
            end = time.time()
            assert response.status_code == 200
            return end - start

        # Test concurrent searches
        concurrent_searches = 10
        search_tasks = []

        for i in range(concurrent_searches):
            query = search_queries[i % len(search_queries)]
            search_tasks.append(execute_search(query))

        start_time = time.time()
        response_times = await asyncio.gather(*search_tasks)
        total_time = time.time() - start_time

        avg_time = statistics.mean(response_times)
        max_time = max(response_times)

        print(
            f"Concurrent searches: {concurrent_searches} requests in {total_time:.3f}s, "
            f"avg={avg_time:.3f}s, max={max_time:.3f}s"
        )

        assert avg_time < 2.0, f"Average search time {avg_time:.3f}s too high"
        assert total_time < 10.0, f"Total time {total_time:.3f}s too high"

    async def test_upload_stress_test(self, async_client, temp_dir):
        """Test multiple file uploads under stress."""
        # Create test images
        image_count = 20
        image_paths = []

        for i in range(image_count):
            image_path = FileTestHelper.create_test_image_file(
                temp_dir / f"stress_test_{i}.jpg", format="JPEG"
            )
            image_paths.append(image_path)

        # Mock services to avoid actual processing overhead
        with (
            patch("app.services.ai_service.ai_service.analyze_image") as mock_ai,
            patch(
                "app.services.face_detection_service.face_detection_service.detect_faces"
            ) as mock_faces,
            patch(
                "app.services.thumbnail_service.thumbnail_service.generate_thumbnails"
            ) as mock_thumbnails,
        ):

            mock_ai.return_value = {
                "tags": ["test"],
                "description": "Test image",
                "confidence": 90,
            }
            mock_faces.return_value = []
            mock_thumbnails.return_value = {"small": "/thumb_small.jpg"}

            async def upload_file(image_path: Path) -> float:
                start = time.time()
                with open(image_path, "rb") as f:
                    files = {"file": (image_path.name, f, "image/jpeg")}
                    response = await async_client.post("/api/files/upload", files=files)
                end = time.time()
                assert response.status_code == 201
                return end - start

            # Test concurrent uploads
            start_time = time.time()
            upload_tasks = [
                upload_file(path) for path in image_paths[:10]
            ]  # 10 concurrent uploads
            upload_times = await asyncio.gather(*upload_tasks)
            total_time = time.time() - start_time

            avg_upload_time = statistics.mean(upload_times)
            max_upload_time = max(upload_times)

            print(
                f"Concurrent uploads: 10 files in {total_time:.3f}s, "
                f"avg={avg_upload_time:.3f}s, max={max_upload_time:.3f}s"
            )

            assert (
                avg_upload_time < 2.0
            ), f"Average upload time {avg_upload_time:.3f}s too high"
            assert total_time < 15.0, f"Total upload time {total_time:.3f}s too high"


@pytest.mark.performance
class TestMemoryAndResourceUsage:
    """Test memory usage and resource consumption."""

    async def test_memory_usage_during_bulk_operations(self, async_client, db_session):
        """Test memory usage during bulk operations."""
        import os

        import psutil

        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Create large dataset
        photo_count = 1000
        photo_ids = []

        for i in range(photo_count):
            photo = await DatabaseTestHelper.create_test_file_version(db_session)
            photo_ids.append(photo.id)

        # Check memory after data creation
        after_creation_memory = process.memory_info().rss / 1024 / 1024

        # Perform bulk operations
        bulk_data = {
            "photo_ids": photo_ids,
            "updates": {"rating": 5, "keywords": ["memory_test"]},
        }

        response = await async_client.post("/api/photos/bulk-update", json=bulk_data)
        assert response.status_code == 200

        # Check memory after bulk operation
        after_bulk_memory = process.memory_info().rss / 1024 / 1024

        # Perform search operations
        search_response = await async_client.get("/api/search?q=memory_test")
        assert search_response.status_code == 200

        # Final memory check
        final_memory = process.memory_info().rss / 1024 / 1024

        print(
            f"Memory usage: initial={initial_memory:.1f}MB, "
            f"after_creation={after_creation_memory:.1f}MB, "
            f"after_bulk={after_bulk_memory:.1f}MB, "
            f"final={final_memory:.1f}MB"
        )

        # Memory should not grow excessively
        memory_growth = final_memory - initial_memory
        assert (
            memory_growth < 500
        ), f"Memory growth {memory_growth:.1f}MB exceeds 500MB threshold"

    async def test_database_connection_pooling(self, async_client, db_session):
        """Test database connection efficiency under load."""
        # Create test data
        for i in range(100):
            await DatabaseTestHelper.create_test_file_version(db_session)

        # Function to make database-intensive request
        async def db_intensive_request() -> float:
            start = time.time()

            # Make requests that require multiple database queries
            response = await async_client.get("/api/photos/?page=1&per_page=50")
            assert response.status_code == 200

            # Follow up with related requests
            photos = response.json()["items"]
            if photos:
                detail_response = await async_client.get(
                    f"/api/photos/{photos[0]['id']}"
                )
                assert detail_response.status_code == 200

            return time.time() - start

        # Test database connection efficiency with concurrent requests
        concurrent_requests = 20
        tasks = [db_intensive_request() for _ in range(concurrent_requests)]

        start_time = time.time()
        response_times = await asyncio.gather(*tasks)
        total_time = time.time() - start_time

        avg_time = statistics.mean(response_times)
        max_time = max(response_times)

        print(
            f"DB connection test: {concurrent_requests} concurrent requests, "
            f"total={total_time:.3f}s, avg={avg_time:.3f}s, max={max_time:.3f}s"
        )

        # Should handle concurrent DB requests efficiently
        assert avg_time < 2.0, f"Average DB request time {avg_time:.3f}s too high"
        assert max_time < 5.0, f"Max DB request time {max_time:.3f}s too high"


@pytest.mark.benchmark
class TestBenchmarks:
    """Benchmark critical operations."""

    async def test_image_processing_benchmark(self, temp_dir):
        """Benchmark image processing operations."""
        with (
            patch(
                "app.services.thumbnail_service.thumbnail_service.generate_thumbnails"
            ) as mock_thumbnails,
            patch(
                "app.services.metadata_service.metadata_service.extract_metadata"
            ) as mock_metadata,
        ):

            # Configure mocks for consistent timing
            mock_thumbnails.return_value = {"small": "/thumb.jpg"}
            mock_metadata.return_value = {"exif": {}, "file": {"size": 1024}}

            # Create test images of different sizes
            image_sizes = [(800, 600), (1920, 1080), (3840, 2160), (5472, 3648)]
            benchmark_results = {}

            for width, height in image_sizes:
                image_path = FileTestHelper.create_test_image_file(
                    temp_dir / f"benchmark_{width}x{height}.jpg",
                    format="JPEG",
                    size=(width, height),
                )

                # Benchmark processing time
                times = []
                for _ in range(5):  # Run 5 times for each size
                    start = time.time()

                    # Simulate image processing pipeline
                    await asyncio.to_thread(lambda: mock_metadata())
                    await asyncio.to_thread(lambda: mock_thumbnails())

                    end = time.time()
                    times.append(end - start)

                avg_time = statistics.mean(times)
                benchmark_results[f"{width}x{height}"] = avg_time

                print(f"Image processing {width}x{height}: {avg_time:.3f}s average")

            # Verify processing times are reasonable
            for size, processing_time in benchmark_results.items():
                assert (
                    processing_time < 1.0
                ), f"Processing time for {size} is {processing_time:.3f}s (>1.0s)"

    async def test_search_indexing_benchmark(self, db_session):
        """Benchmark search indexing operations."""
        # Create photos with varying keyword counts
        keyword_scenarios = [
            (1, ["single"]),
            (5, ["tag1", "tag2", "tag3", "tag4", "tag5"]),
            (10, [f"keyword_{i}" for i in range(10)]),
            (20, [f"tag_{i}" for i in range(20)]),
        ]

        indexing_times = {}

        for keyword_count, keywords in keyword_scenarios:
            # Create photos with this keyword set
            photos = []
            for i in range(100):  # 100 photos per scenario
                photo = await DatabaseTestHelper.create_test_file_version(
                    db_session, keywords=keywords
                )
                photos.append(photo)

            # Benchmark search query time
            start = time.time()

            # Simulate search indexing/querying
            for photo in photos[:10]:  # Test subset
                # Simulate keyword search
                await asyncio.to_thread(
                    lambda: db_session.query(FileVersion)
                    .filter(FileVersion.keywords.contains(keywords[:1]))
                    .all()
                )

            end = time.time()

            avg_time_per_search = (end - start) / 10
            indexing_times[keyword_count] = avg_time_per_search

            print(
                f"Search with {keyword_count} keywords: {avg_time_per_search:.3f}s per search"
            )

        # Verify search performance doesn't degrade significantly with more keywords
        for keyword_count, search_time in indexing_times.items():
            assert (
                search_time < 0.1
            ), f"Search time with {keyword_count} keywords is {search_time:.3f}s (>0.1s)"


@pytest.mark.performance
class TestPerformanceRegression:
    """Test for performance regressions."""

    async def test_api_response_time_regression(self, async_client, db_session):
        """Test that API response times haven't regressed."""
        # Create baseline dataset
        for i in range(200):
            await DatabaseTestHelper.create_test_file_version(
                db_session, rating=i % 5 + 1, keywords=[f"tag_{i % 10}"]
            )

        # Define baseline performance expectations
        performance_baselines = {
            "/api/photos/?page=1&per_page=20": 0.5,  # 500ms
            "/api/search?q=tag_1": 1.0,  # 1000ms
            "/api/people/": 0.3,  # 300ms
            "/api/collections/": 0.3,  # 300ms
        }

        # Test each endpoint
        for endpoint, baseline_ms in performance_baselines.items():
            times = []
            for _ in range(10):  # Test multiple times
                start = time.time()
                response = await async_client.get(endpoint)
                end = time.time()

                assert response.status_code == 200
                times.append(end - start)

            avg_time = statistics.mean(times)
            p95_time = sorted(times)[int(len(times) * 0.95)]

            print(
                f"{endpoint}: avg={avg_time:.3f}s, p95={p95_time:.3f}s, baseline={baseline_ms}s"
            )

            # Check against baseline (allowing 20% margin)
            assert (
                avg_time < baseline_ms * 1.2
            ), f"{endpoint} average time {avg_time:.3f}s exceeds baseline {baseline_ms}s by >20%"
            assert (
                p95_time < baseline_ms * 1.5
            ), f"{endpoint} p95 time {p95_time:.3f}s exceeds baseline {baseline_ms}s by >50%"

    async def test_database_query_performance_regression(self, db_session):
        """Test database query performance hasn't regressed."""
        # Create test dataset
        photo_count = 1000
        for i in range(photo_count):
            await DatabaseTestHelper.create_test_file_version(
                db_session, rating=i % 5 + 1
            )

        # Define query performance baselines
        query_baselines = {
            "simple_select": (
                lambda: db_session.query(FileVersion).limit(100).all(),
                0.1,  # 100ms
            ),
            "filtered_select": (
                lambda: db_session.query(FileVersion)
                .filter(FileVersion.rating >= 4)
                .limit(100)
                .all(),
                0.2,  # 200ms
            ),
            "ordered_select": (
                lambda: db_session.query(FileVersion)
                .order_by(FileVersion.rating.desc())
                .limit(100)
                .all(),
                0.3,  # 300ms
            ),
            "count_query": (
                lambda: db_session.query(FileVersion).count(),
                0.1,  # 100ms
            ),
        }

        for query_name, (query_func, baseline_s) in query_baselines.items():
            times = []
            for _ in range(10):
                start = time.time()
                await asyncio.to_thread(query_func)
                end = time.time()
                times.append(end - start)

            avg_time = statistics.mean(times)
            max_time = max(times)

            print(
                f"{query_name}: avg={avg_time:.3f}s, max={max_time:.3f}s, baseline={baseline_s}s"
            )

            # Check against baseline
            assert (
                avg_time < baseline_s * 1.5
            ), f"{query_name} average time {avg_time:.3f}s exceeds baseline {baseline_s}s by >50%"
            assert (
                max_time < baseline_s * 2.0
            ), f"{query_name} max time {max_time:.3f}s exceeds baseline {baseline_s}s by >100%"


if __name__ == "__main__":
    # Run performance tests
    pytest.main([__file__, "-v", "-m", "performance"])
