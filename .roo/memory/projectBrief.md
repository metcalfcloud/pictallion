# Project Brief: Pictallion

Pictallion is a self-hosted photo management app built with a Rust/Tauri backend and a React/TypeScript frontend.

### Key Features:
- Photo ingestion from local or NAS directories
- Tiered storage system: Bronze → Silver → Gold
- Metadata extraction: EXIF, XMP via rexiv2
- IPC bridge via `ipc.rs` between frontend and backend
- Event and face detection
- LLM-powered descriptions and tagging
- SQLite backend using `sqlx`
- Developer workflow via `justfile` and GitHub Actions

### Goals:
- Implement full feature set
- Enforce linting, formatting, and test coverage
- Maintain reproducibility:
  ```sh
  git clone ...
  just setup
  cargo build
  docker compose up
Automate any repeated manual task >10 min

Deliver a clean, production-ready system

yaml
Copy
Edit

---

## 📁 `.roo/modes/default.roomode`

```yaml
# Default Roo Mode: Full Implementation + QA
name: Default Implementation Mode
agent: implementor
memory:
  - projectBrief.md
  - ../Pictallion Implementation Agent.md
commands:
  - just setup
  - cargo build
  - cargo test
  - just lint
  - npx eslint .
  - npm run build
  - playwright test
approval_required: true
description: |
  The default implementation mode for RooCode on the Pictallion project.
  This mode ensures that all features are implemented and validated with CI/lint/test.