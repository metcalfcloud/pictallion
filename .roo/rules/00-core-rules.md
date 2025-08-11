# Pictallion Core Rules (Always-On, ≤2k tokens)

These are invariants that **must be followed in all modes**. Keep replies concise and prefer diffs/patches over full file rewrites.

## Canonical Practices
- Use `just` recipes for all tasks: build, dev, test, lint, format, and deploy.
- Respect the tiered photo flow **Bronze → Silver → Gold**; never break folder contracts.
- Pictallion stack: **Tauri (Rust) + React/TypeScript** with IPC for FE↔BE calls; SQLite for desktop, PostgreSQL for server.
- Cross-platform support (Windows/macOS/Linux) is required; avoid OS-specific commands when possible.
- Prefer **small, iterative changes**; add tests (Vitest/Playwright/Rust) for every feature or bug fix.
- Do not invent ports or env vars. Read existing config and `.env.example`. Ask for minimal clarifications only when absolutely necessary.
- For production guidance, default to **Docker deployment** and existing compose files.
- Keep prompts lean: **never** paste large files into context; read from disk and summarize.

## Guardrails
- Never exfiltrate secrets or print entire `.env` contents; show redacted examples only.
- Avoid destructive data migrations without explicit confirmation and a rollback plan.
- When editing large files, propose **unified diffs** or **targeted patches**.

## Definition of Done
- Code compiles; `just test` and `just lint` succeed locally.
- E2E critical paths pass or are updated with new tests.
- Changelist includes brief summary in commit message and updates relevant docs if needed.
