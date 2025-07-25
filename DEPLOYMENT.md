# Pictallion Deployment Guide

This guide covers different ways to package, deploy, and distribute Pictallion for various environments.

## Quick Packaging for Distribution

### Option 1: Native Package (Recommended)
```bash
# Make the script executable
chmod +x scripts/package.sh

# Build and package
./scripts/package.sh
```

This creates:
- `pictallion_v1.0.0_TIMESTAMP.tar.gz` (Linux/macOS)
- `pictallion_v1.0.0_TIMESTAMP.zip` (Windows)

### Option 2: Docker Container
```bash
# Build Docker setup
chmod +x scripts/build-docker.sh
./scripts/build-docker.sh

# Run with Docker
./scripts/docker-setup.sh
```

## Distribution Methods

### For End Users (Simple Installation)

**What you share:**
- The packaged archive (.tar.gz or .zip)
- Installation instructions

**What recipients do:**
1. Extract the archive
2. Run `install.sh` (Linux/Mac) or `install.bat` (Windows)
3. Edit `.env` with database credentials
4. Run `node start.js`

### For Developers (Source Code)

**Share the entire project:**
1. Clone/download the source code
2. `npm install` to install dependencies
3. `npm run dev` for development mode
4. `npm run build` to create production build

## Deployment Environments

### 1. Local/Personal Use
- Use the native package method
- Includes automatic installer scripts
- Works on Windows, macOS, and Linux

### 2. Small Team/Office
- Use Docker Compose for easy setup
- Includes PostgreSQL and Ollama containers
- Easy to backup and restore

### 3. Production Server
- Use Docker with external database
- Set up reverse proxy (nginx)
- Configure SSL certificates
- Use environment variables for secrets

### 4. Cloud Deployment
- Deploy to VPS (DigitalOcean, Linode, etc.)
- Use managed PostgreSQL (Neon, Supabase)
- Configure for external access

## Configuration Examples

### Basic .env Configuration
```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/pictallion

# Server
PORT=5000
NODE_ENV=production

# AI (choose one or both)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
# OPENAI_API_KEY=sk-your-key-here
```

### Docker Environment
```bash
# Database (Docker internal)
DATABASE_URL=postgresql://pictallion:password@postgres:5432/pictallion

# AI (Docker internal)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
```

**Important Notes:**
- Use `docker compose` (not `docker-compose`) with modern Docker installations
- The Docker build uses a unified structure (no separate client directory)
- Multi-stage build optimizes image size and security
- Non-root user execution for enhanced security

### Cloud Production
```bash
# Managed database
DATABASE_URL=postgresql://user:pass@db.provider.com:5432/pictallion

# External Ollama or OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-production-key
```

## System Requirements

### Minimum Requirements
- Node.js 18+
- 1GB RAM
- 5GB storage
- PostgreSQL database

### Recommended Requirements
- Node.js 20+
- 4GB RAM
- 50GB+ storage
- SSD for database
- Ollama for local AI processing

## Security Considerations

### For Distribution
- Don't include API keys in packages
- Use environment variables for secrets
- Include security documentation
- Provide example configurations

### For Production
- Use strong database passwords
- Enable SSL/TLS
- Configure firewall rules
- Regular security updates
- Backup strategies

## Troubleshooting

### Common Distribution Issues
1. **Node.js version conflicts** - Specify minimum version
2. **Database connection** - Provide clear setup instructions
3. **File permissions** - Include proper chmod commands
4. **Port conflicts** - Document port configuration

### Installation Support
- Include comprehensive README
- Provide example configurations
- Document common error messages
- Include system requirements

## Automation Scripts

The project includes several automation scripts:

- `scripts/package.sh` - Create distribution packages
- `scripts/build-docker.sh` - Setup Docker deployment
- `scripts/docker-setup.sh` - Initialize Docker environment

## Best Practices

### For Distributors
1. Test packages on clean systems
2. Include all necessary dependencies
3. Provide clear installation instructions
4. Document system requirements
5. Include troubleshooting guide

### For Recipients
1. Read README.md first
2. Check system requirements
3. Configure database before starting
4. Test with sample photos
5. Configure AI providers

---

Choose the deployment method that best fits your needs:
- **Personal use**: Native package
- **Team use**: Docker Compose
- **Production**: Docker with external services
- **Development**: Source code with npm