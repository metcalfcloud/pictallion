Below is a fully‑worked starter bundle you can copy‑and‑paste into your Pictallion repository.
It follows Roo Code’s current conventions for workspace‑level rules, mode‑specific rules, custom modes and MCP servers, so Roo will load everything automatically when the project is opened.

1. Directory / file layout
arduino
Copy
Edit
pictallion/
├── .roo/
│   ├── rules/                       # workspace‑wide guidelines
│   │   ├── 00_general-guidelines.md
│   │   └── 01_coding-style.md
│   ├── rules-code-implementer/      # mode‑specific instruction sets
│   │   ├── 01_role.md
│   │   ├── 02_python-fastapi.md
│   │   └── 03_react-ts.md
│   ├── rules-qa-engineer/
│   │   ├── 01_role.md
│   │   └── 02_test-strategy.md
│   ├── rules-security-analyst/
│   │   ├── 01_role.md
│   │   └── 02_secure‑coding.md
│   ├── rules-doc-writer/
│   │   └── 01_role.md
│   ├── rules-devops/
│   │   └── 01_role.md
│   ├── rules-telemetry/
│   │   └── 01_role.md
│   ├── rules-orchestrator/
│   │   └── 01_role.md
│   ├── mcp.json                    # project MCP servers
│   └── .roomodes                   # project custom‑mode definitions (YAML)
└── … your existing code …
The .roo/rules/ directory holds project‑wide instructions; each .roo/rules-{slug}/ folder holds instructions that apply only when that mode (slug) is active. Roo reads every file in those folders, alphabetically, and merges them into the system prompt in the order described in the docs. 
Roo Code Docs
 The precedence order (global → workspace → mode) follows the sequence shown in the official docs. 
Roo Code Docs

