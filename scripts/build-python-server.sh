#!/bin/bash

# DEPRECATED: This script is for Python server deployment only
# For Tauri desktop builds, use: just build
# For development, use: just dev

echo "WARNING: This script builds for Python server deployment, not Tauri desktop"
echo "For Tauri desktop builds, use: just build"
echo "For development, use: just dev"
echo ""
echo "Continuing with Python server build..."

# Ensure script runs from project root
cd "$(dirname "$0")"/..

# Production build script for Pictallion Python Server
export NODE_ENV=production

# Clean previous builds
rm -rf dist
mkdir -p dist

# Build frontend to dist/public for Python server
echo "Building frontend for Python server..."
cd frontend && npm run build && cd ..
cp -r frontend/dist dist/public

# Verify frontend build
if [ ! -d "dist/public" ]; then
    echo "Error: Frontend build failed - dist/public directory not created"
    exit 1
fi

echo "Python server build completed successfully!"
echo "Frontend assets: ./dist/public/"
echo "Python backend: Use server_py/ directory with requirements.txt"
ls -la dist/
ls -la dist/public/
echo ""
echo "To run the Python backend:"
echo "cd server_py && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"