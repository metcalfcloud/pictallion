#!/bin/bash
set -e

echo "🐳 Setting up Pictallion web frontend with Docker..."

# Change to docker directory
cd docker

# Build and start the web frontend
echo "🚀 Building and starting web frontend..."
docker-compose up -d --build

echo ""
echo "✅ Pictallion web frontend is now running!"
echo ""
echo "🌐 Access the application at: http://localhost:8080"
echo ""
echo "🔧 Useful commands:"
echo "   View logs:    docker-compose logs -f pictallion-web"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart pictallion-web"
echo "   Update:       docker-compose pull && docker-compose up -d"
echo ""
echo "ℹ️  Note: This is the web frontend only. For the full desktop application,"
echo "   use the Tauri builds available in the releases."
