#!/bin/bash
# Test build configuration
echo "🔍 Testing Docker configuration..."

# Run configuration test
chmod +x scripts/test-docker-config.sh

# Test Docker image startup (with timeout)
if docker run --rm -d --name pictallion-test \
  -e DATABASE_URL=postgresql://test:test@localhost:5432/test \
  -e NODE_ENV=production \
  ghcr.io/${GITHUB_REPOSITORY}:${GITHUB_SHA} > /dev/null 2>&1; then

  echo "✅ Container started successfully"

  # Wait briefly and check if still running
  sleep 5
  if docker ps | grep pictallion-test > /dev/null; then
    echo "✅ Container is running"
    docker stop pictallion-test
  else
    echo "❌ Container exited unexpectedly"
    docker logs pictallion-test
    exit 1
  fi
else
  echo "❌ Failed to start container"
  exit 1
fi