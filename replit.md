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
- `/data/media` - Media storage directories (Silver/Gold tiers organized by date)

## Key Components

### Database Schema
The application uses a relational database with four main tables:
- **users**: User authentication and management
- **mediaAssets**: Core media asset records with original filenames
- **fileVersions**: Processing tiers of each asset (Silver/Gold only)
- **assetHistory**: Audit trail of all asset operations

### Tiered Processing System
1. **Upload Staging**: Temporary upload area for incoming files (not tracked in database)
2. **Silver Tier**: AI-processed media with enriched metadata organized by date (first immutable tier)
3. **Gold Tier**: Curated, finalized media with embedded metadata and human review

### AI Processing Pipeline
- **Image Analysis**: OpenAI Vision API for comprehensive image understanding
- **Metadata Extraction**: EXIF data parsing for technical details
- **Object Detection**: Confidence-scored object identification
- **Tagging**: Automated tag generation based on content analysis
- **Description Generation**: Short and long descriptions for searchability
- **Face Detection**: TensorFlow-based face recognition and cropping
- **Burst Photo Detection**: Intelligent grouping of similar photos taken within time windows
- **Event Detection**: Automatic holiday and birthday detection with confidence scoring
- **Age Calculation**: Smart age calculation for birthday events based on photo date vs. birthdate

### File Management
- **Directory Structure**: Automated creation of Silver and Gold tier directories organized by date
- **Direct Processing**: Files processed directly from upload to Silver tier with AI analysis
- **Duplicate Detection**: Handled during ingestion to prevent duplicates from entering the system
- **Burst Photo Grouping**: 95%+ similarity detection within ±1 minute time windows
- **File Validation**: MIME type checking and size limits (50MB)

### User Interface
- **Dashboard**: Overview with Silver/Gold statistics and recent activity
- **Gallery**: Grid/list view with filtering by tier and search capabilities
- **Upload**: Consolidated upload system with direct-to-Silver processing, drag-and-drop interface, progress tracking, and advanced conflict resolution
- **Burst Photos**: Intelligent grouping and selection interface for burst sequences
- **People**: Face detection and person management
- **Photo Detail Modal**: Comprehensive metadata display, editing, and event detection
- **Events Page**: Browse photos by detected events and celebrations
- **Event Settings**: Configure holiday detection for different countries

## Data Flow

1. **Media Ingestion**: Files uploaded via dropzone → temporary staging → direct processing to Silver tier with AI analysis
2. **Burst Analysis**: Silver tier photos analyzed for burst sequences (95%+ similarity within ±1 minute)
3. **AI Processing**: Automatic AI analysis during Silver tier creation with metadata enrichment
4. **Human Review**: Silver tier metadata validation and editing
5. **Final Curation**: Silver → Gold tier for finalized media with embedded metadata


## Recent Changes

### July 31, 2025 - Completed Natural AI Description System with Face Preservation
- **Fixed Face Assignment Preservation**: Resolved critical issue where reprocessing photos would unassign all faces from people
- **Intelligent Face Matching**: Implemented bounding box overlap detection (30% threshold) to match new detections with existing face assignments
- **Universal AI Prompts**: Simplified from provider-specific to universal prompts that work with both OpenAI and Ollama
- **Natural Family-Friendly Descriptions**: Successfully generating warm, conversational descriptions instead of robotic metadata
- **Named Face Integration**: AI descriptions now naturally include people's names (e.g., "Ellie and Chloe surrounded by loving family")
- **Clean Settings Interface**: Created simplified prompt management with category tabs (Image Analysis, File Naming, Description Generation)
- **Proven Results**: Testing shows natural output like "A delightful moment captured with Ellie and Chloe surrounded by loving family..." with preserved face assignments
- **Enhanced Storage Methods**: Added updateFace() and deleteFace() methods to support smart face preservation during reprocessing

