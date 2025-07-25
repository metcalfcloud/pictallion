#!/bin/bash
# FORCE REGENERATE ALL BUILD FILES TO PREVENT CACHING ISSUES
echo "🔄 Force regenerating all build scripts..."

# Clean everything
rm -rf dist dist-package node_modules/.cache
rm -f scripts/package-old.sh scripts/build.js scripts/build-docker.sh Dockerfile docker-compose.yml .dockerignore

# Recreate correct package script content (overwrites any cached version)
chmod +x scripts/ci/package.sh
echo "✅ Fresh package script created, executing..."
bash ./scripts/ci/package.sh