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

# Copy essential files
echo "📄 Copying configuration files..."
cp drizzle.config.ts $TEMP_BUILD_DIR/
cp -r shared $TEMP_BUILD_DIR/

# Create production package.json
echo "📝 Creating production package.json..."
cat > $TEMP_BUILD_DIR/package.json << 'EOF'
{
  "name": "pictallion",
  "version": "1.0.0",
  "type": "module",
  "description": "AI-powered photo management platform",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "connect-pg-simple": "^10.0.0",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0",
    "exif": "^0.6.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "multer": "^2.0.2",
    "nanoid": "^5.1.5",
    "openai": "^5.10.2",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "ws": "^8.18.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.4"
  }
}
EOF

# Create data directories
echo "📁 Creating data directories..."
mkdir -p $TEMP_BUILD_DIR/data/media/{bronze,silver,gold,dropzone,archive}
mkdir -p $TEMP_BUILD_DIR/data/media/dropzone/duplicates
mkdir -p $TEMP_BUILD_DIR/uploads/temp

# Create startup script
echo "🚀 Creating startup script..."
cat > $TEMP_BUILD_DIR/start.js << 'EOF'
#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎯 Starting Pictallion Photo Management...');
console.log('📍 Open http://localhost:5000 in your browser');
console.log('⏹️  Press Ctrl+C to stop\n');

const server = spawn('node', ['index.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
  cwd: __dirname
});

server.on('close', (code) => {
  console.log(`\n🛑 Server stopped with code ${code}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Pictallion...');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
EOF

chmod +x $TEMP_BUILD_DIR/start.js

# Create installation scripts
echo "📋 Creating installation scripts..."

# Linux/macOS installer
cat > $TEMP_BUILD_DIR/install.sh << 'EOF'
#!/bin/bash
set -e

echo "🎯 Installing Pictallion Photo Management..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt "18" ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node --version)"
    echo "Please update Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

echo "🔧 Setting up environment..."
if [ ! -f ".env" ]; then
    cat > .env << 'ENVEOF'
# Database Configuration
DATABASE_URL=postgresql://pictallion:your_password@localhost:5432/pictallion

# AI Provider (choose one)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
# OPENAI_API_KEY=sk-your-key-here

# Application Settings
NODE_ENV=production
PORT=5000
ENVEOF
    echo "📝 Created .env file - please configure your database and AI settings"
else
    echo "📝 .env file already exists"
fi

echo ""
echo "✅ Pictallion installed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your .env file with database settings"
echo "2. Set up PostgreSQL database"
echo "3. Run: node start.js"
echo ""
echo "🌐 Application will be available at http://localhost:5000"
EOF

chmod +x $TEMP_BUILD_DIR/install.sh

# Windows installer
cat > $TEMP_BUILD_DIR/install.bat << 'EOF'
@echo off
echo 🎯 Installing Pictallion Photo Management...

REM Check for Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is required but not installed.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected

REM Install dependencies
echo 📦 Installing dependencies...
npm install --production

REM Create environment file
if not exist .env (
    echo # Database Configuration > .env
    echo DATABASE_URL=postgresql://pictallion:your_password@localhost:5432/pictallion >> .env
    echo. >> .env
    echo # AI Provider (choose one) >> .env
    echo AI_PROVIDER=ollama >> .env
    echo OLLAMA_BASE_URL=http://localhost:11434 >> .env
    echo # OPENAI_API_KEY=sk-your-key-here >> .env
    echo. >> .env
    echo # Application Settings >> .env
    echo NODE_ENV=production >> .env
    echo PORT=5000 >> .env
    echo 📝 Created .env file - please configure your database and AI settings
) else (
    echo 📝 .env file already exists
)

echo.
echo ✅ Pictallion installed successfully!
echo.
echo 📋 Next steps:
echo 1. Configure your .env file with database settings
echo 2. Set up PostgreSQL database
echo 3. Run: node start.js
echo.
echo 🌐 Application will be available at http://localhost:5000
pause
EOF

# Create documentation
echo "📚 Creating documentation..."
cat > $TEMP_BUILD_DIR/README.md << 'EOF'
# Pictallion Photo Management

AI-powered photo management platform with tiered processing system.

## Quick Start

### Linux/macOS
```bash
./install.sh
node start.js
```

### Windows
```cmd
install.bat
node start.js
```

## Configuration

Edit `.env` file to configure:
- Database connection
- AI provider (Ollama or OpenAI)
- Application settings

## Requirements

- Node.js 18+
- PostgreSQL database
- Ollama (optional, for local AI) or OpenAI API key

## Support

Visit our documentation for detailed setup instructions and troubleshooting.
EOF

# Create version info
echo "📄 Creating version info..."
cat > $TEMP_BUILD_DIR/VERSION << EOF
Pictallion v1.0.0
Built on: $(date)
Node.js: $(node --version)
Platform: $(uname -s)-$(uname -m)
EOF

# Create final distribution archive
echo "📦 Creating distribution archive..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="pictallion_v1.0.0_${TIMESTAMP}.tar.gz"

cd $TEMP_BUILD_DIR
tar -czf "../${ARCHIVE_NAME}" .
cd ..

# Cleanup
rm -rf $TEMP_BUILD_DIR

echo "✅ Created ${ARCHIVE_NAME} for Linux/macOS"
echo ""
# Add Windows batch installation script
if [ "$IS_WINDOWS" = true ]; then
    echo "📋 Creating Windows installation script..."
    cat > $TEMP_BUILD_DIR/install.bat << 'EOF'
@echo off
setlocal enabledelayedexpansion

echo 🚀 Installing Pictallion...

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

:: Check version  
for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VERSION=%%a
for /f "tokens=1 delims=." %%a in ("!NODE_VERSION!") do set MAJOR_VERSION=%%a
if !MAJOR_VERSION! lss 18 (
    echo ❌ Node.js version !NODE_VERSION! is too old. Please install Node.js 18+.
    pause
    exit /b 1
)

echo ✅ Node.js !NODE_VERSION! found

:: Install dependencies with Windows-specific settings
echo 📦 Installing dependencies...
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000  
npm config set fetch-timeout 300000
npm install --production --no-audit

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies. Retrying...
    npm install --production --no-audit --prefer-offline
)

echo ✅ Pictallion installed successfully!
echo.
echo 🔧 Next steps:
echo    1. Copy .env.example to .env and configure your database
echo    2. Run: node start.js
echo    3. Open http://localhost:5000
pause
EOF
fi

echo "🎉 Pictallion build complete!"
echo ""
echo "📦 Distribution files:"
echo "   - ${ARCHIVE_NAME} (Linux/macOS)"
echo ""
echo "🚀 To distribute:"
echo "   1. Share the appropriate archive file"
echo "   2. Recipients run install.sh (Unix) or install.bat (Windows)"
echo "   3. Configure database in .env file"
echo "   4. Run: node start.js"
echo ""
echo "📍 Application will be available at http://localhost:5000"