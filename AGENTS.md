# Repository Guidelines

## Project Structure & Module Organization
- Frontend: `frontend/` (Vite + React + TypeScript). Entry: `frontend/src/main.tsx`; components use PascalCase (e.g., `Gallery.tsx`). Tailwind config now lives at `frontend/tailwind.config.ts`. UI components config `components.json` also lives in `frontend/`.
- Desktop backend: `src-tauri/src-tauri/` (Tauri v2, Rust 2021). Crate config in `Cargo.toml`.
- Shared types: `shared/` for cross-cutting TypeScript types/schemas.
- Tests: Frontend unit in `frontend/tests/`; e2e in `frontend/e2e/` and root `tests/` (Playwright). Rust tests live alongside Rust sources.
- Assets & docs: `assets/`, `docs/` (moved API/Architecture/Deployment/Development docs into `docs/`). RooCode integration assets archived under `docs/integrations/roocode/`.
- Tooling & scripts: `scripts/` (dev orchestrator is `scripts/dev.mjs`), `docker/`.
- Data & config: `data/` (media tiers) and `config/env/` for archived env variants.

## Build, Test, and Development Commands
This repo uses `mise` as the unified, cross‑platform task runner and toolchain manager.

- Install mise: `curl https://mise.jdx.dev/install.sh | sh` (Windows: `iwr https://mise.jdx.dev/install.ps1 -UseBasicParsing | iex`)
- Trust repo tasks: `mise trust .` (one-time; required to run tasks)
- Install toolchains: `mise install` (sets Node 22 and Rust stable per `.mise.toml`)
- Environment: `mise run env` to copy `.env.example` to `.env` if missing
- Bootstrap deps: `mise run setup`

- Dev (desktop + live UI): `mise run dev` (starts Vite, then Tauri via `scripts/dev.mjs`)
- Dev (browser only / backend only): `mise run dev-frontend` / `mise run dev-backend`
- Build (prod desktop app): `mise run build` (Vite build + `cargo tauri build`)
- Tests: `mise run test` (unit + e2e + Rust)
  - Frontend only: `mise run test-frontend`; Rust: `mise run test-backend`; E2E: `mise run test-e2e`
- Lint/format: `mise run lint`, `mise run format`
- Clean: `mise run clean` (cleans Vite and Rust artifacts)

Note: All commands below assume `mise` is installed and initialized.


## Coding Style & Naming Conventions
- TypeScript/React: 2-space indent, PascalCase components (`UserSettings.tsx`), camelCase utilities (`lib/tauriApi.ts`). Prefer function components and hooks.
- Linting: ESLint (configs in `eslint.config.js` and `frontend/eslint.config.js`). Fix: `npm run lint -- --fix`.
- Rust: Follow `rustfmt`. Lint with Clippy: `cargo clippy`.

## Testing Guidelines
- Unit: Vitest + Testing Library (`*.test.ts`/`*.test.tsx`). Run via `mise run test-frontend` or `cd frontend && npm run test`.
- E2E: Playwright specs (`*.spec.ts`) in `frontend/e2e/` and `tests/`. Start with `mise run test-e2e` or `npm run test:e2e` (frontend).
- Rust: `mise run test-backend` (or `cargo test` in `src-tauri/src-tauri/`).
- Aim to cover new logic; co-locate tests with features when practical.

### Agent Sandbox: End-to-End Verification
- Prepare: `mise install && mise run env && mise run setup`
- Diagnose toolchains: `mise run diagnose`
- Linux deps check: `mise run doctor-linux` (prints missing apt packages)
- Lint + unit: `mise run lint && mise run test-frontend`
- Build app: `mise run build`
- E2E (full): `mise run e2e-all` (reinstalls deps for current OS, installs browsers, runs tests)
- E2E smoke (Chromium only): `mise run e2e-smoke-chromium`
- Full test matrix: `mise run test` (frontend unit + e2e + backend)

Notes post-cleanup:
- Moved docs into `docs/` and updated README links.
- Archived RooCode materials into `docs/integrations/roocode/`.
- Consolidated frontend configs under `frontend/` (Tailwind, components.json).
- Dev orchestration uses `scripts/dev.mjs` referenced by `.mise.toml`.

## Commit & Pull Request Guidelines
- Use Conventional Commits when possible: `feat:`, `fix:`, `refactor:`, etc. Keep subjects imperative and concise.
- PRs must include: clear description, linked issues, screenshots/GIFs for UI, and notes on testing.
- All checks must pass (lint, tests). Keep changes scoped; update relevant docs (`README.md`, `ARCHITECTURE.md`).

## Security & Configuration Tips
- Secrets: copy `.env.example` to `.env`; never commit real secrets. 
- Local ports: Vite serves at `http://localhost:5173` (Playwright uses this by default).
- Windows-friendly workflows: prefer `mise` tasks which are configured for cross-platform use.
