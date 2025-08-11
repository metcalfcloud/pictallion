# Pictallion Security Guidelines

This document describes security practices for all major components of Pictallion, including backend, frontend, Docker, and CI/CD.

## Environment & Secrets

- Store secrets in environment variables or Docker secrets.
- Never commit secrets or credentials to source control.
- Use strong, unique session secrets.
- Pre-commit hooks (e.g., git-secrets) are enforced to prevent accidental leaks.

## Authentication & Authorization

- Desktop mode: No authentication required.
- Web/API mode: Authentication is **not currently implemented**.
- Rate limiting and CORS/CSRF middleware are **not present** in the current implementation.

## File Upload Security

- Validate file types and sizes (`ALLOWED_FILE_TYPES`, `MAX_FILE_SIZE`).
- Store uploads in isolated directories.
- Scan uploads for malware (recommended for all deployments).

## Frontend Security

- Escape and encode user input in React components.
- Use libraries such as `dompurify` to prevent XSS (recommended).
- Enforce Content Security Policy: `default-src 'self'`.

## Database Security

- Use parameterized queries to prevent SQL injection (if applicable).
- Restrict database access to trusted components only.
- Regularly back up database and media files.

## Dependency & CI/CD Security

- Keep dependencies up to date using Dependabot/Renovate.
- Automated SAST (Bandit, Semgrep) runs on each change.
- Generate SBOM (`cyclonedx`) and check for CVEs.
- Multi-stage Dockerfiles; final images are security-hardened.
- CI/CD blocks merges if any test or security check fails.

## Operational Security

- Monitor logs for suspicious activity.
- Use Docker healthchecks and monitoring.

## Error Handling

- Do not expose sensitive error details in API responses.
- Log errors securely.

## Reporting Vulnerabilities

- Report security issues via GitHub Issues or support email.

## References

- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Architecture](ARCHITECTURE.md)