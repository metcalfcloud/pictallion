# Unified automation for Rust, Python, and TypeScript

# Platform-specific shell configuration for cross-platform compatibility
set shell := ["cmd.exe", "/C"]

# Install Rust, Python, and Node dependencies
setup:
	cd src-tauri/src-tauri && cargo build
	cd frontend && npm install

# Start frontend development server (Vite)
dev-frontend:
	cd frontend && npm run dev

# Start backend development server (Tauri)
dev-backend:
	cargo tauri dev

# Start both frontend and backend development servers
dev:
	cd frontend && npm run dev &
	cargo tauri dev

# Run frontend unit tests (Vitest)
test-frontend:
	cd frontend && npm run test

# Run frontend end-to-end tests (Playwright)
test-e2e:
	cd frontend && npm run test:e2e

# Run frontend end-to-end tests with UI
test-e2e-ui:
	cd frontend && npm run test:e2e:ui

# Run backend tests (Rust)
test-backend:
	cd src-tauri/src-tauri && cargo test

# Run all automated tests (frontend unit, e2e, and backend)
test:
	cd frontend && npm run test
	cd frontend && npm run test:e2e
	cd src-tauri/src-tauri && cargo test

# Run ESLint on frontend code
lint-frontend:
	cd frontend && npm run lint

# Run Rust linting (clippy) on backend code
lint-backend:
	cd src-tauri/src-tauri && cargo clippy

# Run all linting checks
lint:
	cd frontend && npm run lint
	cd src-tauri/src-tauri && cargo clippy

# Format frontend code (using Prettier via npm script if available, otherwise ESLint)
format-frontend:
	cd frontend && npm run format || npm run lint -- --fix

# Format backend Rust code
format-backend:
	cd src-tauri/src-tauri && cargo fmt

# Format all code (frontend and backend)
format:
	cd frontend && (npm run format || npm run lint -- --fix)
	cd src-tauri/src-tauri && cargo fmt

# Build frontend for production
build-frontend:
	cd frontend && npm run build

# Build backend for production
build-backend:
	cd src-tauri/src-tauri && cargo build --release

# Build complete application (frontend + backend)
build:
	cd frontend && npm run build
	cargo tauri build

# Build project documentation
build-docs:
	cd docs && mkdir build 2>nul || echo "build directory exists" && npx cpy "*.md" build/

# Clean frontend build artifacts
clean-frontend:
	cd frontend && npm run clean

# Clean backend build artifacts
clean-backend:
	cd src-tauri/src-tauri && cargo clean

# Remove all build artifacts (frontend and backend)
clean:
	cd frontend && npm run clean
	cd src-tauri/src-tauri && cargo clean
