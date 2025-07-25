#!/bin/bash
set -e

echo "🐳 Building Pictallion Docker image..."

# Create Dockerfile
cat > Dockerfile << 'EOF'
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application (client and server)
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./

# Copy package.json and install production dependencies
COPY package*.json ./
RUN npm ci --production

# Create non-root user
RUN addgroup -g 1001 -S pictallion && \
    adduser -S pictallion -u 1001

# Create data directories
RUN mkdir -p data/media/{bronze,silver,gold,dropzone,archive} && \
    mkdir -p data/media/dropzone/duplicates && \
    mkdir -p uploads/temp && \
    chown -R pictallion:pictallion data uploads

# Switch to non-root user
USER pictallion

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/stats', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "dist/index.js"]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  pictallion:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - AI_PROVIDER=${AI_PROVIDER:-ollama}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://ollama:11434}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - pictallion_data:/app/data
      - pictallion_uploads:/app/uploads
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=pictallion
      - POSTGRES_USER=pictallion
      - POSTGRES_PASSWORD=pictallion_password_change_me
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    # Uncomment for GPU support
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

volumes:
  pictallion_data:
  pictallion_uploads:
  postgres_data:
  ollama_data:
EOF

# Create .dockerignore
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.coverage
dist
*.md
.DS_Store
.vscode
.idea
EOF

# Create docker setup script
cat > scripts/docker-setup.sh << 'EOF'
#!/bin/bash
set -e

echo "🐳 Setting up Pictallion with Docker..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
# Database Configuration
DATABASE_URL=postgresql://pictallion:pictallion_password_change_me@postgres:5432/pictallion

# AI Configuration
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llava:latest
OLLAMA_TEXT_MODEL=llama3.2:latest

# OpenAI (optional)
# OPENAI_API_KEY=your_openai_api_key_here
ENVEOF
    echo "📝 Created .env file"
fi

# Build and start services
echo "🚀 Building and starting services..."
docker-compose up -d --build

# Wait for ollama to be ready
echo "⏳ Waiting for Ollama to start..."
sleep 10

# Pull required models
echo "📥 Pulling AI models..."
docker-compose exec ollama ollama pull llava:latest
docker-compose exec ollama ollama pull llama3.2:latest

echo ""
echo "✅ Pictallion is now running!"
echo ""
echo "🌐 Access the application at: http://localhost:5000"
echo "🤖 Ollama API at: http://localhost:11434"
echo ""
echo "🔧 Useful commands:"
echo "   View logs:    docker-compose logs -f pictallion"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart pictallion"
echo "   Update:       docker-compose pull && docker-compose up -d"
EOF

chmod +x scripts/docker-setup.sh

echo "✅ Docker configuration created!"
echo ""
echo "🚀 To run with Docker:"
echo "   ./scripts/docker-setup.sh"
echo ""
echo "📦 Files created:"
echo "   - Dockerfile"
echo "   - docker-compose.yml"
echo "   - .dockerignore"
echo "   - scripts/docker-setup.sh"