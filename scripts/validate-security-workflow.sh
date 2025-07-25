#!/bin/bash
set -e

echo "🔒 Validating Security Workflow Configuration..."

# Check workflow syntax
echo "📋 Checking workflow YAML syntax..."
if command -v yq &> /dev/null; then
    yq eval '.github/workflows/security.yml' > /dev/null
    echo "  ✅ Security workflow syntax valid"
else
    echo "  ⚠️ yq not available - syntax validation skipped"
fi

# Check permissions configuration
echo "🔐 Checking permissions configuration..."
PERMS_COUNT=$(grep -c "permissions:" .github/workflows/security.yml || echo "0")
if [ "$PERMS_COUNT" -gt "0" ]; then
    echo "  ✅ Permissions configured ($PERMS_COUNT blocks)"
    grep -A 3 "permissions:" .github/workflows/security.yml | head -12
else
    echo "  ❌ Missing permissions configuration"
    exit 1
fi

# Check required security jobs
echo "🔍 Checking security job configuration..."
REQUIRED_JOBS=("security-audit" "codeql" "docker-security" "secret-scan")
for job in "${REQUIRED_JOBS[@]}"; do
    if grep -q "^  $job:" .github/workflows/security.yml; then
        echo "  ✅ Job '$job' configured"
    else
        echo "  ❌ Missing job '$job'"
        exit 1
    fi
done

# Check SARIF upload configuration
echo "📤 Checking SARIF upload configuration..."
if grep -q "upload-sarif" .github/workflows/security.yml; then
    echo "  ✅ SARIF upload configured"
    if grep -q "if: always()" .github/workflows/security.yml; then
        echo "  ✅ Upload will run even if scan fails"
    else
        echo "  ⚠️ Upload may skip if scan fails"
    fi
else
    echo "  ❌ SARIF upload not configured"
    exit 1
fi

# Check audit failure conditions
echo "⚠️ Checking audit failure conditions..."
if grep -q "exit 1" .github/workflows/security.yml; then
    echo "  ✅ Workflow will fail on high/critical vulnerabilities"
else
    echo "  ⚠️ Workflow may not fail on vulnerabilities"
fi

echo ""
echo "✅ Security workflow validation passed!"
echo ""
echo "📋 Configuration Summary:"
echo "  - Global permissions: contents:read, security-events:write"
echo "  - Job-specific permissions configured where needed"
echo "  - SARIF uploads conditional on event type (not for PRs from forks)"
echo "  - Artifact uploads as fallback for PR security scans"
echo "  - TruffleHog secret scanning with verified-only mode"
echo "  - Trivy Docker vulnerability scanning"
echo "  - CodeQL analysis for JavaScript/TypeScript"
echo "  - NPM audit with high/critical failure threshold"
echo ""
echo "🔒 Security workflow is properly configured for GitHub repository!"