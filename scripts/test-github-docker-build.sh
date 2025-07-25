#!/bin/bash
set -e

echo "🧪 Testing GitHub Docker Build Process..."

# Simulate GitHub workflow build steps
echo "📋 Step 1: Generate Docker configuration"
chmod +x scripts/build-docker.sh
./scripts/build-docker.sh

echo "📋 Step 2: Check generated Dockerfile"
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not generated"
    exit 1
fi

echo "🔍 Checking Dockerfile content..."
if grep -q "client/" Dockerfile; then
    echo "❌ Dockerfile still contains client/ references"
    grep -n "client/" Dockerfile
    exit 1
else
    echo "✅ No client/ directory references found"
fi

echo "📋 Step 3: Validate build commands"
BUILD_COMMANDS=$(grep -c "npm run build" Dockerfile || echo "0")
if [ "$BUILD_COMMANDS" -eq "1" ]; then
    echo "✅ Single unified build command found"
else
    echo "❌ Expected 1 'npm run build' command, found $BUILD_COMMANDS"
    exit 1
fi

echo "📋 Step 4: Check multi-stage build structure"
STAGES=$(grep -c "FROM.*AS" Dockerfile || echo "0")
if [ "$STAGES" -eq "2" ]; then
    echo "✅ Two-stage build (builder + production)"
else
    echo "❌ Expected 2-stage build, found $STAGES stages"
    exit 1
fi

echo "📋 Step 5: Validate file copy operations"
if grep -q "COPY --from=builder /app/dist ./dist" Dockerfile; then
    echo "✅ Correct dist directory copy"
else
    echo "❌ Missing or incorrect dist directory copy"
    exit 1
fi

echo "📋 Step 6: Check security hardening"
if grep -q "USER pictallion" Dockerfile; then
    echo "✅ Non-root user configuration"
else
    echo "❌ Missing non-root user setup"
    exit 1
fi

echo "📋 Step 7: Verify health check"
if grep -q "HEALTHCHECK" Dockerfile; then
    echo "✅ Health check configured"
else
    echo "❌ Missing health check"
    exit 1
fi

echo ""
echo "✅ GitHub Docker build configuration validated!"
echo ""
echo "📋 Build Process Summary:"
echo "  - Uses unified npm run build command"
echo "  - No separate client package.json dependency"
echo "  - Two-stage build for optimization"
echo "  - Security hardening with non-root user"
echo "  - Health checks and monitoring configured"
echo "  - Correct file paths for dist output"
echo ""
echo "🚀 Ready for GitHub Actions Docker build and push!"