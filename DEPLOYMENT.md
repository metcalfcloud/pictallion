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
docker-compose -f docker/docker-compose.yml up --build
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

- Store secrets in environment variables or Docker secrets
- Never commit secrets to source control

## Health Checks & Monitoring

- Backend exposes `/health` endpoint
- Use Docker healthcheck or external monitoring

## Troubleshooting

- Check logs with `docker logs <container>`
- Validate environment variables
- Ensure database connectivity

## References

- [API Documentation](API_DOCUMENTATION.md)
- [Development Guide](DEVELOPMENT.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)