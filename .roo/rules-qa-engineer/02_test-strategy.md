# Testing Strategy

* **Unit** – pytest + hypothesis for property‑based checks.
* **Integration** – spin‑up ephemeral Postgres via `docker compose`.
* **E2E** – Playwright MCP in headless Chromium + WebKit.
* **Load/Perf** – Locust scripts auto‑generated for critical endpoints.
* Gate pipeline: block merge if any stage < green.