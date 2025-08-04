# Operations Guide: Monitoring, Logging, Backup, Performance, Maintenance

This guide covers operational procedures for running, monitoring, and maintaining the Pictallion Python backend.

## Monitoring

- Use Docker healthchecks and `/health` endpoint
- Integrate with Prometheus/Grafana for metrics
- Monitor logs for errors and performance

## Logging

- Configure log level via `LOG_LEVEL` environment variable
- Logs stored in backend container and optionally forwarded to external systems

## Backup & Recovery

- Regularly backup PostgreSQL database and `/data/media`
- Use automated scripts or scheduled Docker jobs
- Restore from backup using standard PostgreSQL tools

## Rollback Procedures

- To rollback a deployment, restore the previous Docker image and database/media backups
- Use versioned backups for `/data/media` and PostgreSQL
- For database: use `pg_restore` or `psql` with backup files
- For media: restore from backup directory
- Always test rollback in staging before production

## Performance Tuning

- Enable connection pooling for database
- Scale backend with Docker Swarm/Kubernetes
- Optimize AI processing with hardware acceleration (GPU)

## Maintenance

- Keep dependencies up to date (`pip install -U ...`)
- Rotate secrets and session keys regularly
- Monitor disk usage and clean up old media

## Security

- Review [`SECURITY.md`](SECURITY.md:1) for operational security practices

## Troubleshooting

- Check logs for errors
- Validate environment variables
- Use healthcheck endpoints
- For CI/CD failures, review workflow logs and secret configuration

## References

- [Deployment Guide](DEPLOYMENT.md:1) (includes rollback and troubleshooting)
- [Architecture](ARCHITECTURE.md:1)
- [API Documentation](API_DOCUMENTATION.md:1)