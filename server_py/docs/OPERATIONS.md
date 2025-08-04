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

## References

- [Deployment Guide](DEPLOYMENT.md)
- [Architecture](ARCHITECTURE.md)
- [API Documentation](API_DOCUMENTATION.md)