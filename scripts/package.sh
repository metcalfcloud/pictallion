#!/bin/bash
set -e

echo "📦 Building Pictallion for distribution..."

# Create build directory
BUILD_DIR="dist"
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

# Build application
echo "🏗️  Building application..."
npm run build

# Copy client build (already in dist/public from vite build)
echo "📋 Frontend assets already built to dist/public"

# Server already built to dist/index.js by npm run build
echo "🚀 Backend already built to dist/index.js"

# Copy essential files
echo "📄 Copying configuration files..."
cp package.json $BUILD_DIR/
cp drizzle.config.ts $BUILD_DIR/
cp -r shared $BUILD_DIR/

# Create production package.json
echo "📝 Creating production package.json..."
cat > $BUILD_DIR/package.json << 'EOF'
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
mkdir -p $BUILD_DIR/data/media/{bronze,silver,gold,dropzone,archive}
mkdir -p $BUILD_DIR/data/media/dropzone/duplicates
mkdir -p $BUILD_DIR/uploads/temp

# Create startup script
echo "🚀 Creating startup script..."
cat > $BUILD_DIR/start.js << 'EOF'
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

chmod +x $BUILD_DIR/start.js

# Create installation scripts
echo "📋 Creating installation scripts..."

# Linux/macOS installer
cat > $BUILD_DIR/install.sh << 'EOF'
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
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node --version)"
    echo "Please update from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Set up environment
echo "🔧 Setting up environment..."
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
# Database Configuration
# Replace with your PostgreSQL connection string
DATABASE_URL=postgresql://username:password@localhost:5432/pictallion

# Server Configuration
PORT=5000
NODE_ENV=production

# AI Configuration (Optional)
# AI_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llava:latest
# OLLAMA_TEXT_MODEL=llama3.2:latest
# OPENAI_API_KEY=your_openai_api_key_here
ENVEOF
    echo "📝 Created .env file - please edit it with your database credentials"
fi

# Create systemd service (if running as root)
if [ "$EUID" -eq 0 ] && command -v systemctl &> /dev/null; then
    echo "🔧 Creating systemd service..."
    
    # Create pictallion user
    if ! id "pictallion" &>/dev/null; then
        useradd -r -s /bin/false pictallion
    fi
    
    # Set permissions
    chown -R pictallion:pictallion .
    
    cat > /etc/systemd/system/pictallion.service << SERVICEEOF
[Unit]
Description=Pictallion Photo Management
After=network.target

[Service]
Type=simple
User=pictallion
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node start.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$(pwd)/.env

[Install]
WantedBy=multi-user.target
SERVICEEOF
    
    systemctl daemon-reload
    echo "✅ Systemd service created"
    echo "   Enable: sudo systemctl enable pictallion"
    echo "   Start:  sudo systemctl start pictallion"
    echo "   Status: sudo systemctl status pictallion"
fi

echo ""
echo "✅ Pictallion installation complete!"
echo ""
echo "🚀 Next steps:"
echo "   1. Edit .env file with your database credentials"
echo "   2. Run: node start.js"
echo "   3. Open: http://localhost:5000"
echo ""
echo "📚 For help, see README.md"
EOF

# Windows installer
cat > $BUILD_DIR/install.bat << 'EOF'
@echo off
setlocal enabledelayedexpansion