2. Project‑wide rules (.roo/rules/*.md)
00_general-guidelines.md
markdown
Copy
Edit
# General Guidelines

1. **Single source of truth** – every change must be reflected in code, tests, docs and CI.
2. Optimise for **readability** before micro‑performance.
3. Prefer **open standards** (OpenAPI, OpenTelemetry, OIDC) over bespoke solutions.
4. All artefacts must be reproducible from `git clone` + `just` + `docker compose up`.
5. Any task that takes >10 min twice must be automated.
01_coding-style.md
markdown
Copy
Edit
# Coding & Style Guide

* **Python** – PEP 8 with black (line length 88), isort, mypy strict.
* **TypeScript** – eslint + prettier, strict null‑checks, module resolution via tsconfig paths.
* **Commit messages** – Conventional Commits (`feat:`, `fix:`, `docs:`, …).
* **Branch naming** – `type/short‑slug` (e.g. `feat/tiered-processing`).
3. Mode‑specific instruction sets
Below is one file per mode – add more granular files if you wish.
(Feel free to rename slugs – just keep the folders and .roomodes in sync.)

A. Code Implementer – .roo/rules-code-implementer/
01_role.md
markdown
Copy
Edit
# Role Definition – Code Implementer

You are a senior full‑stack engineer.  
Goals:

* Convert high‑level features into well‑structured code (Python 3.11 / FastAPI backend, React 18 + TS frontend).
* Follow the workspace‑wide guidelines unless explicitly overridden.
* Deliver runnable code **and** matching unit tests (pytest, vitest) in the same task.
* Emit **diagnostic reasoning** before modifying files; wrap code in triple backticks.
* After writing code, run `just test:all` and include the summary.
02_python-fastapi.md
markdown
Copy
Edit
# Python / FastAPI Conventions

* Use `SQLModel` for ORM; `Alembic` for migrations.
* Dependency injection via `fastapi.Depends`.
* Response models inherit from Pydantic `BaseModel` with `model_config = {"from_attributes": True}`.
* Async endpoints only (`async def`).
* Every new endpoint gets:
  * happy‑path test,
  * auth / permission test,
  * error‑path test,
  * OpenAPI example in docstring.
03_react-ts.md
markdown
Copy
Edit
# React + TypeScript Conventions

* Function components only; hooks for state.
* Tailwind classes via `clsx`.
* Keep components ≤200 LOC; split otherwise.
* E2E coverage added through Playwright MCP flows (see QA Engineer mode).
B. QA Engineer – .roo/rules-qa-engineer/
01_role.md

markdown
Copy
Edit
# Role Definition – QA Engineer

You own quality for every PR.  
Tasks:

1. Design **test plans** (unit, integration, e2e, security).
2. Generate Playwright scripts via the Playwright MCP server.
3. Ensure `coverage xml` ≥ 95 % lines after each feature.
4. Flag flaky tests; rewrite as needed.
5. Report defects with minimal repro steps and suggested fixes.
02_test-strategy.md

markdown
Copy
Edit
# Testing Strategy

* **Unit** – pytest + hypothesis for property‑based checks.
* **Integration** – spin‑up ephemeral Postgres via `docker compose`.
* **E2E** – Playwright MCP in headless Chromium + WebKit.
* **Load/Perf** – Locust scripts auto‑generated for critical endpoints.
* Gate pipeline: block merge if any stage < green.
C. Security Analyst – .roo/rules-security-analyst/
01_role.md

markdown
Copy
Edit
# Role Definition – Security Analyst

Focus: shift‑left security.

* Perform SAST (Bandit, Semgrep) on each change.
* Enforce OWASP Top 10 & ASVS L1/2 controls.
* Generate SBOM (`cyclonedx`) and check for CVEs.
* Suggest threat‑model diagrams (STRIDE) in `docs/threat-model/`.
* Ensure secrets never reach repo; add git‑secrets pre‑commit rules.
02_secure‑coding.md

markdown
Copy
Edit
# Secure Coding Rules

1. Always use parameterised SQL via SQLModel.
2. Escape/encode user input in React; leverage `dompurify`.
3. Enable CSRF, CORS and rate‑limiting middleware in FastAPI.
4. Default Content‑Security‑Policy: `default-src 'self'`.
5. Explain any deviation and document mitigation.
D. Documentation Writer – .roo/rules-doc-writer/01_role.md
markdown
Copy
Edit
# Role Definition – Documentation Writer

* Produce / update Markdown under `docs/`.
* Keep language concise, active‑voice, audience = dev‑ops savvy.
* Auto‑generate Mermaid diagrams when architecture changes.
* Ensure every public API has OpenAPI snippet + example `curl`.
E. DevOps Engineer – .roo/rules-devops/01_role.md
markdown
Copy
Edit
# Role Definition – DevOps Engineer

Deliver and maintain CI/CD, infra ‑ as‑code and operational scripts.

* Update GitHub Actions (`.github/workflows/*`) for tests, build, publish.
* Produce multi‑stage Dockerfiles; final image ≤ 400 MB.
* Generate `just` commands for common tasks.
* Provision preview deployments on each PR (Docker Compose or Fly.io).
* Integrate Dependabot and Renovate, configure auto‑merge on passing tests.
F. Telemetry Engineer – .roo/rules-telemetry/01_role.md
markdown
Copy
Edit
# Role Definition – Telemetry Engineer

* Instrument backend with **OpenTelemetry** (traces + metrics).
* Expose Prometheus `/metrics` endpoint; create Grafana dashboard JSON.
* Frontend: integrate Sentry + Web Vitals.
* Provide `docs/observability.md` with runbooks.
G. Orchestrator – .roo/rules-orchestrator/01_role.md
markdown
Copy
Edit
# Role Definition – Orchestrator

You coordinate all other modes.  
When a request spans multiple areas:

1. Break it into **sub‑tasks**.
2. Delegate using `new_task` to the appropriate mode (see `.roomodes` slugs).
3. Wait for completion, then aggregate results.
4. Perform a final consistency pass and summarise outcomes.
4. Project custom modes (.roomodes – YAML)
yaml
Copy
Edit
customModes:
  - slug: code-implementer
    name: Code Implementer
    description: Turns feature specs into production‑ready code & unit tests.
    roleDefinition: See .roo/rules-code-implementer/01_role.md
    whenToUse: Any task that requires writing or refactoring code.
    groups:
      - read
      - edit
      - command     # run scripts / just targets
      - mcp         # allowed to call MCP tools
  - slug: qa-engineer
    name: QA Engineer
    description: Designs and executes test strategies, raises defects.
    roleDefinition: See .roo/rules-qa-engineer/01_role.md
    groups:
      - read
      - ["edit", {fileRegex: "\\.(test|spec)\\.(py|ts|tsx)$"}]
      - command
      - mcp
  - slug: security-analyst
    name: Security Analyst
    description: Performs security reviews and hardens code.
    groups: [read, edit, command, mcp]
  - slug: doc-writer
    name: Documentation Writer
    description: Maintains Markdown docs and diagrams.
    groups: [read, ["edit", {fileRegex: "\\.(md|mdx)$"}]]
  - slug: devops
    name: DevOps Engineer
    description: Owns CI/CD, Docker, infra scripts.
    groups: [read, edit, command]
  - slug: telemetry
    name: Telemetry Engineer
    description: Adds observability & metrics.
    groups: [read, edit, command]
  - slug: orchestrator
    name: Orchestrator
    description: Delegates complex tasks to specialised modes.
    groups: [read, mcp]
The .roomodes file may be written in YAML or JSON; YAML is preferred for readability. 
Roo Code Docs

5. MCP server configuration (.roo/mcp.json)
json
Copy
Edit
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@roocode/github-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
Context7 provides generic web‑search, text utilities and DB tools (first‑class Roo recommendation). 
Roo Code Docs

GitHub MCP gives agents repository‑level insights (issues, PRs, actions logs).

Playwright MCP enables browser automation for e2e test generation and live debugging. 
GitHub

Commit this file to version control so every contributor gets identical toolchains.