# Project Documentation Overview

This directory contains comprehensive documentation for the Pictallion project. Use these resources to understand the architecture, API, development workflow, deployment, security practices, and contribution guidelines.

## Documentation Structure

- [`API_DOCUMENTATION.md`](../API_DOCUMENTATION.md:1): Details all available API endpoints, request/response formats, and usage examples.
- [`ARCHITECTURE.md`](../ARCHITECTURE.md:1): Explains the overall system design, major components, and data flow.
- [`DEVELOPMENT.md`](../DEVELOPMENT.md:1): Provides instructions for setting up the development environment, running the project locally, and development best practices.
- [`DEPLOYMENT.md`](../DEPLOYMENT.md:1): Outlines deployment procedures, environment configuration, and release management.
- [`SECURITY.md`](../SECURITY.md:1): Documents security policies, threat models, and secure coding guidelines.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md:1): Describes how to contribute to the project, including code standards and pull request process.

## Usage

Refer to each documentation file for specific guidance. For general project information, installation, and major updates, see the main [`README.md`](../README.md:1) in the project root.

## Local Testing & Troubleshooting

- Use the [`justfile`](../justfile:1) in the project root for setup, development, build, test, lint, and clean commands.
- Ensure all prerequisites are installed:
  - **Rust** (for backend)
  - **Tauri CLI** (for desktop integration)
  - **Node.js** and **npm** or **yarn** (for frontend)
  - **pytest** (for Python backend testing)
  - **Vitest** and **Playwright** (for frontend testing)
- For troubleshooting, review terminal logs and documentation files for guidance.

## Feedback & Support

Report issues or request support via [GitHub Issues](https://github.com/yourusername/pictallion/issues) or [GitHub Discussions](https://github.com/yourusername/pictallion/discussions).
If your repository URL differs, update these links accordingly.
