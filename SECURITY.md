# Pictallion Security Guidelines

This document outlines security best practices, authentication, authorization, and operational security for the Python FastAPI backend.

## Environment & Secrets

- Store secrets in environment variables or Docker secrets
- Never commit secrets to source control
- Use strong, unique session secrets

## Authentication & Authorization

- Current: No authentication required (standalone desktop mode)
- Future: JWT-based authentication planned with FastAPI's HTTPBearer
- Rate limiting middleware available (see [`python-backend-architecture.md`](python-backend-architecture.md:1))

## File Upload Security

- Validate file types and sizes (`ALLOWED_FILE_TYPES`, `MAX_FILE_SIZE`)
- Store uploads in isolated directories
- Scan uploads for malware (optional)

## Database Security

- Use parameterized queries to prevent SQL injection
- Restrict database access to backend only
- Regularly backup database and media files

## Operational Security

- Monitor logs for suspicious activity
- Use Docker healthchecks and monitoring
- Keep dependencies up to date

## Error Handling

- Do not expose sensitive error details in API responses
- Log errors securely

## Reporting Vulnerabilities

- Report security issues via GitHub Issues or support email

## References

- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Architecture](ARCHITECTURE.md)