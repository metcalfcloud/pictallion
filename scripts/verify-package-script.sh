#!/bin/bash
set -e

echo "🔍 Verifying package.sh script integrity..."

# Check for problematic references
PROBLEMS=0

if grep -q "client/dist" scripts/package.sh; then
    echo "❌ Found client/dist reference in package.sh:"
    grep -n "client/dist" scripts/package.sh
    PROBLEMS=$((PROBLEMS + 1))
fi

if grep -q "frontend assets" scripts/package.sh; then
    echo "❌ Found 'frontend assets' reference in package.sh:"
    grep -n "frontend assets" scripts/package.sh
    PROBLEMS=$((PROBLEMS + 1))
fi

if grep -q "Building frontend" scripts/package.sh; then
    echo "❌ Found 'Building frontend' reference in package.sh:"
    grep -n "Building frontend" scripts/package.sh
    PROBLEMS=$((PROBLEMS + 1))
fi

# Check for correct references
if ! grep -q "Building application" scripts/package.sh; then
    echo "❌ Missing 'Building application' in package.sh"
    PROBLEMS=$((PROBLEMS + 1))
fi

if ! grep -q "dist/public" scripts/package.sh; then
    echo "❌ Missing 'dist/public' reference in package.sh"
    PROBLEMS=$((PROBLEMS + 1))
fi

if ! grep -q "npm run build" scripts/package.sh; then
    echo "❌ Missing 'npm run build' reference in package.sh"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [ $PROBLEMS -eq 0 ]; then
    echo "✅ Package script verified - no problematic references found"
    echo "✅ Contains correct references to:"
    echo "   - 'Building application' (not 'Building frontend')"
    echo "   - 'dist/public' (not 'client/dist')"
    echo "   - 'npm run build' unified build process"
    exit 0
else
    echo "❌ Found $PROBLEMS problems in package.sh script"
    echo ""
    echo "Expected structure:"
    echo "  - echo 'Building application...'"
    echo "  - npm run build"
    echo "  - cp -r dist/* \$TEMP_BUILD_DIR/"
    echo ""
    exit 1
fi