# Changelog

## [v0.0.14] - 2025-07-27



## [v0.0.13] - 2025-07-27



## [v0.0.12] - 2025-07-27



## [v0.0.11] - 2025-07-27



## [v0.0.10] - 2025-07-27



## [v0.0.9] - 2025-07-27



## [v0.0.8] - 2025-07-27



## [v0.0.7] - 2025-07-27



## [v0.0.2] - 2025-07-27



All notable changes to Pictallion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v1.0.0] - 2025-07-27

### Added
- Initial release of Pictallion photo management platform
- AI-powered photo analysis with Ollama and OpenAI support
- Tiered processing system (Bronze → Silver → Gold)
- Modern React frontend with TypeScript and Tailwind CSS
- Express.js backend with PostgreSQL database
- Comprehensive packaging and deployment system
- Docker support with automated setup
- GitHub Actions CI/CD pipeline
- Professional issue templates and contribution guidelines

### Features
- **Photo Management**: Upload, organize, and manage photo collections
- **AI Processing**: Automatic tagging, description generation, and metadata extraction
- **Tiered Workflow**: Bronze (raw) → Silver (AI processed) → Gold (curated)
- **Search & Filter**: Advanced search capabilities across metadata and content
- **Modern UI**: Responsive design with dark mode support
- **Multi-Platform**: Windows, macOS, and Linux support
- **Flexible Deployment**: Native packages, Docker, and cloud deployment options

### Security
- Environment-based configuration for sensitive data
- Session-based authentication
- Input validation and sanitization
- SQL injection prevention
- File upload security checks

### Development
- TypeScript throughout the codebase
- Comprehensive build and packaging scripts
- Automated testing and security scanning

### Fixed (Latest)
- Docker Compose compatibility with modern GitHub Actions (docker compose vs docker-compose)
- Package script build process to match unified npm run build output structure
- Distribution archive creation with correct file paths and startup scripts
- Build pipeline integration for seamless frontend and backend compilation
- Ubuntu/Linux packaging script completely rewritten to eliminate client/dist dependency
- Package validation and error handling improved with comprehensive build verification
- Docker containerization
- Professional GitHub workflows
- Detailed documentation and contribution guidelines