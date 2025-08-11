# Pictallion Development Guide

This guide describes how to set up and work with the Pictallion development environment, covering both the React frontend and the Rust/Tauri backend.

## Prerequisites

- mise (manages Node 22 and Rust stable per `.mise.toml`)
- Optional: Ollama (local AI), OpenAI API key

## Environment Setup

All common development tasks are automated using `mise`. Tasks are defined in the project root `.mise.toml`.

- Install toolchains:  
  ```bash
  mise install
  ```
- **Setup:**  
  ```bash
  mise run setup
  ```
- **Development:**  
  ```bash
  mise run dev
  ```
- **Build:**  
  ```bash
  mise run build
  ```
- **Test:**  
  ```bash
  mise run test
  ```
- **Lint:**  
  ```bash
  mise run lint
  ```
- **Clean:**  
  ```bash
  mise run clean
  ```

Manual steps are not required; dependencies and workflows are managed via `mise`.

## Project Structure

- **Frontend:** [`frontend/`](frontend/) (React, TypeScript, Tailwind CSS)
- **Backend:** [`src-tauri/`](src-tauri/) (Rust, Tauri)
- **Scripts:** [`scripts/`](scripts/) (utility and CI scripts)

## Development Workflow

- Start development servers with `mise run dev`.
- Edit frontend and backend code independently.
- Use test data and scripts in [`scripts/`](scripts/) for development.
- Frontend runs on [http://localhost:5173](http://localhost:5173).
- Backend API runs via Tauri.

## Testing

- **Frontend:**  
  Run all tests:
  ```bash
  mise run test
  ```
  Or run directly in [`frontend/`](frontend/):
  ```bash
  npm run test
  ```
  See [`frontend/tests/README.md`](frontend/tests/README.md:1) for details.

- **Backend:**  
  Run Rust/Tauri tests:
  ```bash
  mise run test
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