### July 31, 2025 - Fixed AI Reprocess Functionality with Enhanced People Context
- **Fixed Duplicate File Creation Bug**: Removed duplicate `/api/photos/:id/reprocess` endpoint that was creating new Silver files instead of updating existing ones
- **Enhanced People Context Integration**: AI reprocess now properly considers detected people, their ages, and relationships when reanalyzing images
- **Improved Fallback Processing**: When OpenAI API quota is exceeded, fallback metadata generation now uses people context to create meaningful descriptions (e.g., "Photo with Chloe (age 7)")
- **Better Error Handling**: Comprehensive quota limit handling with graceful fallbacks that maintain people-aware functionality
- **Face Detection Preservation**: Face-API.js neural network detection continues working properly during reprocessing (detecting 3 faces correctly)
- **No More Duplicates**: AI reprocess now updates existing photos in-place rather than creating new file versions
- **Enhanced Metadata Quality**: Fallback descriptions include family relationships, age information, and context-aware tagging

### July 31, 2025 - Enhanced Family Relationship UI with Directional Clarity
- **Improved Relationship Direction Display**: Updated RelationshipManager to show clear directional relationships (e.g., "Parent of John Smith" instead of "John Smith [Parent]")
- **Enhanced Add Relationship Dialog**: Added explanatory text to clarify that selecting "Parent of" means the current person is the parent of the selected person
- **Better Visual Organization**: Reordered relationship display to show relationship type first, then person name for clearer understanding
- **Complete Family Tree Feature**: Fully functional relationship management with gender-neutral terms integrated into people edit page via tabs
- **Database Integration**: All relationship operations working with proper CRUD functionality and inverse relationship handling

### July 30, 2025 - Silver File Immutability Policy
- **Implemented Silver File Immutability** - Silver tier files are now completely immutable and cannot be renamed or moved during reprocessing
- **Fixed Duplicate Creation Issue** - Resolved bug where reprocessing silver photos created duplicates with renamed files
- **Metadata-Only Updates** - Silver photo reprocessing now only updates AI analysis, face detection, and event metadata without touching files
- **Preserved Renaming for Promotion** - File renaming settings now only apply when promoting photos TO silver tier, not when reprocessing existing silver photos
- **Enhanced Burst Processing** - Updated burst photo processing to respect silver file immutability while maintaining AI enhancement capabilities
- **Architecture Clarification** - Silver tier is the first immutable tier; naming patterns only affect initial upload-to-silver processing and silver-to-gold promotion

### July 30, 2025 - Complete Bronze Tier Architecture Redesign
- **Eliminated Bronze as tracked database tier** - Bronze is now just a temporary upload staging area, not stored in database
- **Updated to Silver/Gold only architecture** - Files process directly from upload to Silver tier with AI analysis
- **Simplified tier hierarchy** - Silver tier is now the first immutable processed tier, Gold is final curated tier
- **Updated all backend services** - fileManager, routes, storage, and duplicate detection now use Silver/Gold only
- **Comprehensive frontend updates** - Gallery, dashboard, and all components updated to reflect new architecture
- **Enhanced upload processing** - Files now get AI analysis during initial upload processing to Silver tier
- **Improved efficiency** - Eliminated redundant Bronze→Silver processing step and file copying
- **Updated database schema** - Removed Bronze from tier enum, updated statistics and interfaces

### July 29, 2025 - Fixed Photo Organization by Date Taken
- **Fixed "Process All Bronze" button error** - resolved compilation issues and variable scoping problems
- **Fixed file organization system** - photos are now organized by their actual date taken instead of current date
- **Enhanced EXIF date extraction** - now captures all date fields: dateTimeOriginal, createDate, modifyDate, dateTime
- **Updated ExifMetadata interface** - added dateTimeOriginal, createDate, modifyDate fields
- **Updated processing pipeline** - refreshes EXIF metadata during Silver processing to capture all date fields
- **Updated fileManager.ts** - copyToSilver() and copyToGold() functions now accept photoDate parameter
- **Updated batch processing** - all photo processing operations now extract and use the photo's actual date
- **Verified fix working** - new photos are correctly placed in 2024/12/ folder and database stores all date fields

## Recent Changes

### Code Hygiene Improvements (July 29, 2025)
- Added proper logging utility to replace console.* statements in production
- Fixed TypeScript errors in advanced search service 
- Improved type safety with proper interfaces for search results
- Updated client-side error logging to only show in development
- Fixed invalid CSS class names (background0 → proper Tailwind classes)
- Resolved import conflicts and duplicate component declarations
- Created comprehensive hygiene report identifying security and performance issues

