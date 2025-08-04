# Pictallion - AI-Powered Photo Management

---

## 🐍 Python FastAPI Backend

Pictallion now uses a robust Python backend built with FastAPI, replacing the legacy TypeScript/Node.js backend. All core services, database layers, and API routes have been systematically converted and tested for full compatibility.

- **Backend:** Python 3.11+, FastAPI, SQLModel, SQLAlchemy, Alembic
- **Frontend:** React 18+, TypeScript, Tailwind CSS
- **AI/ML:** Ollama (local), OpenAI (cloud), TensorFlow, face_recognition, dlib
- **Database:** PostgreSQL (production), SQLite (development)
- **Testing:** pytest, coverage, CI/CD via GitHub Actions

### 📦 Key Backend Features

- 13 core Python services (AI, face detection, file management, search, events, collections, etc.)
- 150+ API endpoints, fully documented and compatible
- Tiered photo processing (Bronze → Silver → Gold)
- Advanced metadata, EXIF/XMP embedding, and batch operations
- Secure file uploads, validation, and session management
- Scalable Docker deployment and environment configuration

### 🏗️ Architecture Overview

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for detailed diagrams and service relationships.

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

### 🔄 Migration Notes

- All TypeScript backend code has been removed.
- Data migration and schema conversion are complete.
- See [`MIGRATION_GUIDE.md`](MIGRATION_GUIDE.md) for process, lessons, and rollback.

### 📚 Documentation

- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md): Full FastAPI endpoint reference, request/response schemas, authentication, error handling, usage examples.
- [`DEPLOYMENT.md`](DEPLOYMENT.md): Production Docker setup, environment variables, scaling, and automation.
- [`DEVELOPMENT.md`](DEVELOPMENT.md): Dual frontend/backend development workflow.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): System, service, and database diagrams.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): Python backend contribution guidelines, code style, and testing.
- [`SECURITY.md`](SECURITY.md): Security best practices, authentication, and operational security.

### 🚀 Quick Start

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for production deployment and [`DEVELOPMENT.md`](DEVELOPMENT.md) for local development setup.

