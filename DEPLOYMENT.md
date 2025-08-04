# Pictallion Deployment Guide

This guide covers production deployment of the Python FastAPI backend and React frontend using Docker, environment configuration, scaling, and automation.

## Prerequisites

- Docker & Docker Compose
- PostgreSQL database (local or cloud)
- Python 3.11+ (for manual setup)
- Node.js 18+ (for frontend builds)
- Optional: Ollama (local AI), OpenAI API key

## Environment Variables

See [.env.example](.env.example:1) for all required variables. Key settings:
- DATABASE_URL
- DB_TYPE
- AI_PROVIDER, OLLAMA_BASE_URL, OPENAI_API_KEY
- SESSION_SECRET, LOG_LEVEL

## Docker Deployment

### Quick Start

```bash
# Build and run all services
docker compose -f docker/docker-compose.yml up --build
```

- Backend: Exposed on port 8000
- Database: Exposed on port 5432
- Media files: Persisted in /data/media

### Docker Compose Overview

- [`docker/docker-compose.yml`](docker/docker-compose.yml:1): Multi-service config (backend, db)
- [`docker/Dockerfile.external`](docker/Dockerfile.external:1): Python backend image

### Production Build

```bash
# Build production image
docker build -f docker/Dockerfile.external -t pictallion-backend:prod .
docker run -p 8000:8000 pictallion-backend:prod
```

### Scaling & Performance

- Use Docker Swarm/Kubernetes for multi-instance scaling
- Configure database connection pooling
- Use persistent volumes for media
- Monitor with Prometheus/Grafana (see monitoring guide)

## Deployment Automation

- Scripts in [`scripts/`](scripts/) automate builds, tests, and packaging
- CI/CD via GitHub Actions for automated builds and tests

## Secrets Management

- Store secrets in Docker secrets or a managed secret manager (recommended for production)
- Never commit secrets to source control
- Use `.env.example` as a template; never store real secrets in `.env` files
- For Docker Compose, use the `secrets:` block to mount secrets securely (see example below)
- Reference secrets in your application as `/run/secrets/<secret_name>`
- Rotate secrets and session keys regularly
- For CI/CD, use your provider's secret management (e.g., GitHub Actions secrets)

## Reproducible Builds & CI/CD

- All artefacts can be built and deployed from a fresh clone using:
  ```
  just build
  docker compose up --build
  ```
- CI/CD pipelines (see `.github/workflows/`) automate builds, tests, and deployments
- Ensure all environment variables are set via secrets/config layers before deployment
- For production, verify image size (≤400MB) and volume usage for persistent data
- Do NOT hard-code passwords, API keys, or session secrets in .env files
- See [.env.example](.env.example:1) for placeholder values and secure config guidance
- Example Docker Compose secrets usage:
  ```
  secrets:
    db_user:
      file: ../secrets/db_user.txt
    db_pass:
      file: ../secrets/db_pass.txt
  ```
- Reference secrets in your compose and Dockerfile as `/run/secrets/db_user` and `/run/secrets/db_pass`

## Health Checks & Monitoring

- Backend exposes `/health` endpoint
- Use Docker healthcheck or external monitoring (Prometheus/Grafana recommended)

## Rollback Procedures

- To rollback a deployment, restore the previous Docker image and database/media backups
- Use versioned backups for `/data/media` and PostgreSQL
- For database: `pg_restore` or `psql` with backup files
- For media: restore from backup directory
- Always test rollback in staging before production

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