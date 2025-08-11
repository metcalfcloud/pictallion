#!/usr/bin/env sh
# Check for CRLF line endings in .sh, .yml, .yaml, Dockerfile* files

set -e

# Find relevant files (tracked, staged, or in repo)
FILES=$(git ls-files '*.sh' '*.yml' '*.yaml' 'Dockerfile*')

ERROR=0

for f in $FILES; do
  if [ -f "$f" ]; then
    # Check for CRLF (\r\n) line endings
    if grep -q $'\r' "$f"; then
      echo "❌ Line ending violation: $f contains CRLF (Windows) line endings."
      ERROR=1
    fi
  fi
done

if [ "$ERROR" -ne 0 ]; then
  echo "One or more files have CRLF line endings. Please convert to LF (Unix) before committing."
  echo "See README.md for line ending policy."
  exit 1
fi

echo "✅ All checked files use LF line endings."