# Pictallion Deployment Guide

This guide describes production deployment for all major components of Pictallion using the unified Docker setup. The supported stack includes a Python backend (FastAPI/Uvicorn), React frontend, PostgreSQL database, and optional Ollama AI service.

## Prerequisites

- Docker & Docker Compose
- Python 3.11+ (for manual backend builds, if needed)
- Node.js 18+ (for manual frontend builds, if needed)
- Optional: Ollama (local AI), OpenAI API key

## Environment Variables

See [`.env.example`](.env.example:1) for all required variables. Key settings include:
- `DATABASE_URL`
- `AI_PROVIDER`, `OLLAMA_BASE_URL`, `OPENAI_API_KEY`
- `SESSION_SECRET`, `LOG_LEVEL`

## Deployment (Recommended)

All services (backend, frontend, database, Ollama) are built and run using a single script.

### Quick Start

```bash
./scripts/docker-setup.sh
```

- Application is served from the Python backend container on port 8000.
- Database is exposed on port 5432.
- Ollama AI service is exposed on port 11434.
- Media files are persisted in Docker volumes.

### What the Script Does

- Uses [`docker/docker-compose.yml`](docker/docker-compose.yml:1) and [`docker/Dockerfile.external`](docker/Dockerfile.external:1) for unified deployment.
- Builds and starts all services.
- Pulls required AI models for Ollama.
- Creates `.env` file if missing.

### Access

- Application: [http://localhost:8000](http://localhost:8000)
- Ollama API: [http://localhost:11434](http://localhost:11434)

### Useful Commands

- View logs: `docker-compose logs -f app`
- Stop: `docker-compose down`
- Restart: `docker-compose restart app`
- Update: `docker-compose pull && docker-compose up -d`

## Secrets Management

- Store secrets in Docker secrets or a managed secret manager (recommended for production).
- Never commit secrets to source control.
- Use `.env.example` as a template; never store real secrets in `.env` files.
- Reference secrets in your application as `/run/secrets/<secret_name>`.
- Rotate secrets and session keys regularly.
- For CI/CD, use your provider's secret management (e.g., GitHub Actions secrets).

## Health Checks & Monitoring

- Backend exposes `/health` endpoint.
- Unified deployment includes a health check for the Python service.
- Use Docker healthcheck or external monitoring (Prometheus/Grafana recommended).

## Rollback Procedures

- Restore previous Docker images and database/media backups.
- Use versioned backups for media and PostgreSQL.
- For database: `pg_restore` or `psql` with backup files.
- For media: restore from backup directory.
- Always test rollback in staging before production.

## Troubleshooting

- Check logs with `docker logs <container>`
- Validate environment variables (see `.env.example`)
- Ensure database connectivity (`docker exec <db-container> psql ...`)
- Use `/health` endpoint for service status
- For CI/CD failures, review workflow logs and secret configuration

## References

- [API Documentation](API_DOCUMENTATION.md)
- [Development Guide](DEVELOPMENT.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)