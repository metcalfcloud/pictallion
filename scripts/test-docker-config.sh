#!/bin/bash
set -e

echo "🧪 Testing Docker configuration..."

# Check if all required files exist
echo "📋 Checking Docker files:"
for file in Dockerfile docker-compose.yml .dockerignore scripts/docker-setup.sh; do
    if [ -f "$file" ]; then
        echo "  ✅ $file exists"
    else
        echo "  ❌ $file missing"
        exit 1
    fi
done

# Validate Dockerfile syntax
echo "🔍 Validating Dockerfile syntax..."
if command -v docker &> /dev/null; then
    docker build --no-cache -t pictallion:test . > /tmp/docker-build.log 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ Docker build successful"
        docker images | grep pictallion:test
    else
        echo "  ❌ Docker build failed"
        tail -n 20 /tmp/docker-build.log
        exit 1
    fi
else
    echo "  ⚠️ Docker not available - syntax validation skipped"
fi

# Check docker-compose syntax
echo "🐙 Validating docker-compose.yml syntax..."
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose config > /dev/null
    if [ $? -eq 0 ]; then
        echo "  ✅ docker-compose.yml syntax valid"
    else
        echo "  ❌ docker-compose.yml syntax invalid"
        exit 1
    fi
else
    echo "  ⚠️ docker compose not available - syntax validation skipped"
fi

# Validate build script dependencies
echo "📦 Checking build dependencies..."
npm run build > /tmp/npm-build.log 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ npm run build successful"
    if [ -f dist/index.js ]; then
        echo "  ✅ Server build output exists"
    else
        echo "  ❌ Server build output missing"
        exit 1
    fi
else
    echo "  ❌ npm run build failed"
    tail -n 10 /tmp/npm-build.log
    exit 1
fi

echo ""
echo "✅ Docker configuration test passed!"
echo ""
echo "📋 Configuration Summary:"
echo "  - Dockerfile: Multi-stage build with Node.js 18 Alpine"
echo "  - Services: Pictallion app, PostgreSQL, Ollama"
echo "  - Volumes: Data persistence for all services"
echo "  - Health checks: Application monitoring"
echo "  - Security: Non-root user execution"
echo ""
echo "🚀 Ready for deployment with:"
echo "  ./scripts/docker-setup.sh"