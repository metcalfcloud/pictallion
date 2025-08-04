# Contributing to Pictallion Python Backend

Thank you for your interest in contributing! This guide covers code style, development workflow, testing, and best practices for the Python backend.

## Getting Started

- Fork the repository and clone your fork
- Set up development environment (see [`DEVELOPMENT.md`](DEVELOPMENT.md:1))
- Use feature branches for changes

## Code Style

- Follow [PEP8](https://peps.python.org/pep-0008/) conventions
- Use type hints throughout
- Format code with `black`
- Run linting with `ruff`

## Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Describe your change"`
3. Push branch and open a Pull Request

## Testing

- Write unit and integration tests for new features
- Use `pytest` for all tests
- Run tests: `pytest`
- Check coverage: `pytest --cov=app`
- Add tests for bug fixes and refactoring

## Documentation

- Update relevant documentation files for new features
- Document public APIs and endpoints

## Contribution Checklist

- Code follows style and type hints
- Tests added/updated
- Documentation updated
- No secrets or credentials in commits

## References

- [Development Guide](DEVELOPMENT.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Architecture](ARCHITECTURE.md)