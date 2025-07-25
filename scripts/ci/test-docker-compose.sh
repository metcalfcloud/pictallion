#!/bin/bash
# Create test environment
cat > .env << EOF
DATABASE_URL=postgresql://pictallion:pictallion_password_change_me@postgres:5432/pictallion
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
EOF

# Test docker-compose configuration
echo "🔍 Validating docker-compose configuration..."
docker compose config > /dev/null

# Start database only for testing
echo "🚀 Starting PostgreSQL..."
docker compose up -d postgres

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL..."
timeout 30 bash -c 'until docker compose exec -T postgres pg_isready -U pictallion; do sleep 1; done'

# Check postgres is accessible
docker compose exec -T postgres psql -U pictallion -d pictallion -c "SELECT 1;" > /dev/null
echo "✅ PostgreSQL is ready"

# Test application build
echo "🏗️ Testing application build..."
docker compose build pictallion

echo "✅ Docker Compose configuration test passed"

# Cleanup
docker compose down -v