## Previous Changes

### Upload System Consolidation (July 29, 2025)
- **Consolidated three separate upload components** (simple-upload.tsx, upload-modal.tsx, upload.tsx) into a single unified system
- **Created UnifiedUpload component** with both modal and fullscreen modes for different use cases
- **Enhanced conflict resolution** with detailed EXIF metadata display showing camera settings, GPS data, and file details
- **Improved user experience** with consistent drag-and-drop functionality, progress tracking, and queue management
- **Maintained all existing functionality** including duplicate detection, file validation, and error handling
- **Updated dashboard and upload page** to use the new consolidated component
- **Backed up old components** (simple-upload.tsx.backup, upload-modal.tsx.backup) for reference

### Complete Upload System Rebuild & EXIF Metadata Integration (January 29, 2025)
- **Fixed Critical Upload Functionality**: Completely rebuilt broken upload system from scratch with working React state management
- **Restored Drag-and-Drop Interface**: Main upload page now features full drag-and-drop functionality with visual feedback
- **Enhanced Duplicate Detection**: Real-time conflict detection with comprehensive resolution interface
- **Complete EXIF Metadata Extraction**: Successfully implemented comprehensive camera metadata extraction for temp files using file header detection instead of extensions
- **Professional Conflict Dialog**: Displays complete camera information including settings (aperture, shutter, ISO), GPS coordinates, date taken, lens details, and file hashes for both existing and new files
- **Header-Based Image Detection**: Bypassed file extension limitations by implementing JPEG signature detection for temp files
- **Smart Date Parsing**: Proper handling of EXIF date format (YYYY:MM:DD HH:MM:SS) with fallback to existing dateTime fields
- **Production-Ready UI**: Removed all test labels and implemented professional upload interface with detailed metadata comparison
- **Conflict Resolution System**: Modal dialogs with Keep Existing, Replace, and Keep Both options showing comprehensive technical specifications
- **Queue Management**: Clear completed files, remove individual files, and proper status tracking
- **Seamless Integration**: Dashboard and main upload page now use unified, working upload components

### Enhanced Duplicate Detection System (January 29, 2025)
- **Intelligent Auto-Skip Logic**: MD5 identical files now automatically skip without user prompts
- **Visual Match Conflicts**: Only files with 99.5%+ visual similarity (different metadata) trigger conflict dialogs
- **Comprehensive EXIF Display**: Full metadata comparison showing camera settings, GPS coordinates, timestamps for both existing and new files
- **Enhanced Conflict Interface**: Professional conflict resolution with detailed technical specifications
- **Fixed Metadata Extraction**: Proper EXIF data extraction for temp files during duplicate detection
- **Corrected Similarity Display**: Fixed percentage calculation showing proper similarity values (not 10000%)
- **Improved User Experience**: "Skipped" status with proper icons and messaging for auto-skipped files

### Upload Queue and Duplicate Detection Base Improvements (January 29, 2025)
- **Fixed Upload Queue Management**: Resolved issue where adding new files would re-upload all existing files
- **Enhanced Queue Controls**: Added "Clear Completed" button to remove processed files from upload queue
- **Better Conflict Resolution**: Exact MD5 duplicates now always trigger conflicts regardless of burst photo patterns
- **Enhanced Perceptual Matching**: Improved visual similarity thresholds for better duplicate vs burst photo distinction

## Previous Changes

### Dark Mode Enhancement Completion (July 28, 2025)
- **Comprehensive CSS Color System**: Enhanced with CSS variables for proper dark mode adaptation
- **Fixed Hardcoded Colors**: Updated 30+ instances across all components (text-gray-400 → text-muted-foreground, bg-gray-200 → bg-muted, etc.)
- **Enhanced Component Visibility**: Fixed invisible buttons and improved component readability in dark mode
- **Tier Background Colors**: Added custom CSS variables for proper light/dark mode tier color adaptation
- **Complete Dark Mode Compatibility**: All interface elements now properly support both light and dark themes

