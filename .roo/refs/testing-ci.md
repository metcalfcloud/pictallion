# Testing & CI (Reference)
- Frontend unit: Vitest (`just test-frontend`)
- E2E: Playwright (`just test-e2e` or `just test-e2e-ui`)
- Backend: Rust tests (`just test-backend`)
- CI: GitHub Actions in `.github/`

Principle: New features → new tests; regressions → reproduce with tests first.
