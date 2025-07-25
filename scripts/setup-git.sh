#!/bin/bash

echo "🔧 Setting up Git repository for Pictallion..."

# Initialize git if not already done
if [ ! -d .git ]; then
    echo "📦 Initializing Git repository..."
    git init
    git branch -M main
else
    echo "✅ Git repository already initialized"
fi

# Add files to staging
echo "📝 Adding files to Git..."
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit"
else
    # Make initial commit
    echo "💾 Making initial commit..."
    git commit -m "feat: initial Pictallion photo management app

- AI-powered photo processing with Ollama and OpenAI support
- Tiered processing system (Bronze → Silver → Gold)
- Modern React/TypeScript frontend with Tailwind CSS
- Express.js backend with PostgreSQL database
- Comprehensive packaging and deployment system
- Docker support for easy deployment"
fi

echo ""
echo "🚀 Next steps to connect to GitHub:"
echo ""
echo "1. Create a new repository on GitHub:"
echo "   https://github.com/new"
echo ""
echo "2. Add your GitHub repository as remote:"
echo "   git remote add origin https://github.com/yourusername/pictallion.git"
echo ""
echo "3. Push to GitHub:"
echo "   git push -u origin main"
echo ""
echo "📚 Additional setup:"
echo "4. Create .env from template:"
echo "   cp .env.example .env"
echo "   # Then edit .env with your database credentials"
echo ""
echo "5. Set up GitHub repository settings:"
echo "   - Add repository description"
echo "   - Add topics: photo-management, ai, typescript, react"
echo "   - Enable Issues and Discussions"
echo "   - Set up branch protection rules"
echo ""
echo "✅ Git setup complete!"