---

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/pictallion/releases)
[![Python](https://img.shields.io/badge/Python-3.11+-green.svg)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-blue.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/yourusername/pictallion/workflows/CI%2FCD/badge.svg)](https://github.com/yourusername/pictallion/actions)
[![Docker](https://img.shields.io/badge/Docker-Available-blue.svg)](https://github.com/yourusername/pictallion/pkgs/container/pictallion)

<div align="center">
  <img src="docs/pictallion-logo.png" alt="Pictallion Logo" width="400"/>
  <h1>Pictallion</h1>
  <p><em>AI-Powered Photo Management Platform</em></p>
</div>

A comprehensive photo management platform with intelligent tiered processing (Bronze → Silver → Gold) and AI-powered metadata generation. Features professional-grade capabilities including face recognition, advanced search, collections management, and batch operations.

![Pictallion Dashboard](docs/dashboard-screenshot.png)
*Modern dashboard with comprehensive analytics and tiered photo management*

![Pictallion Gallery](docs/gallery-screenshot.png)
*Advanced gallery with filtering, search, and batch operations*

## ✨ Key Features

### 🎯 **Tiered Processing System**
- **Bronze Tier**: Raw uploads with basic metadata
- **Silver Tier**: AI-processed with enriched metadata and tags
- **Gold Tier**: Curated, finalized media with embedded metadata

### 🤖 **Dual AI Processing**
- **Ollama Integration**: Local AI processing with llava:latest for privacy
- **OpenAI Integration**: Cloud-based processing with GPT-4 Vision
- **Intelligent Fallback**: Seamless switching between providers

### 👥 **Professional Photo Management**
- **Face Recognition**: Detect and organize photos by people
- **Advanced Search**: Filter by date, camera, tags, AI confidence, location, and more
- **Collections & Albums**: Organize photos into custom collections
- **Batch Operations**: Bulk tagging, organizing, exporting, and AI processing

### 📊 **Comprehensive Analytics**
- **Upload Trends**: Track photo ingestion over time
- **Tier Distribution**: Monitor processing pipeline efficiency
- **AI Processing Stats**: Success rates and performance metrics
- **Storage Insights**: Breakdown by tier and file types

### 🎨 **Modern Interface**
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Drag & Drop**: Intuitive file upload with progress tracking
- **Real-time Updates**: Live status updates during processing
- **Professional UI**: Clean, modern design built with React and Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher (for frontend development)
- PostgreSQL database (local or cloud)
- Optional: Ollama for local AI processing
- Optional: OpenAI API key for cloud AI processing

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pictallion.git
   cd pictallion
   ```

2. **Install Python backend dependencies**
   ```bash
   cd server_py
   pip install -r requirements.txt
   ```

3. **Install frontend dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and AI provider settings
   ```

5. **Set up the database**
   ```bash
   cd server_py
   python manage_db.py migrate
   ```

6. **Start the backend server**
   ```bash
   cd server_py
   python -m uvicorn app.main:app --reload --port 8000
   ```

7. **Start the frontend development server**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   Navigate to `http://localhost:5173` (frontend) - API proxy configured to `http://localhost:8000`

### First Steps

1. **Upload Photos**: Use the Upload page to add your first photos
2. **AI Processing**: Click "Process with AI" on Bronze tier photos
3. **Create Collections**: Organize your photos into custom albums
4. **Advanced Search**: Use filters to find specific photos quickly
5. **Batch Operations**: Select multiple photos for bulk actions

## 🖼️ Screenshots

### Dashboard
The main dashboard provides comprehensive analytics and quick access to recent photos, processing statistics, and system health.

### Gallery View
Advanced photo gallery with tier-based filtering, search capabilities, and batch selection for professional workflow management.

### Collections Management
Organize photos into custom collections and albums with drag-and-drop simplicity and advanced metadata management.

### Advanced Search
Powerful search interface with filters for date ranges, camera settings, AI confidence scores, file types, and detected content.

## 📦 Distribution

### For End Users

Create distributable packages:

```bash
# Create native packages for distribution
./scripts/ci/package.sh

# Or create Docker setup
./scripts/build-docker.sh
```

This creates installation packages that recipients can easily install on Windows, macOS, or Linux.

### Docker Deployment

```bash
# Test Docker configuration
./scripts/test-docker-config.sh

# Quick Docker setup with all services
./scripts/docker-setup.sh
```

Includes PostgreSQL database and Ollama for complete local setup with:
- Multi-stage Docker build for optimized images
- Non-root security configuration
- Health checks and monitoring
- Persistent data volumes

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/pictallion

# Server
PORT=8000

# AI Providers
AI_PROVIDER=ollama  # Options: ollama, openai, both
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava:latest
OLLAMA_TEXT_MODEL=llama3.2:latest
OPENAI_API_KEY=your_openai_api_key
```

### AI Provider Setup

**Ollama (Local Processing):**
1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull required models: `ollama pull llava:latest`
3. Start Ollama: `ollama serve`

**OpenAI (Cloud Processing):**
1. Get API key from [OpenAI Platform](https://platform.openai.com)
2. Add to environment variables
3. Configure in AI Settings panel

## 📁 Project Structure

```
pictallion/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and API client
├── server_py/              # Python FastAPI backend
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── core/          # Core functionality
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities
│   ├── requirements.txt   # Python dependencies
│   └── manage_db.py       # Database management
├── shared/                 # Shared TypeScript types (for frontend)
├── data/                   # Photo storage
│   └── media/
│       ├── bronze/        # Raw uploads
│       ├── silver/        # AI processed
│       └── gold/          # Curated photos
├── scripts/               # Build and deployment scripts
└── docs/                  # Documentation
```

## 🔄 Workflow

1. **Upload Photos**: Drag and drop photos into the upload area
2. **Bronze Tier**: Photos start here with basic EXIF metadata
3. **AI Processing**: Process Bronze → Silver to add AI-generated tags and descriptions
4. **Review & Edit**: Modify AI metadata as needed
5. **Promote to Gold**: Finalize photos with embedded metadata
6. **Search & Organize**: Use advanced search to find and organize your collection

## 🛠️ Development

### Development Commands

```bash
# Frontend
npm run dev          # Start frontend development server
npm run build        # Build frontend for production
npm run check        # TypeScript checking

# Backend
cd server_py
python -m uvicorn app.main:app --reload  # Start backend development server
python manage_db.py migrate              # Run database migrations
python -m pytest                         # Run backend tests
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Wouter (routing)
- **Backend**: Python 3.11, FastAPI, SQLAlchemy
- **Database**: PostgreSQL with Alembic migrations
- **AI**: Ollama (local) and OpenAI (cloud) integration
- **Storage**: Local file system with organized directory structure

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📖 Documentation

- [Deployment Guide](DEPLOYMENT.md) - Comprehensive deployment options
- [Ollama Setup](OLLAMA_SETUP.md) - Local AI processing setup
- [Contributing Guide](CONTRIBUTING.md) - Development guidelines
- [Security Policy](SECURITY.md) - Security best practices and reporting

## 🔒 Security

- Environment variables for sensitive configuration
- Session-based authentication
- File upload validation and security checks
- SQL injection prevention with parameterized queries

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋 Support

- 📧 Email: support@pictallion.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/pictallion/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/pictallion/discussions)

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) for local AI processing
- [OpenAI](https://openai.com) for cloud AI services
- [Shadcn/ui](https://ui.shadcn.com) for beautiful UI components
- [Lucide](https://lucide.dev) for icons

---

Made with ❤️ for photographers and photo enthusiasts