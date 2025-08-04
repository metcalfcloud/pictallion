# General Guidelines

1. **Single source of truth** – every change must be reflected in code, tests, docs and CI.
2. Optimise for **readability** before micro‑performance.
3. Prefer **open standards** (OpenAPI, OpenTelemetry, OIDC) over bespoke solutions.
4. All artefacts must be reproducible from `git clone` + `just` + `docker compose up`.
5. Any task that takes >10 min twice must be automated.