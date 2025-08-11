# Pictallion Development Guide

This guide describes how to set up and work with the Pictallion development environment, covering both the React frontend and the Rust/Tauri backend.

## Prerequisites

- Node.js 18+
- Rust toolchain (for backend/Tauri)
- Optional: Ollama (local AI), OpenAI API key

## Environment Setup

All common development tasks are automated using [`just`](https://github.com/casey/just). Recipes are defined in the project root [`justfile`](justfile:1).

- **Setup:**  
  ```bash
  just setup
  ```
- **Development:**  
  ```bash
  just dev
  ```
- **Build:**  
  ```bash
  just build
  ```
- **Test:**  
  ```bash
  just test
  ```
- **Lint:**  
  ```bash
  just lint
  ```
- **Clean:**  
  ```bash
  just clean
  ```

Manual steps are not required; dependencies and workflows are managed via `just`.

## Project Structure

- **Frontend:** [`frontend/`](frontend/) (React, TypeScript, Tailwind CSS)
- **Backend:** [`src-tauri/`](src-tauri/) (Rust, Tauri)
- **Scripts:** [`scripts/`](scripts/) (utility and CI scripts)

## Development Workflow

- Start development servers with `just dev`.
- Edit frontend and backend code independently.
- Use test data and scripts in [`scripts/`](scripts/) for development.
- Frontend runs on [http://localhost:5173](http://localhost:5173).
- Backend API runs via Tauri.

## Testing

- **Frontend:**  
  Run all tests:
  ```bash
  just test
  ```
  Or run directly in [`frontend/`](frontend/):
  ```bash
  npm run test
  ```
  See [`frontend/tests/README.md`](frontend/tests/README.md:1) for details.

- **Backend:**  
  Run Rust/Tauri tests:
  ```bash
  just test
  ```
  Or use Cargo directly in [`src-tauri/`](src-tauri/):
  ```bash
  cargo test
  ```

### Tauri Integration Testing

- Tauri APIs are mocked for frontend integration tests.
- See:
  - [`frontend/tests/mocks/tauriMocks.ts`](frontend/tests/mocks/tauriMocks.ts:1)
  - [`frontend/tests/setup.ts`](frontend/tests/setup.ts:1)
  - [`frontend/vitest.config.ts`](frontend/vitest.config.ts:1)

#### Running Specific Tests

```bash
npm run test -- tests/integration/
npm run test -- tests/integration/tauriApi.test.ts
npm run test -- tests/integration/upload.test.tsx
```

#### Test Environment Requirements

- Node.js 18+
- Vitest
- @testing-library/react
- @testing-library/user-event
- @testing-library/jest-dom

No Tauri runtime or Rust toolchain is required for frontend tests.

## Troubleshooting

- Ensure all prerequisites are installed and available in your PATH.
- If build errors occur, run `cargo clean` and rebuild.
- For dependency issues, delete `node_modules` and reinstall with `npm install`.
- If Tauri fails to start, verify Rust toolchain and Tauri CLI versions.
- For frontend issues, check that the API server is running and accessible.
- Review logs in the terminal for error messages.

## References

- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Architecture](ARCHITECTURE.md)