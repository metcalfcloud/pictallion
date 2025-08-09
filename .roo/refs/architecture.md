# Architecture (Reference)
- FE: React 19 + TS + Vite + MUI + Tailwind
- BE (desktop): Rust + Tauri 2.7, SQLite, EXIF/XMP via `rexiv2`
- Server (optional): Python FastAPI + Postgres
- IPC: Tauri bridge for FE↔BE
- Data tiers: bronze/silver/gold with deterministic transitions.
