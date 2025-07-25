#!/bin/bash
# Only fail on high/critical vulnerabilities for releases
npm audit --audit-level=high --json > audit-results.json || true

HIGH_CRITICAL=$(cat audit-results.json | jq -r '.vulnerabilities | to_entries[] | select(.value.severity == "high" or .value.severity == "critical") | .key' | wc -l)

if [ "$HIGH_CRITICAL" -gt "0" ]; then
  echo "❌ Cannot create release with high/critical vulnerabilities"
  exit 1
else
  echo "✅ No high/critical vulnerabilities blocking release"
fi