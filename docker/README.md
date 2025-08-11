# Pictallion Docker Web Deployment

This directory contains the Docker configuration for deploying Pictallion as a web application.

## Quick Start

```bash
# From the project root directory
./scripts/docker-setup.sh
```

The web application will be available at: http://localhost:8080

## Manual Setup

```bash
# Build and run
cd docker
docker-compose up -d --build

# View logs
docker-compose logs -f pictallion-web

# Stop
docker-compose down
```

## What's Included

- **Single Docker Image**: Contains the React frontend built and served with `serve`
- **Port 8080**: Web application accessible on this port
- **Health Check**: Built-in health monitoring
- **Non-root User**: Runs as unprivileged user for security

## Architecture

This Docker setup serves the **web frontend only**. It builds the React application from the `frontend/` directory and serves it as a static web application.

For the full desktop application with Tauri backend, use the native desktop builds available in the releases.

## Development vs Production

- **Development**: Use `npm run dev` in the `frontend/` directory
- **Production Web**: Use this Docker setup
- **Production Desktop**: Use the Tauri builds from releases

## Troubleshooting

### Docker Desktop Connection Issues
If you see errors like "unable to get image" or "cannot find file specified":
- Ensure Docker Desktop is running
- Try restarting Docker Desktop
- On Windows, make sure Docker Desktop is using the correct backend (WSL2 or Hyper-V)
- Test Docker with: `docker --version` and `docker ps`

### Build Issues
- Ensure `frontend/package.json` exists
- Check that `npm run build` works in the `frontend/` directory
- Verify Node.js dependencies are properly installed

### Port Conflicts
- Change the port mapping in `docker-compose.yml` if 8080 is in use
- Example: `"3000:8080"` to use port 3000 instead

### Health Check Failures
- The container includes a health check at `/health`
- Check logs with `docker-compose logs pictallion-web`
- Ensure `wget` is available in the container (should be installed automatically)

### Permission Issues
- The container runs as a non-root user for security
- If you encounter permission errors, check file ownership in the build context