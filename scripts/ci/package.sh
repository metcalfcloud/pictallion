#!/bin/bash
set -e

# Detect OS and adjust behavior
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
  IS_WINDOWS=true
  echo "📦 Building Pictallion for Windows distribution..."
else
  IS_WINDOWS=false
  echo "📦 Building Pictallion for distribution..."
fi

# Create temporary build directory
TEMP_BUILD_DIR="dist-package"
rm -rf $TEMP_BUILD_DIR
mkdir -p $TEMP_BUILD_DIR

# Build application (creates dist/public and dist/index.js)
echo "🏗️ Building application..."
npm run build

# Verify build outputs exist
if [ ! -f "dist/index.js" ]; then
    echo "❌ Server build failed - dist/index.js not found"
    exit 1
fi

if [ ! -d "dist/public" ]; then
    echo "❌ Client build failed - dist/public not found"
    exit 1
fi

echo "✅ Build completed successfully"

# Copy all built assets to package directory
echo "📋 Copying built application..."
cp -r dist/* $TEMP_BUILD_DIR/

# Create production package.json
echo "📝 Creating production package.json..."
cat > $TEMP_BUILD_DIR/package.json << 'PACKAGE_EOF'
{
  "name": "pictallion",
  "version": "1.0.0",
  "description": "AI-powered photo management platform",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "drizzle-orm": "^0.35.3",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1"
  }
}
PACKAGE_EOF

# Create startup script
echo "🚀 Creating startup script..."
cat > $TEMP_BUILD_DIR/start.js << 'START_EOF'
#!/usr/bin/env node
import { spawn } from 'child_process';

console.log('🎯 Starting Pictallion...');
console.log('📍 Open http://localhost:5000');

const server = spawn('node', ['index.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

server.on('close', (code) => {
  console.log(`Server stopped with code ${code}`);
});

process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});
START_EOF

chmod +x $TEMP_BUILD_DIR/start.js

# Create install scripts
echo "📋 Creating installation scripts..."
cat > $TEMP_BUILD_DIR/install.sh << 'INSTALL_EOF'
#!/bin/bash
set -e

echo "🚀 Installing Pictallion..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node -v) found"
echo "📦 Installing dependencies..."
npm install --production

echo "✅ Installation complete!"
echo "Configure .env file and run: node start.js"
INSTALL_EOF

chmod +x $TEMP_BUILD_DIR/install.sh

# Windows installer
cat > $TEMP_BUILD_DIR/install.bat << 'INSTALL_WIN_EOF'
@echo off
echo Installing Pictallion...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Install Node.js 18+
    pause
    exit /b 1
)

echo Installing dependencies...
npm install --production --no-audit

echo Installation complete!
echo Configure .env file and run: node start.js
pause
INSTALL_WIN_EOF

# Create archive
echo "📦 Creating distribution archive..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="pictallion_v1.0.0_${TIMESTAMP}.tar.gz"

cd $TEMP_BUILD_DIR
tar -czf "../${ARCHIVE_NAME}" .
cd ..

rm -rf $TEMP_BUILD_DIR

echo "✅ Created ${ARCHIVE_NAME}"
echo "🎉 Build complete!"