# Testing & CI (Reference)
- Frontend unit: Vitest (`mise run test-frontend`)
- E2E: Playwright (`mise run test-e2e` or `mise run test-e2e-ui`)
- Backend: Rust tests (`mise run test-backend`)
- CI: GitHub Actions in `.github/`

Principle: New features → new tests; regressions → reproduce with tests first.
