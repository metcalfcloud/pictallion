# Pictallion Photo Management Application

## Overview

Pictallion is a comprehensive photo and video management application built with a modern full-stack architecture. The application implements a tiered processing system (Silver → Gold) with AI-powered features for media analysis, face recognition, and automated tagging.

**User Preferences**: Simple, everyday language. App name combines "pictures" + "medallion" to reflect the tiered system and precious nature of photos.

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript, Wouter routing, TanStack Query, Shadcn/ui, Tailwind CSS
- **Backend**: Node.js + Express + TypeScript, PostgreSQL + Drizzle ORM, Neon serverless database
- **AI**: Ollama (local) with OpenAI fallback for image analysis and tagging
- **Build**: Vite for frontend, esbuild for backend

### Project Structure
- `/client` - React frontend application
- `/server` - Express.js backend API  
- `/shared` - Shared TypeScript schemas and types
- `/data/media` - Media storage (Silver/Gold tiers organized by date)

## Core Features

### Tiered Processing System
1. **Upload Staging** - Temporary dropzone for incoming files
2. **Silver Tier** - AI-processed media with enriched metadata (first immutable tier, auto-created on upload)
3. **Gold Tier** - Curated, finalized media with embedded metadata (manually promoted from Silver)

### AI-Powered Processing
- **Image Analysis**: Ollama/OpenAI Vision for comprehensive understanding
- **Face Detection**: TensorFlow.js neural networks with 128-dimensional embeddings
- **Smart Tagging**: Automated content-based tag generation
- **Event Detection**: Holiday and birthday recognition with confidence scoring
- **Burst Photo Grouping**: 95%+ similarity detection within ±1 minute windows
- **Natural Descriptions**: Family-friendly, conversational descriptions

### Database Schema
- **users**: Authentication and management
- **mediaAssets**: Core media records with original filenames
- **fileVersions**: Processing tiers (Silver/Gold only - Bronze eliminated)
- **assetHistory**: Complete audit trail with promotion tracking
- **people**: Face recognition and relationships
- **collections**: Custom photo organization

### User Interface
- **Dashboard**: Statistics and recent activity overview
- **Gallery**: Grid/list view with advanced filtering and search
- **Upload**: Unified drag-and-drop with conflict resolution
- **People**: Face detection and relationship management
- **Events**: Browse photos by detected celebrations
- **Collections**: Custom photo organization and albums

## Recent Major Updates

### January 2025 - Professional Features Complete
- **Face Recognition**: Neural network-based detection with TensorFlow.js
- **Advanced Search**: Multi-criteria filtering (date, camera, tags, GPS, faces)
- **Collections Management**: Custom albums with drag-and-drop organization
- **Batch Operations**: Professional bulk photo management
- **Enhanced Analytics**: Comprehensive dashboard insights

### July 2025 - Architecture Refinements
- **Silver/Gold Architecture**: Eliminated Bronze tier for simplified workflow
- **Natural AI Descriptions**: Family-friendly descriptions with named face integration
- **Enhanced Relationship UI**: Directional family relationships with clear display
- **Immutable Silver Policy**: Silver files protected from modification during reprocessing
- **Unified Upload System**: Consolidated three upload components into one

### Recent Fixes
- Fixed face assignment preservation during AI reprocessing
- Resolved duplicate file creation during reprocessing
- Enhanced upload queue management with conflict detection
- Complete dark mode compatibility across all components
- Photo organization by actual date taken instead of upload date

## Development & Deployment

### Environment Configuration
- **Database**: `DATABASE_URL` for Neon PostgreSQL connection
- **AI Service**: Ollama on `http://localhost:11434` (configurable via `OLLAMA_BASE_URL`)
- **Models**: `OLLAMA_MODEL` (llava:latest), `OLLAMA_TEXT_MODEL` (llama3.2:latest)
- **Storage**: Local file storage at `/data/media`

### Deployment Options
- **Development**: Vite dev server + tsx backend watcher
- **Production**: Native packages for Linux/Windows with installation scripts
- **Docker**: Containerized deployment with PostgreSQL and Ollama integration
- **Cloud**: VPS deployment with managed services

### Build System
- **Frontend**: Vite production build with asset optimization
- **Backend**: esbuild bundling with external package handling
- **Packaging**: Automated scripts for cross-platform distribution
- **CI/CD**: GitHub Actions with security scanning and automated releases

## Key Architectural Decisions

1. **Tiered Processing**: Quality control with progressive enhancement (Silver → Gold)
2. **Local AI First**: Ollama for privacy with OpenAI fallback for advanced features
3. **Immutable Silver**: First processed tier is protected from modification
4. **Shared Schemas**: Full-stack TypeScript type safety
5. **File System Organization**: Date-based directory structure for scalability
6. **Neural Face Detection**: Industry-standard accuracy over heuristic methods

The application prioritizes reliability, user experience, and professional-grade photo management capabilities while maintaining clean separation of concerns and easy deployment across platforms.