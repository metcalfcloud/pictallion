# Contributing to Pictallion

Thank you for your interest in contributing! This guide covers contribution processes, code style, development workflow, testing, and documentation for all parts of the project (Python backend and TypeScript/React frontend).

## Getting Started

- Fork the repository and clone your fork.
- Set up your development environment (see [`DEVELOPMENT.md`](DEVELOPMENT.md:1)).
- Use feature branches for changes.

## Code Style

- **Python Backend:** Follow [PEP8](https://peps.python.org/pep-0008/), use type hints, format code with [`black`](https://github.com/psf/black), and lint with [`ruff`](https://github.com/astral-sh/ruff).
- **Frontend (TypeScript/React):** Use [`Prettier`](https://prettier.io/) for formatting, follow project ESLint rules, and maintain consistent code style.
- Ensure all code is clean, readable, and well-documented.

## Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Describe your change"`
3. Push branch and open a Pull Request (PR).
4. Ensure your PR references related issues if applicable.

## Testing

- **Python Backend:** Write unit and integration tests using [`pytest`](https://docs.pytest.org/). Run tests with `pytest`. Check coverage with `pytest --cov=app`.
- **Frontend:** Write unit and integration tests using [`Vitest`](https://vitest.dev/) and [`Playwright`](https://playwright.dev/). See [`frontend/tests/README.md`](frontend/tests/README.md:1) for details. Run tests with `just test` (recommended) or `npm test` in the `frontend` directory.
- Add tests for new features, bug fixes, and refactoring.

## Documentation

- Update relevant documentation files for new features or changes.
- Document public APIs and endpoints (see [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md:1)).
- Ensure all README files are up to date.

## Contribution Checklist

- [ ] Code follows style and type hints.
- [ ] Tests added/updated.
- [ ] Documentation updated.
- [ ] No secrets or credentials in commits.

## References

- [`DEVELOPMENT.md`](DEVELOPMENT.md:1)
- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md:1)
- [`ARCHITECTURE.md`](ARCHITECTURE.md:1)
- [`frontend/README.md`](frontend/README.md:1)
- [`frontend/tests/README.md`](frontend/tests/README.md:1)