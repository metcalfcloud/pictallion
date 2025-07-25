#!/bin/bash
# Windows-specific npm install with retry logic
if [ "$OS" = "windows-latest" ]; then
  echo "🪟 Installing dependencies for Windows..."
  npm config set fetch-retry-mintimeout 20000
  npm config set fetch-retry-maxtimeout 120000
  npm config set fetch-timeout 300000
  npm install --no-audit --prefer-offline || npm install --no-audit
else
  npm ci
fi