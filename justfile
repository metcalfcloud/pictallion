# Unified automation for Rust, Python, and TypeScript

# Use just's default shell per-OS (PowerShell on Windows, sh/bash elsewhere)

# Install Rust, Python, and Node dependencies
setup:
	cd src-tauri/src-tauri && cargo build
	cd frontend && npm install

# Start frontend development server (Vite) - browser-only mode
dev-frontend:
	cd frontend && npm run dev

# Start Tauri desktop dev (backend) from correct directory
dev-backend:
	cd src-tauri/src-tauri && (npx --yes @tauri-apps/cli dev || cargo tauri dev)

# Start Vite then launch Tauri desktop pointing at Vite dev URL
# This opens a desktop window with live-reloading UI.
# On Windows, '&' starts the first command then continues; Vite keeps running.
dev:
	node scripts/dev.mjs

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
	cd frontend && (npm ci --no-audit --no-fund || npm install) && npm run build
	@echo "Building Tauri application..."
	cd src-tauri/src-tauri && (npx --yes @tauri-apps/cli build || cargo tauri build)
	@echo "Production build completed successfully!"

# Build project documentation
build-docs:
	cd docs && mkdir -p build && npx cpy "*.md" build/

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
	(if command -v curl >/dev/null 2>&1; then curl -sSf http://localhost:5173/ >/dev/null && echo 'Vite is responding (200)' || echo 'Vite not responding'; else wget -q --spider http://localhost:5173/ && echo 'Vite is responding (200)' || echo 'Vite not responding'; fi)
	echo "If not running, start it with: cd frontend && npm run dev"
	echo "To launch desktop window: cd src-tauri/src-tauri && npx @tauri-apps/cli dev -- --dev-url http://localhost:5173"

# Quick environment diagnostics for Tauri v2 dev
# Prints versions and checks basic Windows build tooling presence.
diagnose:
	node --version
	npm --version
	rustc --version
	cargo --version
	npx --yes @tauri-apps/cli -V || echo "tauri cli not available (ok if cargo tauri installed)"
	(command -v cl >/dev/null 2>&1 && echo "MSVC cl found") || echo "MSVC cl not found (ok on non-Windows or using alternative toolchain)"
	(command -v powershell >/dev/null 2>&1 && echo "PowerShell found") || echo "PowerShell not found (ok on non-Windows)"
	@# Enforce Node 22+ with a clear message
	@node -e 'const v=process.versions.node.split(".")||["0","0"]; if(+v[0]<22){console.error("Node "+process.versions.node+" detected. Please use Node 22+ (see .nvmrc)."); process.exit(1)} else { console.log("Node version OK for this repo."); }'
	echo "If Tauri window does not open, ensure Vite is on http://localhost:5173 and ports are free."
	echo "Use: just dev  (desktop), just dev-frontend (browser-only), just dev-backend (Tauri only)"

# --- Playwright root E2E helpers ---

# Reinstall frontend deps for current OS (fix native rollup mismatch)
e2e-setup:
	cd frontend && rm -rf node_modules package-lock.json && npm install

# Install Playwright browsers
e2e-install:
	npx playwright install

# Run root Playwright suite (uses root playwright.config.ts)
e2e:
	npx playwright test -c ./playwright.config.ts --reporter=line

# Full E2E pipeline: setup deps, install browsers, run tests
e2e-all:
	just e2e-setup
	just e2e-install
	just e2e
