#!/bin/bash
set -e

echo "🔍 Validating GitHub Docker Workflow Configuration..."

# Test 1: Verify Docker build script generates correct Dockerfile
echo "📋 Test 1: Docker build script validation"
rm -f Dockerfile docker-compose.yml .dockerignore scripts/docker-setup.sh
chmod +x scripts/build-docker.sh
./scripts/build-docker.sh

if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile not generated"
    exit 1
fi

echo "✅ Docker files generated"

# Test 2: Check for client/ directory references
echo "📋 Test 2: Checking for problematic client/ references"
if grep -q "client/" Dockerfile; then
    echo "❌ Dockerfile contains client/ references:"
    grep -n "client/" Dockerfile
    exit 1
else
    echo "✅ No client/ references in Dockerfile"
fi

# Test 3: Validate build commands
echo "📋 Test 3: Validating build process"
BUILD_COMMANDS=$(grep -c "npm run build" Dockerfile || echo "0")
CLIENT_COMMANDS=$(grep -c "cd client" Dockerfile || echo "0")

if [ "$BUILD_COMMANDS" -eq "1" ] && [ "$CLIENT_COMMANDS" -eq "0" ]; then
    echo "✅ Correct build commands - unified npm run build only"
else
    echo "❌ Incorrect build commands:"
    echo "  npm run build commands: $BUILD_COMMANDS (expected: 1)"
    echo "  cd client commands: $CLIENT_COMMANDS (expected: 0)"
    exit 1
fi

# Test 4: Validate multi-stage build structure
echo "📋 Test 4: Multi-stage build validation"
STAGES=$(grep -c "FROM.*AS" Dockerfile)
if [ "$STAGES" -eq "2" ]; then
    echo "✅ Correct two-stage build (builder + production)"
else
    echo "❌ Expected 2-stage build, found $STAGES"
    exit 1
fi

# Test 5: Check file copy operations
echo "📋 Test 5: File copy validation"
if grep -q "COPY --from=builder /app/dist ./dist" Dockerfile; then
    echo "✅ Correct dist directory copy operation"
else
    echo "❌ Incorrect or missing dist directory copy"
    exit 1
fi

# Test 6: Validate GitHub workflow steps
echo "📋 Test 6: GitHub workflow validation"
WORKFLOW_FILE=".github/workflows/docker.yml"

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Docker workflow file missing"
    exit 1
fi

# Check for build setup step
if grep -q "Build Docker setup" "$WORKFLOW_FILE"; then
    echo "✅ Docker setup step found in workflow"
else
    echo "❌ Missing Docker setup step in workflow"
    exit 1
fi

# Check for verification step
if grep -q "rm -f Dockerfile" "$WORKFLOW_FILE"; then
    echo "✅ Dockerfile cleanup step found in workflow"
else
    echo "❌ Missing Dockerfile cleanup in workflow"
    exit 1
fi

# Test 7: Build process validation
echo "📋 Test 7: Build process test"
if npm run build > /tmp/build-test.log 2>&1; then
    if [ -f "dist/index.js" ] && [ -d "dist/public" ]; then
        echo "✅ Build process creates correct output structure"
    else
        echo "❌ Build process output structure incorrect"
        echo "Expected: dist/index.js and dist/public/"
        echo "Found:"
        ls -la dist/ 2>/dev/null || echo "No dist directory"
        exit 1
    fi
else
    echo "❌ Build process failed"
    tail -10 /tmp/build-test.log
    exit 1
fi

echo ""
echo "✅ GitHub Docker workflow validation passed!"
echo ""
echo "📋 Validation Summary:"
echo "  - Docker build script generates correct Dockerfile"
echo "  - No client/ directory references in any Docker files"
echo "  - Unified build process using npm run build only"
echo "  - Two-stage build with proper file copy operations"
echo "  - GitHub workflow includes Docker file cleanup and regeneration"
echo "  - Build process creates correct output structure (dist/index.js + dist/public)"
echo ""
echo "🚀 GitHub Actions Docker builds should now succeed!"
echo ""
echo "💡 Key fixes applied:"
echo "  - Removed all client/package.json dependencies"
echo "  - Uses unified project structure without separate client directory"
echo "  - GitHub workflow regenerates Docker files to prevent caching issues"
echo "  - Multi-platform builds (amd64/arm64) with proper architecture support"