# Copilot Coding Agent Onboarding Instructions for Pictallion

## Repository Summary
Pictallion is an AI-powered photo management platform. It features intelligent tiered photo processing (Bronze → Silver → Gold), face recognition, advanced search, collections management, and batch operations. The app runs cross-platform as a desktop application via Tauri (Rust backend) with a React/TypeScript frontend, and supports web deployment via Docker.

## High-Level Repository Information
- **Size**: ~159 files, multi-directory
- **Type**: Cross-platform desktop & web app
- **Languages**: Rust (backend), TypeScript/React (frontend), Python (server deployment)
- **Frameworks**: Tauri 2.7.0, React 19, Vite, Material-UI, Tailwind CSS
- **Runtimes**: Node.js 22 (via mise), Rust toolchain (via mise), Python 3.11+
- **Database**: SQLite (desktop), PostgreSQL (server)
- **Build System**: mise (.mise.toml), npm, Cargo
- **Testing**: Vitest (frontend), Playwright (E2E), Rust unit tests (backend)

## Build, Test, Lint, Run, Bootstrap, Clean, and Deploy Instructions

### Prerequisites (Always Required)
- mise task runner (manages Node 22 and Rust stable)
  - Install: `curl https://mise.jdx.dev/install.sh | sh` (Windows: `iwr https://mise.jdx.dev/install.ps1 -UseBasicParsing | iex`)
- Node.js and Rust toolchains are installed by `mise install`
- Optional: Docker & Docker Compose (for deployment)
- Optional: Ollama (local AI), OpenAI API key

### Bootstrap/Setup
Always run these steps before any build or test:
```bash
mise trust .
mise install
mise run setup
```
- Installs toolchains and project dependencies
- If errors occur, clean with `mise run clean` and retry setup.

### Development/Run
To start both frontend and backend development servers:
```bash
mise run dev
```
Or start individually:
```bash
mise run dev-frontend   # Vite dev server (http://localhost:5173)
mise run dev-backend    # Tauri dev mode
```

### Build
To build the complete application:
```bash
mise run build
```
Or build individually:
```bash
mise run build-frontend  # Production frontend build
mise run build-backend   # Release Rust build
```
 - Always run `mise run setup` before building if dependencies may have changed.

### Test
To run all tests (frontend unit, E2E, backend):
```bash
mise run test
```
Or run individually:
```bash
mise run test-frontend    # Vitest unit tests
mise run test-e2e         # Playwright E2E tests
mise run test-e2e-ui      # Playwright with UI
mise run test-backend     # Rust unit tests
```
- Always run tests before submitting changes.
- If tests fail due to dependency issues, rerun `mise run setup` and `mise run clean`.

### Lint
To run all linting checks:
```bash
mise run lint
```
Or lint individually:
```bash
mise run lint-frontend   # ESLint
mise run lint-backend    # Cargo clippy
```

### Format
To format all code:
```bash
mise run format
```
Or format individually:
```bash
mise run format-frontend  # Prettier/ESLint --fix
mise run format-backend   # Cargo fmt
```

### Clean
To remove all build artifacts:
```bash
mise run clean
```
Or clean individually:
```bash
mise run clean-frontend  # Remove frontend dist and cache
mise run clean-backend   # Cargo clean
```

### Deploy
#### Docker Deployment (Recommended)
```bash
./scripts/docker-setup.sh
```
- Builds and starts all services (backend, frontend, database, Ollama)
- Application served on http://localhost:8080
- Uses `docker/docker-compose.yml` and `docker/Dockerfile`

#### Manual Deployment
1. Set up environment variables (copy `.env.example` to `.env`)
2. Configure database (PostgreSQL for production, SQLite for development)
3. Build application: `mise run build`
4. Deploy built artifacts to target environment

### Common Errors and Workarounds
- **Rust toolchain issues**: Ensure Rust toolchain is installed (`mise install`) and PATH is loaded
- **Node.js version mismatch**: Use Node.js 22 (managed by mise)
- **Tauri build failures**: Run `cargo clean` in `src-tauri/src-tauri/` and rebuild
- **Linux native deps missing**: Run `mise run doctor-linux` and install suggested packages
- **Frontend dependency issues**: Delete `node_modules` and run `npm install`
- **Docker permission errors**: Ensure Docker daemon is running and user has permissions
- **Database connection issues**: Verify DATABASE_URL in `.env` and database service status

## Project Layout and Architecture

### Major Architectural Elements
- **Frontend** (`frontend/`): React 19 + TypeScript + Vite + Material-UI + Tailwind CSS
- **Backend** (`src-tauri/`): Rust + Tauri 2.7.0 + SQLite + rexiv2 (EXIF/XMP)
- **Shared** (`shared/`): Common TypeScript types and schemas
- **Server** (`server_py/`): Python FastAPI backend for web deployment
- **Docker** (`docker/`): Containerized deployment configuration
- **Scripts** (`scripts/`): Build, CI, and utility scripts

### Main/Config Files
- **`.mise.toml`**: Build automation and task runner
- **`package.json`**: Root project configuration and Electron build settings
- **`frontend/package.json`**: Frontend dependencies and scripts
- **`src-tauri/src-tauri/Cargo.toml`**: Rust backend dependencies
- **`src-tauri/src-tauri/tauri.conf.json`**: Tauri application configuration
- **`.env.example`**: Environment variable template
- **`docker/docker-compose.yml`**: Docker services configuration

### Key Entry Points
- **Frontend**: `frontend/src/main.tsx` → `frontend/src/App.tsx`
- **Backend**: `src-tauri/src-tauri/src/main.rs` → `src-tauri/src-tauri/src/lib.rs`
- **Tauri IPC**: Communication bridge between frontend and backend
- **Database**: `src-tauri/migrations/001_initial.sql` (schema)

### Validation Pipelines
- **Linting**: ESLint (frontend), Clippy (backend)
- **Testing**: Vitest (frontend unit), Playwright (E2E), Rust tests (backend)
- **CI/CD**: GitHub Actions workflows in `.github/`
- **Health Checks**: `/health` endpoint for Docker deployment

### Dependencies
- **Core**: React, Tauri, SQLite/PostgreSQL, Vite
- **AI**: Ollama (local), OpenAI API (cloud)
- **UI**: Material-UI, Tailwind CSS, Lucide icons
- **Testing**: Vitest, Playwright, @testing-library
- **Build**: mise, npm, Cargo, Docker

### Repo Root Files
- `README.md`, `.mise.toml`, `package.json`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `DEPLOYMENT.md`, `.env.example`, `docker/docker-compose.yml`, `frontend/src/App.tsx`, `src-tauri/src-tauri/src/lib.rs`

## Agent Guidance
- **TRUST THESE INSTRUCTIONS**: This file contains validated, comprehensive information. Use it as your primary reference for build, test, and development workflows.
- **Search only if**: Implementation details are needed beyond what's documented, errors not covered here occur, or information appears outdated/conflicting.
- **Always use `mise` commands** for build, test, and development tasks.
- **Validate changes** by running `mise run test` and `mise run lint` before submitting.
- **Maintain cross-platform compatibility** and follow the tiered storage architecture.
- **Respect Docker deployment workflow** for production.