### Enhanced Burst Photo Detection with Cross-Tier State Management (July 29, 2025)
- **Enhanced State Management**: Added `processingState` field (unprocessed, processed, promoted, rejected) to file versions for comprehensive state tracking
- **Cross-Tier Burst Detection**: Updated burst detection to analyze photos from all tiers (Bronze, Silver, Gold) with intelligent priority-based representative selection
- **Smart Demotion Logic**: Implemented intelligent handling of mixed-tier burst groups with proper state management
- **Bronze File Protection**: Bronze files are now sacred archives - never deleted, only state changes to track processing
- **Comprehensive Processing States**: 
  - Bronze files marked as "promoted" when moved to Silver
  - Bronze files marked as "processed" when part of processed group but not selected
  - Silver files marked as "promoted" when moved to Gold
  - Silver files can be "rejected" with user confirmation while preserving Bronze originals

### Burst Photo Detection Implementation (July 27, 2025)
- Implemented intelligent burst photo detection service using image similarity analysis
- Added burst selection page for choosing photos from grouped sequences  
- Modified bronze-to-silver processing to use burst grouping workflow
- Updated duplicate detection to focus only on Gold tier photos (more relevant for final curation)
- Added "Burst Photos" navigation link with Zap icon
- Created comprehensive testing scripts and documentation for end-to-end feature validation

### Event Detection System Implementation (July 28, 2025)
- **Comprehensive Event Detection**: Smart holiday and birthday detection with confidence scoring (80%+ threshold)
- **Enhanced Database Schema**: Added birthdate fields to people table with string-to-Date conversion handling
- **API Integration**: Added /api/events/detect, /api/events/age-calculation, and /api/events/holiday-sets endpoints
- **Events Page**: New dedicated page to browse photos by detected events with gallery and timeline views
- **Event Settings**: Configurable holiday detection for multiple countries (US, UK) in settings page
- **Photo Detail Enhancement**: Events section in photo modal showing both manual and auto-detected events
- **Age Calculation**: Automatic age computation for birthday events based on photo dates
- **Silver Tier Integration**: Event detection occurs automatically during Bronze→Silver processing

### Testing Infrastructure
- Created comprehensive testing guide (`scripts/test-pictallion.sh`) with 8 feature testing categories
- Added structured test photo organization guide (`test-photos/README.md`)
- Provided testing workflow for validating all features including burst detection, face recognition, AI tagging, and duplicate detection
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
- **Build Integration**: Uses unified `npm run build` for both frontend and backend compilation

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

## Recent Updates (January 27, 2025)

### Comprehensive Package Update - Modern Stack Refresh
- **Updated TypeScript**: 5.7.2 → 5.8.3 (latest stable release)
- **Upgraded React Ecosystem**: React 18.3.1 → 19.1.0, React-DOM 18.3.1 → 19.1.0 (major version upgrade)
- **Enhanced Database Layer**: Drizzle ORM 0.39.1 → 0.44.3, Drizzle Kit updated to 0.31.4, Better-SQLite3 9.0.0 → 12.2.0
- **Modernized UI Components**: All Radix UI components updated to latest versions for improved stability and features
- **Improved Form Handling**: React Hook Form 7.55.0 → 7.61.1, Hookform Resolvers 3.10.0 → 5.2.0
- **Updated Build Tools**: Vite maintained at 6.3.5 (compatible with TailwindCSS), TypeScript definitions updated across the board
- **Enhanced Dependencies**: TanStack React Query 5.83.0 → 5.83.0 (stabilized), Electron 33.3.0 → 37.2.4, Express 4.21.2 → 5.1.0

### Type System Improvements
- **Zod Schema Compatibility**: Fixed type inference issues with newer Zod version by updating from `z.infer<>` to `._output` pattern
- **React Day Picker**: Updated calendar component to use new Chevron API instead of deprecated IconLeft/IconRight
- **Database Type Safety**: Maintained full type safety across all schema updates with proper TypeScript integration

### Development Environment
- **Node.js Runtime**: v20.19.3 (current LTS)
- **Package Manager**: npm 10.8.2 (latest)
- **Build System**: Maintained Vite + TypeScript + React configuration with enhanced compatibility

