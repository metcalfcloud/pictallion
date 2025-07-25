#!/bin/bash
VERSION=${GITHUB_REF#refs/tags/}
echo "VERSION=$VERSION" >> $GITHUB_OUTPUT

# Generate changelog since last tag
PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
if [ -n "$PREVIOUS_TAG" ]; then
  CHANGELOG=$(git log $PREVIOUS_TAG..HEAD --pretty=format:"- %s (%h)" --no-merges)
else
  CHANGELOG=$(git log --pretty=format:"- %s (%h)" --no-merges)
fi

# Create release notes
cat > release_notes.md << EOF
# Pictallion $VERSION

## 🎯 What's New

$CHANGELOG

## 📦 Installation

### Quick Install (Recommended)

**Linux/macOS:**
\`\`\`bash
wget https://github.com/${{ github.repository }}/releases/download/$VERSION/pictallion-$VERSION-linux.tar.gz
tar -xzf pictallion-$VERSION-linux.tar.gz
cd dist && ./install.sh
\`\`\`

**Windows:**
1. Download \`pictallion-$VERSION-windows.zip\`
2. Extract the archive
3. Run \`install.bat\`
4. Follow the setup instructions

### Docker Installation
\`\`\`bash
docker run -d \\
  --name pictallion \\
  -p 5000:5000 \\
  -v pictallion_data:/app/data \\
  -e DATABASE_URL=your_database_url \\
  ghcr.io/${{ github.repository }}:$VERSION
\`\`\`

## 🔧 Configuration

1. Set up your PostgreSQL database
2. Configure AI providers (Ollama or OpenAI)
3. Start the application: \`node start.js\`
4. Open http://localhost:5000

## 🆕 Features in this Release

- AI-powered photo analysis with Ollama and OpenAI support
- Tiered processing system (Bronze → Silver → Gold)
- Advanced search and filtering capabilities
- Modern React interface with dark mode support
- Comprehensive deployment options

## 🐛 Bug Fixes & Improvements

See the full changelog above for all changes in this release.

## 📚 Documentation

- [Installation Guide](https://github.com/${{ github.repository }}#-quick-start)
- [Deployment Guide](https://github.com/${{ github.repository }}/blob/main/DEPLOYMENT.md)
- [Contributing](https://github.com/${{ github.repository }}/blob/main/CONTRIBUTING.md)

## 🙏 Contributors

Thank you to everyone who contributed to this release!
EOF