# Pictallion - AI-Powered Photo Management

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/pictallion/releases)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/yourusername/pictallion/workflows/CI%2FCD/badge.svg)](https://github.com/yourusername/pictallion/actions)
[![Docker](https://img.shields.io/badge/Docker-Available-blue.svg)](https://github.com/yourusername/pictallion/pkgs/container/pictallion)

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

- Node.js 18 or higher
- PostgreSQL database (local or cloud)
- Optional: Ollama for local AI processing
- Optional: OpenAI API key for cloud AI processing

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pictallion.git
   cd pictallion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and AI provider settings
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5000`

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
PORT=5000
NODE_ENV=development

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
├── server/                 # Express.js backend
│   ├── services/           # Business logic
│   │   ├── ai.ts          # AI processing
│   │   └── fileManager.ts # File operations
│   ├── routes.ts          # API routes
│   └── index.ts           # Server entry point
├── shared/                 # Shared TypeScript types
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
npm run dev          # Start development server
npm run build        # Build for production
npm run check        # Type checking
npm run db:push      # Push database schema changes
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Wouter (routing)
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
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