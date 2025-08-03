# Pictallion Python Backend Testing Guide

This document provides comprehensive guidance on testing the Pictallion Python backend, including test structure, execution, and best practices.

## Table of Contents

1. [Test Structure](#test-structure)
2. [Test Categories](#test-categories)
3. [Running Tests](#running-tests)
4. [Test Configuration](#test-configuration)
5. [Writing Tests](#writing-tests)
6. [Coverage Reports](#coverage-reports)
7. [Performance Testing](#performance-testing)
8. [CI/CD Integration](#cicd-integration)
9. [Troubleshooting](#troubleshooting)

## Test Structure

The test suite is organized into distinct categories with specific purposes:

```
server_py/tests/
├── conftest.py                           # Global pytest configuration and fixtures
├── utils/
│   └── test_helpers.py                   # Test utilities and helper classes
├── test_database_comprehensive.py        # Database model and relationship tests
├── test_services_comprehensive.py        # Service layer tests with mocking
├── test_api_routes_comprehensive.py      # API endpoint tests
├── test_integration_workflows.py         # End-to-end workflow tests
└── test_performance_load.py             # Performance and load tests
```

## Test Categories

### 1. Database Tests (`test_database_comprehensive.py`)

**Purpose**: Test SQLModel models, relationships, constraints, and database operations.

**Coverage**:
- All 14 SQLModel models (User, MediaAsset, FileVersion, Person, Face, etc.)
- Model validation and constraints
- Relationship integrity
- Database queries and performance
- Migration compatibility

**Markers**: `@pytest.mark.database`

### 2. Service Layer Tests (`test_services_comprehensive.py`)

**Purpose**: Test all 13 core services with comprehensive mocking.

**Services Tested**:
- AIService (OpenAI, Ollama integration)
- FaceDetectionService (face recognition)
- FileManagerService (file operations)
- ThumbnailService (image processing)
- MetadataService (EXIF extraction)
- DuplicateDetectionService (perceptual hashing)
- BurstDetectionService (photo sequences)
- AdvancedSearchService (complex queries)
- EventDetectionService (automatic event detection)
- LocationClusteringService (GPS clustering)
- ReverseGeocodingService (location lookup)
- PromptManagementService (AI prompt management)
- AINamingService (intelligent naming)

**Markers**: `@pytest.mark.service`

### 3. API Route Tests (`test_api_routes_comprehensive.py`)

**Purpose**: Test all FastAPI endpoints with request/response validation.

**Coverage**:
- Health and system endpoints
- Photo management routes
- People and face management
- Collection management (manual and smart)
- Search functionality (text, location, advanced)
- AI processing endpoints
- File upload/download operations
- Event management
- Error handling and validation

**Markers**: `@pytest.mark.api`

### 4. Integration Tests (`test_integration_workflows.py`)

**Purpose**: Test complete end-to-end workflows and feature interactions.

**Workflows**:
- Photo upload and processing pipeline
- Person identification and face assignment
- Collection creation and management
- Search and discovery workflows
- AI analysis pipelines
- Bulk operations
- Error recovery scenarios

**Markers**: `@pytest.mark.integration`

### 5. Performance Tests (`test_performance_load.py`)

**Purpose**: Benchmark performance and test system behavior under load.

**Tests**:
- Database query performance
- API response time benchmarks
- Concurrent request handling
- Memory usage monitoring
- Load testing scenarios
- Performance regression detection

**Markers**: `@pytest.mark.performance`, `@pytest.mark.load`, `@pytest.mark.benchmark`

## Running Tests

### Quick Test Commands

```bash
# Run all tests
pytest

# Run specific test categories
pytest -m database          # Database tests only
pytest -m service          # Service tests only
pytest -m api              # API tests only
pytest -m integration      # Integration tests only
pytest -m performance      # Performance tests only

# Run specific test files
pytest tests/test_database_comprehensive.py
pytest tests/test_api_routes_comprehensive.py

# Run with coverage
pytest --cov=app --cov-report=html --cov-report=term-missing

# Run with detailed output
pytest -v --tb=short

# Run tests in parallel (faster execution)
pytest -n auto
```

### Environment-Specific Testing

```bash
# Test with SQLite (default)
pytest

# Test with PostgreSQL
export DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"
pytest

# Test with specific Python version
python3.11 -m pytest
```

### Performance Testing

```bash
# Run performance tests only
pytest -m performance --durations=10

# Run load tests (caution: resource intensive)
pytest -m load --timeout=600

# Run benchmarks
pytest -m benchmark -v
```

## Test Configuration

### pytest.ini Settings

```ini
[tool:pytest]
minversion = 7.0
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
markers =
    database: Database model and query tests
    service: Service layer tests with mocking
    api: API endpoint tests
    integration: End-to-end workflow tests
    performance: Performance benchmarking tests
    load: Load testing (resource intensive)
    benchmark: Benchmarking critical operations
    slow: Tests that take longer than 5 seconds
addopts = 
    --strict-markers
    --strict-config
    --cov-fail-under=90
    --tb=short
    -ra
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
```

### Environment Variables

```bash
# Database configuration
DATABASE_URL=sqlite:///./test.db
TEST_DATABASE_URL=sqlite:///./test.db

# Application settings
ENVIRONMENT=test
SECRET_KEY=test-secret-key-for-testing-only

# External service configuration (for integration tests)
OPENAI_API_KEY=test-key-or-skip
OLLAMA_HOST=http://localhost:11434

# Test-specific settings
PYTEST_TIMEOUT=300
COVERAGE_THRESHOLD=90
```

## Writing Tests

### Test Structure Best Practices

```python
@pytest.mark.api
class TestPhotoRoutes:
    """Test photo management API endpoints."""
    
    async def test_list_photos(self, async_client, db_session):
        """Test photo listing with pagination."""
        # Arrange: Create test data
        photos = []
        for i in range(5):
            photo = await DatabaseTestHelper.create_test_file_version(
                db_session, rating=i + 1
            )
            photos.append(photo)
        
        # Act: Make API request
        response = await async_client.get("/api/photos/")
        
        # Assert: Verify response
        assert response.status_code == 200
        data = response.json()
        APITestHelper.assert_pagination_structure(data)
        assert len(data["items"]) == 5
```

### Using Test Helpers

```python
# Database helpers
photo = await DatabaseTestHelper.create_test_file_version(
    db_session, 
    rating=5, 
    keywords=["test", "photo"],
    location="40.7589,-73.9851"
)

person = await DatabaseTestHelper.create_test_person(
    db_session, 
    name="Test Person",
    face_count=3
)

# File helpers
image_path = FileTestHelper.create_test_image_file(
    temp_dir / "test.jpg",
    format="JPEG",
    size=(1920, 1080)
)

# API helpers
APITestHelper.assert_pagination_structure(response_data)
APITestHelper.assert_api_response_structure(
    response_data, 
    required_fields=["id", "name", "created_at"]
)

# Performance helpers
with PerformanceTestHelper.measure_time("database_query"):
    result = await db_session.execute(query)
```

### Mocking External Services

```python
@patch('app.services.ai_service.ai_service.analyze_image')
async def test_ai_analysis(mock_analyze, async_client, db_session):
    """Test AI image analysis with mocked service."""
    # Configure mock
    mock_analyze.return_value = {
        "tags": ["nature", "landscape"],
        "description": "Beautiful landscape",
        "confidence": 92
    }
    
    # Create test photo
    photo = await DatabaseTestHelper.create_test_file_version(db_session)
    
    # Test AI analysis
    response = await async_client.post(f"/api/ai/analyze/{photo.id}")
    
    # Verify mock was called and response is correct
    mock_analyze.assert_called_once()
    assert response.status_code == 200
    data = response.json()
    assert "nature" in data["tags"]
```

## Coverage Reports

### Generating Coverage Reports

```bash
# Generate HTML coverage report
pytest --cov=app --cov-report=html
# View at: htmlcov/index.html

# Generate XML coverage report (for CI/CD)
pytest --cov=app --cov-report=xml

# Generate terminal coverage report
pytest --cov=app --cov-report=term-missing

# Generate all report formats
pytest --cov=app --cov-report=html --cov-report=xml --cov-report=term-missing
```

### Coverage Targets

| Component | Target Coverage | Current Status |
|-----------|----------------|----------------|
| Overall | ≥90% | ✅ |
| Database Models | ≥95% | ✅ |
| Service Layer | ≥90% | ✅ |
| API Routes | ≥85% | ✅ |
| Core Business Logic | ≥95% | ✅ |

### Coverage Analysis

```bash
# Check coverage by file
pytest --cov=app --cov-report=term-missing | grep -E "(TOTAL|app/)"

# Check specific module coverage
pytest --cov=app.services --cov-report=term-missing

# Fail build if coverage below threshold
pytest --cov=app --cov-fail-under=90
```

## Performance Testing

### Performance Benchmarks

| Operation | Target Time | Benchmark |
|-----------|-------------|-----------|
| Photo listing (100 items) | <500ms | `test_photo_listing_performance` |
| Text search | <1000ms | `test_search_performance` |
| Database queries | <100ms | `test_photo_query_performance` |
| File upload | <2000ms | `test_upload_stress_test` |
| Bulk operations (100 items) | <3000ms | `test_bulk_operations_performance` |

### Running Performance Tests

```bash
# Run all performance tests
pytest -m performance -v --durations=10

# Run specific performance categories
pytest -m "performance and not load"  # Exclude load tests
pytest -m benchmark                   # Benchmarks only
pytest -m load                       # Load tests only

# Run with timeout for long-running tests
pytest -m performance --timeout=600
```

### Performance Monitoring

```python
# Example performance test
async def test_api_performance(self, async_client, db_session):
    """Test API endpoint performance."""
    # Create test data
    for i in range(1000):
        await DatabaseTestHelper.create_test_file_version(db_session)
    
    # Measure response time
    times = []
    for _ in range(10):
        start = time.time()
        response = await async_client.get("/api/photos/?per_page=50")
        end = time.time()
        
        assert response.status_code == 200
        times.append(end - start)
    
    # Verify performance
    avg_time = statistics.mean(times)
    assert avg_time < 0.5, f"Average response time {avg_time:.3f}s exceeds 500ms"
```

## CI/CD Integration

### GitHub Actions Workflow

The test suite is integrated with GitHub Actions for automated testing on every push and pull request.

**Workflow Jobs**:
1. **Lint**: Code quality checks (flake8, black, isort, mypy)
2. **Unit Tests**: Database and service tests across Python versions
3. **API Tests**: FastAPI endpoint testing
4. **Integration Tests**: End-to-end workflow testing with PostgreSQL
5. **Performance Tests**: Performance regression detection
6. **Security Scan**: Vulnerability scanning with safety and bandit
7. **Coverage Report**: Comprehensive coverage analysis

### Workflow Triggers

```yaml
on:
  push:
    branches: [ main, develop ]
    paths: [ 'server_py/**' ]
  pull_request:
    branches: [ main, develop ]
    paths: [ 'server_py/**' ]
```

### Coverage Integration

Coverage reports are automatically uploaded to Codecov for tracking and visualization:

```bash
# Coverage is uploaded for each test category
- unit-tests
- api-tests  
- integration-tests
- comprehensive
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Error: Could not connect to database
# Solution: Check DATABASE_URL and ensure database is running
export DATABASE_URL="sqlite:///./test.db"
# or
export DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"
```

#### 2. Async Test Issues

```bash
# Error: RuntimeError: asyncio.run() cannot be called from a running event loop
# Solution: Use pytest-asyncio markers
@pytest.mark.asyncio
async def test_async_function():
    pass
```

#### 3. Mock/Patch Issues

```python
# Error: Mock not working as expected
# Solution: Ensure correct import path
@patch('app.services.ai_service.ai_service.method')  # Correct
@patch('app.services.ai_service.method')             # Incorrect
```

#### 4. Fixture Scope Issues

```python
# Error: Fixture teardown issues
# Solution: Use appropriate fixture scope
@pytest.fixture(scope="function")  # New instance per test
@pytest.fixture(scope="session")   # One instance per test session
```

#### 5. Performance Test Failures

```bash
# Error: Performance tests failing on CI
# Solution: Adjust performance thresholds for CI environment
# CI systems are typically slower than development machines
assert avg_time < 2.0  # Instead of 1.0 for CI
```

### Debug Commands

```bash
# Run tests with maximum verbosity
pytest -vvv --tb=long

# Run single test with debugging
pytest tests/test_api_routes_comprehensive.py::TestPhotoRoutes::test_list_photos -vvv

# Run tests with profiling
pytest --profile

# Run tests with coverage debugging
pytest --cov=app --cov-report=term-missing --cov-report=html -v
```

### Environment Debugging

```python
# Add to test for environment debugging
def test_environment_debug():
    """Debug test environment configuration."""
    import os
    import sys
    
    print(f"Python version: {sys.version}")
    print(f"Database URL: {os.getenv('DATABASE_URL')}")
    print(f"Environment: {os.getenv('ENVIRONMENT')}")
    print(f"Working directory: {os.getcwd()}")
```

## Best Practices

### 1. Test Organization
- Group related tests in classes
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Test Data Management
- Use factories for test data creation
- Clean up test data automatically
- Avoid test interdependencies

### 3. Mocking Strategy
- Mock external services and APIs
- Use dependency injection for mockable components
- Verify mock interactions

### 4. Performance Testing
- Set realistic performance thresholds
- Account for CI environment overhead
- Monitor performance trends over time

### 5. Coverage Goals
- Aim for >90% overall coverage
- Focus on critical business logic
- Don't sacrifice quality for coverage numbers

## Contributing

When adding new tests:

1. Follow existing test patterns and structure
2. Add appropriate markers for test categorization
3. Update documentation if adding new test categories
4. Ensure tests pass locally before pushing
5. Monitor CI pipeline for any failures

For questions or issues with the test suite, please refer to the project documentation or create an issue in the repository.