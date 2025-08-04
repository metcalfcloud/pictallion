#!/bin/bash

# Ensure script runs from project root
cd "$(dirname "$0")"/..
npm ci

# Production build script for Pictallion
export NODE_ENV=production

# Clean previous builds
rm -rf dist
mkdir -p dist

# Build frontend to dist/public from client directory
echo "Building frontend..."
NODE_ENV=production npx vite build

# Verify frontend build
if [ ! -d "dist/public" ]; then
    echo "Error: Frontend build failed - dist/public directory not created"
    exit 1
fi

echo "Build completed successfully!"
echo "Frontend assets: ./dist/public/"
echo "Python backend: Use server_py/ directory with requirements.txt"
ls -la dist/
ls -la dist/public/
echo ""
echo "To run the Python backend:"
echo "cd server_py && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"