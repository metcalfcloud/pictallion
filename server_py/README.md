# Pictallion Python Backend

FastAPI-based backend for the Pictallion photo management application with AI processing capabilities.

## Architecture

This Python backend is designed to replace the existing TypeScript/Express.js backend while maintaining full API compatibility and preserving all existing functionality.

### Technology Stack

- **Framework**: FastAPI with async/await support
- **Database**: SQLModel + SQLAlchemy (SQLite for development, PostgreSQL for production)
- **AI/ML**: TensorFlow, face_recognition, OpenAI, Ollama
- **Image Processing**: Pillow, OpenCV, piexif
- **Testing**: pytest with async support

## Project Structure

```
server_py/
├── app/
│   ├── api/              # API route definitions
│   ├── core/             # Configuration and database setup
│   ├── models/           # SQLModel data models
│   ├── services/         # Business logic services
│   ├── utils/            # Utility functions
│   └── main.py           # FastAPI application entry point
├── tests/                # Test suite
├── requirements.txt      # Python dependencies
├── pyproject.toml        # Project configuration
├── Dockerfile           # Container configuration
└── README.md            # This file
```

## Development Setup

### Prerequisites

- Python 3.11+
- pip or poetry for dependency management

### Installation

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp ../.env.example .env
# Edit .env with your configuration
```

### Running the Development Server

```bash
# Using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using the main module
python -m app.main server
```

The API will be available at:
- **API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Configuration

The application uses environment variables for configuration. Key settings include:

- `DB_TYPE`: Database type (sqlite/postgres)
- `DATABASE_URL`: Database connection string
- `AI_PROVIDER`: AI provider (ollama/openai)
- `OPENAI_API_KEY`: OpenAI API key (if using OpenAI)
- `OLLAMA_BASE_URL`: Ollama server URL (if using Ollama)

See `.env.example` in the project root for a complete list of configuration options.

## API Compatibility

This Python backend maintains 100% API compatibility with the existing TypeScript backend:

- All existing endpoints are preserved
- Request/response formats remain unchanged
- Database schema is maintained
- File paths and storage structure are preserved

## Testing

Run the test suite:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test categories
pytest tests/test_api.py
pytest tests/test_services.py
```

## Docker Deployment

### Development
```bash
docker build --target development -t pictallion-backend:dev .
docker run -p 8000:8000 -v $(pwd):/app pictallion-backend:dev
```

### Production
```bash
docker build --target production -t pictallion-backend:prod .
docker run -p 8000:8000 pictallion-backend:prod
```

## Development Status

This is the foundational setup for the Python backend. Current status:

- ✅ Project structure and configuration
- ✅ FastAPI application with middleware and error handling
- ✅ Database configuration with SQLModel
- ✅ Placeholder API routes and services
- ✅ Basic models for media assets and faces
- ✅ Test framework setup
- 🔄 **Next Steps**: Implement core services and API endpoints

## Implementation Phases

### Phase 1: Core Foundation (Current)
- [x] Project structure and dependencies
- [x] Database layer with SQLModel
- [x] Configuration management
- [ ] Basic photo CRUD operations

### Phase 2: Essential Features
- [ ] AI service integration (OpenAI/Ollama)
- [ ] Face detection and recognition
- [ ] File upload and processing
- [ ] Thumbnail generation

### Phase 3: Advanced Features
- [ ] Smart collections and search
- [ ] Event detection and clustering
- [ ] Duplicate and burst detection
- [ ] Location services

### Phase 4: Migration and Optimization
- [ ] Data migration from TypeScript backend
- [ ] Performance optimization
- [ ] Production deployment
- [ ] Complete API compatibility testing

## Contributing

1. Follow the existing code structure and patterns
2. Add tests for new functionality
3. Use type hints throughout
4. Follow FastAPI best practices
5. Update documentation for new features

## License

Same license as the main Pictallion project.