echo 🎯 Installing Pictallion Photo Management...

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is required but not installed.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION:~1%") do set MAJOR_VERSION=%%i
if %MAJOR_VERSION% lss 18 (
    echo ❌ Node.js 18+ is required. Current version: %NODE_VERSION%
    echo Please update from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js %NODE_VERSION% detected

REM Install dependencies
echo 📦 Installing dependencies...
call npm install --production
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Set up environment
echo 🔧 Setting up environment...
if not exist .env (
    echo # Database Configuration > .env
    echo # Replace with your PostgreSQL connection string >> .env
    echo DATABASE_URL=postgresql://username:password@localhost:5432/pictallion >> .env
    echo. >> .env
    echo # Server Configuration >> .env
    echo PORT=5000 >> .env
    echo NODE_ENV=production >> .env
    echo. >> .env
    echo # AI Configuration (Optional) >> .env
    echo # AI_PROVIDER=ollama >> .env
    echo # OLLAMA_BASE_URL=http://localhost:11434 >> .env
    echo # OLLAMA_MODEL=llava:latest >> .env
    echo # OLLAMA_TEXT_MODEL=llama3.2:latest >> .env
    echo # OPENAI_API_KEY=your_openai_api_key_here >> .env
    echo 📝 Created .env file - please edit it with your database credentials
)

echo.
echo ✅ Pictallion installation complete!
echo.
echo 🚀 Next steps:
echo    1. Edit .env file with your database credentials
echo    2. Run: node start.js
echo    3. Open: http://localhost:5000
echo.
echo 📚 For help, see README.md
pause
EOF

chmod +x $BUILD_DIR/install.sh

# Create README
echo "📚 Creating documentation..."
cat > $BUILD_DIR/README.md << 'EOF'
# Pictallion - AI-Powered Photo Management

A modern photo management platform with intelligent tiered processing and AI-powered metadata generation.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

🎯 **Tiered Processing System**
- Bronze → Silver → Gold workflow for photo organization
- Quality control at each processing stage

🤖 **AI-Powered Analysis**
- Support for Ollama (local) and OpenAI (cloud) providers
- Automatic tagging and metadata generation
- Object detection and confidence scoring

🏷️ **Smart Organization**
- Automated file organization by date and processing tier
- Duplicate detection and handling
- Comprehensive metadata extraction

🔍 **Advanced Search & Analytics**
- Search by content, tags, and metadata
- Processing statistics and insights
- Activity tracking and history

## System Requirements

- **Node.js**: Version 18 or higher
- **Database**: PostgreSQL (local or cloud)
- **Storage**: 1GB+ free space recommended
- **Memory**: 2GB+ RAM recommended
- **AI Processing** (Optional):
  - Ollama for local AI processing
  - OpenAI API key for cloud processing

## Quick Installation

### Windows
1. Extract the zip file
2. Run `install.bat`
3. Edit `.env` with your database credentials
4. Run `node start.js`

### Linux/macOS
1. Extract the archive: `tar -xzf pictallion.tar.gz`
2. Run: `chmod +x install.sh && ./install.sh`
3. Edit `.env` with your database credentials
4. Run: `node start.js`

### Open in Browser
Navigate to http://localhost:5000

## Configuration

### Database Setup
You need a PostgreSQL database. Options include:
- **Local**: Install PostgreSQL locally
- **Cloud**: Use Neon, Supabase, AWS RDS, etc.

Update `.env` with your connection string:
```
DATABASE_URL=postgresql://username:password@localhost:5432/pictallion
```

### AI Providers
Configure through the web interface (AI Settings):
- **Ollama**: Local processing, requires Ollama installation
- **OpenAI**: Cloud processing, requires API key
- **Both**: Ollama first, OpenAI fallback

## Usage Guide

### 1. Upload Photos
- Click "Upload" in the sidebar
- Drag and drop photos or browse to select
- Photos start in Bronze tier (raw uploads)

### 2. Process with AI
- Go to Gallery → Bronze tier
- Select photos to process
- Click "Process to Silver"
- Review and edit AI-generated metadata
- Promote to Gold when satisfied

### 3. Organize & Search
- Browse by processing tier
- Use search to find photos by content
- View detailed metadata for each photo
- Track processing history and statistics

## Directory Structure

```
pictallion/
├── server.js           # Main application
├── start.js            # Startup script
├── public/             # Web interface
├── data/               # Photo storage
│   └── media/
│       ├── bronze/     # Raw uploads
│       ├── silver/     # AI processed
│       └── gold/       # Curated photos
├── .env                # Configuration
└── README.md           # This file
```

## Advanced Configuration

### Network Access
To access from other devices on your network:
```bash
# Linux/macOS
HOST=0.0.0.0 node start.js

# Windows
set HOST=0.0.0.0 && node start.js
```
Then access via `http://YOUR_IP:5000`

### Production Deployment
For production environments:
1. Use a process manager (PM2, systemd)
2. Set up reverse proxy (nginx)
3. Configure SSL certificates
4. Set up automated database backups

### Environment Variables
```bash
# Server
PORT=5000                    # Server port
HOST=0.0.0.0                # Server host
NODE_ENV=production         # Environment

# Database
DATABASE_URL=postgresql://...  # PostgreSQL connection

# AI Configuration
AI_PROVIDER=ollama           # ollama, openai, or both
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava:latest
OLLAMA_TEXT_MODEL=llama3.2:latest
OPENAI_API_KEY=sk-...
```

## Troubleshooting

### Common Issues

**Port already in use**
```bash
PORT=3000 node start.js
```

**Database connection failed**
- Verify DATABASE_URL format
- Check database server is running
- Ensure database exists and credentials are correct

**AI processing not working**
- Check AI Settings in the web interface
- Test provider availability
- Verify Ollama is running (for local processing)
- Check OpenAI API key (for cloud processing)

**Photos not uploading**
- Ensure data/media directories exist and are writable
- Check available disk space
- Verify file permissions

### Getting Help
1. Check the browser console for errors
2. Review server logs where you started the application
3. Verify all environment variables are set correctly
4. Test AI providers in AI Settings panel

## Development

To modify or contribute:
1. Install Node.js 18+
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Make changes and test
5. Build for production: `npm run build`

## License

MIT License - See LICENSE file for details

---

**Need help?** Check the troubleshooting section above or review the configuration files.
EOF

# Create version info
echo "📄 Creating version info..."
cat > $BUILD_DIR/VERSION << EOF
Pictallion v1.0.0
Built: $(date)
Node.js: $(node --version)
Platform: $(uname -s) $(uname -m)
EOF

# Create archive
echo "📦 Creating distribution archive..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="pictallion_v1.0.0_$TIMESTAMP"

# Create tar.gz for Unix
cd $BUILD_DIR
tar -czf "../${ARCHIVE_NAME}.tar.gz" .
cd ..

# Create zip for Windows (if zip is available)
if command -v zip &> /dev/null; then
    cd $BUILD_DIR
    zip -r "../${ARCHIVE_NAME}.zip" . > /dev/null
    cd ..
    echo "✅ Created ${ARCHIVE_NAME}.zip for Windows"
fi

echo "✅ Created ${ARCHIVE_NAME}.tar.gz for Linux/macOS"

echo ""
echo "🎉 Pictallion build complete!"
echo ""
echo "📦 Distribution files:"
echo "   - ${ARCHIVE_NAME}.tar.gz (Linux/macOS)"
if command -v zip &> /dev/null; then
echo "   - ${ARCHIVE_NAME}.zip (Windows)"
fi
echo ""
echo "🚀 To distribute:"
echo "   1. Share the appropriate archive file"
echo "   2. Recipients run install.sh (Unix) or install.bat (Windows)"
echo "   3. Configure database in .env file"
echo "   4. Run: node start.js"
echo ""
echo "📍 Application will be available at http://localhost:5000"