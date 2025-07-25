# Pictallion Photo Management Application

## Overview

Pictallion is a comprehensive photo and video management application built with a modern full-stack architecture. The application implements a tiered processing system (Bronze → Silver → Gold) with AI-powered features for media analysis, face recognition, and automated tagging. It's designed to handle the complete lifecycle of media assets from ingestion through curation.

## User Preferences

Preferred communication style: Simple, everyday language.
App name: Pictallion (combination of "pictures" + "medallion" - chosen by Paul to reflect the tiered system and the precious nature of photos)
Deployment preference: Wants to package and distribute the app for easy installation on Linux and Windows systems

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with TypeScript support

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **File Handling**: Multer for multipart uploads
- **AI Integration**: OpenAI API for image analysis

### Project Structure
- `/client` - React frontend application
- `/server` - Express.js backend API
- `/shared` - Shared TypeScript schemas and types
- `/data/media` - Media storage directories (Bronze/Silver/Gold tiers)

## Key Components

### Database Schema
The application uses a relational database with four main tables:
- **users**: User authentication and management
- **mediaAssets**: Core media asset records with original filenames
- **fileVersions**: Different processing tiers of each asset (Bronze/Silver/Gold)
- **assetHistory**: Audit trail of all asset operations

### Tiered Processing System
1. **Bronze Tier**: Raw ingested media with basic metadata stored in batch folders
2. **Silver Tier**: AI-processed media with enriched metadata organized by date
3. **Gold Tier**: Curated, finalized media with embedded metadata

### AI Processing Pipeline
- **Image Analysis**: Ollama with llava:latest for local AI image understanding
- **Metadata Extraction**: EXIF data parsing for technical details
- **Object Detection**: Confidence-scored object identification
- **Tagging**: Automated tag generation based on content analysis
- **Description Generation**: Short and long descriptions for searchability
- **Fallback Mode**: Basic metadata generation when Ollama is not available

### File Management
- **Directory Structure**: Automated creation of required media directories
- **Batch Organization**: Bronze tier files organized in dated batches (max 500 files)
- **Duplicate Detection**: Hash-based duplicate identification and handling
- **File Validation**: MIME type checking and size limits (50MB)

### User Interface
- **Dashboard**: Overview with statistics and recent activity
- **Gallery**: Grid/list view with filtering by tier and search capabilities
- **Upload**: Drag-and-drop interface with progress tracking
- **Photo Detail Modal**: Comprehensive metadata display and editing

## Data Flow

1. **Media Ingestion**: Files uploaded via dropzone → temporary storage → Bronze tier
2. **AI Processing**: Bronze → Silver tier with AI analysis and metadata enrichment
3. **Human Review**: Silver tier metadata validation and editing
4. **Promotion**: Silver → Gold tier with finalized, embedded metadata
5. **Storage**: Organized file structure with comprehensive audit logging

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL serverless database
- **AI Service**: Ollama for local AI image analysis (llava:latest for vision, llama3.2:latest for text)
- **File Processing**: EXIF parsing for technical metadata extraction
- **Authentication**: Session-based with PostgreSQL session store

### Frontend Libraries
- **UI Components**: Radix UI primitives with Shadcn/ui wrapper
- **Icons**: Lucide React icon set
- **Form Handling**: React Hook Form with Zod validation
- **File Upload**: React Dropzone for drag-and-drop functionality

### Backend Libraries
- **Database**: Drizzle ORM with Zod schema validation
- **File Upload**: Multer with configurable storage
- **WebSocket**: ws library for Neon database connections

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite development server with HMR
- **Backend**: tsx for TypeScript execution with file watching
- **Database**: Neon development database with automatic migrations

### Production Build
- **Frontend**: Vite production build with asset optimization
- **Backend**: esbuild for server bundling with external package handling
- **Static Assets**: Served via Express with proper caching headers

### Environment Configuration
- **Database**: `DATABASE_URL` environment variable for connection string
- **AI Service**: Ollama running locally on `http://localhost:11434` (configurable via `OLLAMA_BASE_URL`)
- **AI Models**: `OLLAMA_MODEL` (default: llava:latest) and `OLLAMA_TEXT_MODEL` (default: llama3.2:latest)
- **Media Storage**: Local file storage at `/data/media` with organized directory structure

### Key Architectural Decisions

1. **Tiered Processing**: Separates raw uploads from processed content, enabling quality control and progressive enhancement
2. **Shared Schema**: TypeScript schemas shared between frontend and backend ensure type safety across the stack
3. **Serverless Database**: Neon PostgreSQL provides scalable, managed database infrastructure
4. **AI-First Metadata**: Local Ollama integration provides rich, searchable metadata automatically without external dependencies
5. **File System Organization**: Structured directory hierarchy supports scalability and maintenance
6. **Session-Based Auth**: Simple authentication model suitable for single-user or small team deployment

The application prioritizes reliability, scalability, and user experience while maintaining a clean separation of concerns between media processing, data management, and user interface layers.

## Deployment & Distribution

The application includes comprehensive packaging and deployment tools:

### Packaging Scripts
- **Native Packaging**: `scripts/package.sh` creates distributable archives for Linux/Windows
- **Docker Support**: `scripts/build-docker.sh` sets up containerized deployment
- **Installation Scripts**: Automated installers for both Unix and Windows systems

### Distribution Features
- Self-contained packages with all dependencies
- Automated installation scripts with system requirement checks
- Environment configuration templates
- Comprehensive documentation and troubleshooting guides
- Support for both local and cloud database configurations

### Deployment Options
- **Personal/Local**: Native packages with simple node.js execution
- **Team/Office**: Docker Compose with integrated PostgreSQL and Ollama
- **Production**: Docker containers with external managed services
- **Cloud**: VPS deployment with managed databases and SSL configuration

The packaging system ensures easy distribution and installation across different operating systems while maintaining security best practices and providing clear setup instructions for end users.