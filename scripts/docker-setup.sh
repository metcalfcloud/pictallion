#!/bin/bash
set -e

echo "🐳 Setting up Pictallion with Docker..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
# Database Configuration
DATABASE_URL=postgresql://pictallion:pictallion_password_change_me@postgres:5432/pictallion

# AI Configuration
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llava:latest
OLLAMA_TEXT_MODEL=llama3.2:latest

# OpenAI (optional)
# OPENAI_API_KEY=your_openai_api_key_here
ENVEOF
    echo "📝 Created .env file"
fi

# Build and start services
echo "🚀 Building and starting services..."
docker compose up -d --build

# Wait for ollama to be ready
echo "⏳ Waiting for Ollama to start..."
sleep 10

# Pull required models
echo "📥 Pulling AI models..."
docker compose exec ollama ollama pull llava:latest
docker compose exec ollama ollama pull llama3.2:latest

echo ""
echo "✅ Pictallion is now running!"
echo ""
echo "🌐 Access the application at: http://localhost:5000"
echo "🤖 Ollama API at: http://localhost:11434"
echo ""
echo "🔧 Useful commands:"
echo "   View logs:    docker compose logs -f pictallion"
echo "   Stop:         docker compose down"
echo "   Restart:      docker compose restart pictallion"
echo "   Update:       docker compose pull && docker compose up -d"
