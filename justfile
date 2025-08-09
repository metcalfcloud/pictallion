# Unified automation for Rust, Python, and TypeScript

# Platform-specific shell configuration for cross-platform compatibility
set shell := ["cmd.exe", "/C"]

# Install Rust, Python, and Node dependencies
setup:
	cd src-tauri/src-tauri && cargo build
	cd frontend && npm install

# Start frontend development server (Vite) - browser-only mode
dev-frontend:
	cd frontend && npm run dev

# Start Tauri desktop dev (backend) from correct directory
dev-backend:
	cd src-tauri/src-tauri && cargo tauri dev

# Start Vite then launch Tauri desktop pointing at Vite dev URL
# This opens a desktop window with live-reloading UI.
# On Windows, '&' starts the first command then continues; Vite keeps running.
dev:
	cd frontend && npm run dev &
	cd src-tauri/src-tauri && cargo tauri dev -- --dev-url http://localhost:5173

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
	@echo "Building frontend assets..."
	cd frontend && npm run build
	@echo "Building Tauri application..."
	cd src-tauri/src-tauri && cargo tauri build
	@echo "Production build completed successfully!"

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

# Show dev process status and URLs for troubleshooting
diagnose-dev:
	echo Checking if Vite is running on http://localhost:5173 ...
	powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; try { $r = Invoke-WebRequest -UseBasicParsing http://localhost:5173/; if ($r.StatusCode -eq 200) { Write-Host 'Vite is responding (200)'; exit 0 } else { Write-Host ('Vite responded with status ' + $r.StatusCode); exit 1 } } catch { Write-Host 'Vite not responding'; exit 1 }"
	echo If not running, start it with: start \"Pictallion Vite Dev\" cmd /C \"cd frontend && npm run dev\"
	echo To launch desktop window manually: cd src-tauri/src-tauri && cargo tauri dev -- --dev-url http://localhost:5173

# Quick environment diagnostics for Tauri v2 dev
# Prints versions and checks basic Windows build tooling presence.
diagnose:
	node --version
	npm --version
	rustc --version
	cargo --version
	npx --yes @tauri-apps/cli -V
	where cl.exe || echo "MSVC Build Tools cl.exe not found (OK if using alternative toolchain)"
	where powershell.exe
	echo "If Tauri window does not open, ensure Vite is on http://localhost:5173 and ports are free."
	echo "Use: just dev  (desktop), just dev-frontend (browser-only), just dev-backend (Tauri only)"
