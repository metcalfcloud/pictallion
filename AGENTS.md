# Repository Guidelines

## Project Structure & Module Organization
- Frontend: `frontend/` (Vite + React + TypeScript). Entry: `frontend/src/main.tsx`; components use PascalCase (e.g., `Gallery.tsx`).
- Desktop backend: `src-tauri/src-tauri/` (Tauri v2, Rust 2021). Crate config in `Cargo.toml`.
- Tests: Frontend unit in `frontend/tests/`; e2e in `frontend/e2e/` and root `tests/` (Playwright). Rust tests live alongside Rust sources.
- Assets & docs: `assets/`, `docs/`. Misc tooling in `scripts/`, `docker/`, and config files in the repo root.

## Build, Test, and Development Commands
- Dev (desktop + live UI): `just dev` (starts Vite, then Tauri).
- Dev (browser only / backend only): `just dev-frontend` / `just dev-backend`.
- Build (prod desktop app): `just build` (Vite build + `cargo tauri build`).
- Tests: `just test` (unit + e2e + Rust). Frontend only: `just test-frontend`. Rust: `just test-backend`.
- Lint/format: `just lint`, `just format`. Direct examples: `cd frontend && npm run lint`; `cd src-tauri/src-tauri && cargo fmt`.


## Coding Style & Naming Conventions
- TypeScript/React: 2-space indent, PascalCase components (`UserSettings.tsx`), camelCase utilities (`lib/tauriApi.ts`). Prefer function components and hooks.
- Linting: ESLint (configs in `eslint.config.js` and `frontend/eslint.config.js`). Fix: `npm run lint -- --fix`.
- Rust: Follow `rustfmt`. Lint with Clippy: `cargo clippy`.

## Testing Guidelines
- Unit: Vitest + Testing Library (`*.test.ts`/`*.test.tsx`). Run via `just test-frontend` or `cd frontend && npm run test`.
- E2E: Playwright specs (`*.spec.ts`) in `frontend/e2e/` and `tests/`. Start with `just test-e2e` or `npm run test:e2e` (frontend).
- Rust: `cargo test` in `src-tauri/src-tauri/` or `just test-backend`.
- Aim to cover new logic; co-locate tests with features when practical.

## Commit & Pull Request Guidelines
- Use Conventional Commits when possible: `feat:`, `fix:`, `refactor:`, etc. Keep subjects imperative and concise.
- PRs must include: clear description, linked issues, screenshots/GIFs for UI, and notes on testing.
- All checks must pass (lint, tests). Keep changes scoped; update relevant docs (`README.md`, `ARCHITECTURE.md`).

## Security & Configuration Tips
- Secrets: copy `.env.example` to `.env`; never commit real secrets. 
- Local ports: Vite serves at `http://localhost:5173` (Playwright uses this by default).
- Windows-friendly workflows: prefer `just` recipes which are configured for cross-platform use.