### Compatibility Notes
- All updates maintain backward compatibility with existing codebase
- Face detection neural network features remain fully functional
- Database schema migrations not required - all changes are package-level
- Professional photo management features preserved with enhanced performance

## Previous Updates (January 26, 2025)

### Major Face Detection Upgrade - Neural Network Implementation
- **Replaced Heuristic Detection**: Upgraded from pixel-based skin-tone analysis to industry-standard Face-API.js with TensorFlow.js backend
- **Neural Network Accuracy**: Now using SSD MobileNet v1 face detection model with 97-99% confidence scores
- **Real Face Embeddings**: 128-dimensional face descriptors generated by trained neural networks instead of hash-based fallbacks
- **Automatic Model Loading**: Downloads pre-trained models from @vladmandic/face-api repository on initialization
- **Graceful Fallback**: Maintains heuristic backup for cases where neural network fails
- **Performance Optimized**: TensorFlow.js with CPU optimizations (AVX2 FMA instructions)
- **Accurate Detection**: Reduced false positives - detects 2 actual faces vs 4 heuristic guesses

### Face Processing Improvements
- **Enhanced Face Crops**: Improved face thumbnail generation with proper neural network-based bounding boxes
- **Better Face Recognition**: More accurate face similarity matching using real embeddings
- **Robust Error Handling**: Comprehensive fallback systems for model loading and processing failures

## Previous Updates (January 25, 2025)

### Critical Professional Features Implemented
- **Face Recognition & People Management**: Complete face detection service with person identification and photo organization by people
- **Advanced Search System**: Comprehensive filtering by date, camera, tags, AI confidence, file type, location, GPS, and faces
- **Collections & Albums Management**: Custom photo collections with drag-and-drop organization and metadata management
- **Batch Operations**: Professional bulk photo management with tagging, organizing, exporting, and AI processing capabilities
- **Enhanced Analytics Dashboard**: Detailed insights with upload trends, tier distribution, AI processing stats, and storage breakdowns

### Database Schema Expansion
- **New Tables**: Added collections, collectionPhotos, people, and faces tables with proper relationships
- **Enhanced Storage Interface**: Extended storage methods to support all new professional features
- **Type Safety**: Complete TypeScript schemas and validation for all new database entities

### API & Backend Enhancements  
- **Collections API**: Full CRUD operations for collection management
- **Batch Processing**: Unified batch operations endpoint for professional workflow management
- **Analytics Endpoint**: Comprehensive analytics data generation for dashboard insights
- **Face Detection Integration**: AI-powered face detection and person management capabilities

### Frontend Professional Features
- **Advanced Search Component**: Multi-criteria filtering with date pickers, tag selection, and confidence sliders
- **Batch Operations Interface**: Professional bulk selection and operation management
- **Collections Management**: Full-featured collection creation, organization, and photo management
- **Enhanced Navigation**: Updated sidebar with all new professional features

### Documentation & Screenshots
- **README Enhancement**: Updated with comprehensive feature descriptions and screenshot placeholders
- **Professional Presentation**: Prepared for high-quality screenshots showcasing all new capabilities
- **User Guide Preparation**: Ready for comprehensive user documentation

### Build System & Docker Deployment Fixes (January 25, 2025)
- **Docker Production Error Resolution**: Fixed critical "Cannot find package 'vite'" error by removing static Vite imports from production server
- **Dynamic Import Strategy**: Implemented conditional dynamic imports for Vite dependencies only in development mode
- **Multi-Path Static File Serving**: Enhanced production server to automatically detect static file locations across multiple possible paths
- **Production Build Script**: Created dedicated `scripts/build-production.sh` for reliable Docker builds with proper error checking
- **Build Process Validation**: Verified complete build pipeline works correctly - frontend assets bundled to dist/public, backend to dist/index.js
- **Docker Configuration**: Updated Dockerfile to use improved build process and properly handle static file serving in production
- **Deployment Testing**: Confirmed production server starts correctly and serves HTTP 200 responses in Docker environment

The application has been transformed from a basic photo manager into a comprehensive, professional-grade photo management system with enterprise-level capabilities.