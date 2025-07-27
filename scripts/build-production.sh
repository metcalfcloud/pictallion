#!/bin/bash

# Production build script for Pictallion
export NODE_ENV=production

# Clean previous builds
rm -rf dist
mkdir -p dist

# Build frontend to dist/public
echo "Building frontend..."
NODE_ENV=production npx vite build --outDir=dist/public

# Verify frontend build
if [ ! -d "dist/public" ]; then
    echo "Error: Frontend build failed - dist/public directory not created"
    exit 1
fi

# Build backend to dist
echo "Building backend..."
NODE_ENV=production npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Verify backend build
if [ ! -f "dist/index.js" ]; then
    echo "Error: Backend build failed - dist/index.js not created"
    exit 1
fi

echo "Build completed successfully!"
echo "Frontend assets: ./dist/public/"
echo "Backend bundle: ./dist/index.js"
ls -la dist/
ls -la dist/public/