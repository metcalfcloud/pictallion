#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const BUILD_DIR = 'dist';
const PUBLIC_DIR = path.join(BUILD_DIR, 'public');
const SERVER_DIR = path.join(BUILD_DIR, 'server');

async function clean() {
  console.log('🧹 Cleaning previous build...');
  try {
    await fs.rm(BUILD_DIR, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist
  }
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.mkdir(SERVER_DIR, { recursive: true });
}

async function buildClient() {
  console.log('🏗️  Building client...');
  execSync('npm run build:client', { stdio: 'inherit' });
  
  // Move client build to public directory
  await fs.cp('client/dist', PUBLIC_DIR, { recursive: true });
}

async function buildServer() {
  console.log('🚀 Building server...');
  execSync('npm run build:server', { stdio: 'inherit' });
}

async function copyAssets() {
  console.log('📦 Copying assets...');
  
  // Copy server files
  const serverFiles = [
    'package.json',
    'package-lock.json',
    'drizzle.config.ts',
    'shared'
  ];
  
  for (const file of serverFiles) {
    const src = path.resolve(file);
    const dest = path.join(BUILD_DIR, file);
    
    try {
      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await fs.cp(src, dest, { recursive: true });
      } else {
        await fs.copyFile(src, dest);
      }
    } catch (error) {
      console.warn(`Warning: Could not copy ${file}:`, error.message);
    }
  }
  
  // Create data directories
  const dataDir = path.join(BUILD_DIR, 'data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'media', 'bronze'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'media', 'silver'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'media', 'gold'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'media', 'dropzone'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'media', 'archive'), { recursive: true });
  
  // Create startup script
  const startScript = `#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎯 Starting Pictallion...');
console.log('📍 Open http://localhost:5000 in your browser');

const server = spawn('node', [join(__dirname, 'server', 'index.js')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

server.on('close', (code) => {
  console.log(\`Server exited with code \${code}\`);
});

process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down Pictallion...');
  server.kill();
  process.exit(0);
});
`;

  await fs.writeFile(path.join(BUILD_DIR, 'start.js'), startScript);
  
  // Make it executable on Unix systems
  try {
    await fs.chmod(path.join(BUILD_DIR, 'start.js'), 0o755);
  } catch (error) {
    // Windows doesn't support chmod
  }
}

async function createInstallScripts() {
  console.log('📋 Creating install scripts...');
  
  // Linux/macOS install script
  const unixInstall = `#!/bin/bash
set -e

echo "🎯 Installing Pictallion..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Set up database
echo "🗄️  Setting up database..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL not set. Please configure your database connection."
fi

# Create systemd service (optional)
if command -v systemctl &> /dev/null && [ "$EUID" -eq 0 ]; then
    echo "🔧 Creating systemd service..."
    cat > /etc/systemd/system/pictallion.service << EOF
[Unit]
Description=Pictallion Photo Management
After=network.target

[Service]
Type=simple
User=pictallion
WorkingDirectory=$(pwd)
ExecStart=$(which node) start.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    echo "✅ Systemd service created. Enable with: sudo systemctl enable pictallion"
fi

echo "✅ Installation complete!"
echo "🚀 Start Pictallion with: node start.js"
echo "🌐 Then open http://localhost:5000 in your browser"
`;

  // Windows install script
  const windowsInstall = `@echo off
setlocal enabledelayedexpansion

echo 🎯 Installing Pictallion...

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js is required but not installed.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm ci --production
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Set up database
echo 🗄️ Setting up database...
if "%DATABASE_URL%"=="" (
    echo ⚠️ Warning: DATABASE_URL not set. Please configure your database connection.
)

echo ✅ Installation complete!
echo 🚀 Start Pictallion with: node start.js
echo 🌐 Then open http://localhost:5000 in your browser
pause
`;

  await fs.writeFile(path.join(BUILD_DIR, 'install.sh'), unixInstall);
  await fs.writeFile(path.join(BUILD_DIR, 'install.bat'), windowsInstall);
  
  // Make Unix script executable
  try {
    await fs.chmod(path.join(BUILD_DIR, 'install.sh'), 0o755);
  } catch (error) {
    // Windows doesn't support chmod
  }
}

async function createDocumentation() {
  console.log('📚 Creating documentation...');
  
  const readme = `# Pictallion - Photo Management Application

A modern AI-powered photo management platform with intelligent tiered processing.

## Features

- 🎯 **Tiered Processing**: Bronze → Silver → Gold workflow for photo organization
- 🤖 **AI Analysis**: Support for both Ollama (local) and OpenAI (cloud) processing
- 🏷️ **Smart Tagging**: Automatic tag generation and metadata extraction
- 🔍 **Advanced Search**: Find photos by content, tags, and metadata
- 📊 **Analytics**: Track your photo collection growth and processing status

## System Requirements

- **Node.js**: Version 18 or higher
- **Database**: PostgreSQL (local or cloud)
- **Storage**: 1GB+ free space for photo storage
- **Memory**: 2GB+ RAM recommended
- **AI Processing** (Optional):
  - **Ollama**: For local AI processing
  - **OpenAI API Key**: For cloud AI processing

## Quick Start

### 1. Install Dependencies
\`\`\`bash
# Linux/macOS
chmod +x install.sh
./install.sh

# Windows
install.bat
\`\`\`

### 2. Configure Environment
Create a \`.env\` file with your database connection:
\`\`\`
DATABASE_URL=postgresql://username:password@localhost:5432/pictallion
\`\`\`

### 3. Start the Application
\`\`\`bash
node start.js
\`\`\`

### 4. Open in Browser
Navigate to http://localhost:5000

## Configuration

### Database Setup
Pictallion requires a PostgreSQL database. You can use:
- Local PostgreSQL installation
- Cloud providers (Neon, Supabase, AWS RDS, etc.)

### AI Providers
Configure AI processing through the web interface:
- **Ollama**: Install locally for private processing
- **OpenAI**: Add API key for cloud processing
- **Both**: Use Ollama with OpenAI fallback

## Directory Structure

\`\`\`
pictallion/
├── server/           # Backend API
├── public/           # Frontend assets
├── data/             # Photo storage
│   └── media/
│       ├── bronze/   # Raw uploads
│       ├── silver/   # AI processed
│       └── gold/     # Curated photos
├── shared/           # Shared types
├── start.js          # Application startup
└── install.sh/.bat   # Installation scripts
\`\`\`

## Usage

### Upload Photos
1. Click "Upload" in the sidebar
2. Drag and drop or select photos
3. Photos appear in Bronze tier

### Process with AI
1. Go to Gallery → Bronze tier
2. Select photos to process
3. Click "Process to Silver"
4. Review AI-generated metadata
5. Promote to Gold when satisfied

### Configure AI
1. Click "AI Settings" in sidebar
2. Test provider availability
3. Configure preferred models
4. Save settings

## Deployment

### Local Network Access
To access from other devices on your network:
1. Find your local IP address
2. Start with: \`NODE_ENV=production HOST=0.0.0.0 node start.js\`
3. Access via \`http://YOUR_IP:5000\`

### Production Deployment
For production environments:
1. Use a process manager (PM2, systemd)
2. Set up reverse proxy (nginx)
3. Configure SSL certificates
4. Set up database backups

## Troubleshooting

### Common Issues
- **Port already in use**: Change port with \`PORT=3000 node start.js\`
- **Database connection**: Verify DATABASE_URL format and credentials
- **AI not working**: Check provider configuration in AI Settings
- **Photos not uploading**: Ensure data/media directories are writable

### Support
- Check logs in the console where you started the application
- Verify all environment variables are set correctly
- Test AI providers in the AI Settings panel

## Development

To modify or contribute to Pictallion:
1. Clone the source repository
2. Install dependencies: \`npm install\`
3. Start development server: \`npm run dev\`
4. Make changes and test
5. Build for production: \`npm run build\`

## License

MIT License - See LICENSE file for details
`;

  await fs.writeFile(path.join(BUILD_DIR, 'README.md'), readme);
}

async function main() {
  try {
    await clean();
    await buildClient();
    await buildServer();
    await copyAssets();
    await createInstallScripts();
    await createDocumentation();
    
    console.log('✅ Build complete!');
    console.log(`📦 Packaged application available in: ${BUILD_DIR}`);
    console.log('🚀 To distribute: zip the dist folder and share');
    console.log('📋 Recipients can run install.sh (Linux/Mac) or install.bat (Windows)');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

main();