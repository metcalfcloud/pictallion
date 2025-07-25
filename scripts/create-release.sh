#!/bin/bash
set -e

echo "🏷️  Creating new Pictallion release..."

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're not on the main branch (currently on: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current version or default to 1.0.0
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo "📋 Current version: $CURRENT_VERSION"

# Remove 'v' prefix for processing
CURRENT_VERSION_NUM=${CURRENT_VERSION#v}

# Parse version components
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION_NUM"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

echo ""
echo "🎯 Release type:"
echo "1) Patch (bug fixes): v$MAJOR.$MINOR.$((PATCH + 1))"
echo "2) Minor (new features): v$MAJOR.$((MINOR + 1)).0"
echo "3) Major (breaking changes): v$((MAJOR + 1)).0.0"
echo "4) Custom version"

read -p "Select release type (1-4): " -n 1 -r RELEASE_TYPE
echo

case $RELEASE_TYPE in
    1)
        NEW_VERSION="v$MAJOR.$MINOR.$((PATCH + 1))"
        ;;
    2)
        NEW_VERSION="v$MAJOR.$((MINOR + 1)).0"
        ;;
    3)
        NEW_VERSION="v$((MAJOR + 1)).0.0"
        ;;
    4)
        read -p "Enter custom version (e.g., v1.2.3): " NEW_VERSION
        if [[ ! $NEW_VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
            echo "❌ Invalid version format. Use vX.Y.Z or vX.Y.Z-suffix"
            exit 1
        fi
        ;;
    *)
        echo "❌ Invalid selection"
        exit 1
        ;;
esac

echo "🏷️  New version will be: $NEW_VERSION"

# Ask for release notes
echo ""
echo "📝 Release notes (press Ctrl+D when done):"
echo "Enter the main changes for this release:"
RELEASE_NOTES=$(cat)

# Confirm release
echo ""
echo "📋 Release Summary:"
echo "   Version: $NEW_VERSION"
echo "   Branch: $CURRENT_BRANCH"
echo "   Release Notes:"
echo "$RELEASE_NOTES" | sed 's/^/     /'
echo ""

read -p "Create this release? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    exit 1
fi

# Update version in package.json if it exists
if [ -f package.json ]; then
    echo "📦 Updating package.json version..."
    NEW_VERSION_NUM=${NEW_VERSION#v}
    # Use a more portable way to update JSON
    if command -v jq &> /dev/null; then
        jq ".version = \"$NEW_VERSION_NUM\"" package.json > package.json.tmp
        mv package.json.tmp package.json
    else
        # Fallback using sed (less reliable but more portable)
        sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION_NUM\"/" package.json
        rm -f package.json.bak
    fi
fi

# Create CHANGELOG entry
echo "📚 Updating CHANGELOG.md..."
if [ ! -f CHANGELOG.md ]; then
    cat > CHANGELOG.md << EOF
# Changelog

All notable changes to Pictallion will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF
fi

# Create temporary changelog entry
TEMP_CHANGELOG=$(mktemp)
cat > "$TEMP_CHANGELOG" << EOF
## [$NEW_VERSION] - $(date +%Y-%m-%d)

$RELEASE_NOTES

EOF

# Prepend to existing changelog
if grep -q "## \[" CHANGELOG.md; then
    # Insert after the header
    sed '/^# Changelog/,/^$/{ /^$/r '"$TEMP_CHANGELOG"'
    }' CHANGELOG.md > CHANGELOG.md.tmp
    mv CHANGELOG.md.tmp CHANGELOG.md
else
    # No existing entries, append after header
    cat CHANGELOG.md "$TEMP_CHANGELOG" > CHANGELOG.md.tmp
    mv CHANGELOG.md.tmp CHANGELOG.md
fi

rm "$TEMP_CHANGELOG"

# Commit changes
echo "💾 Committing version changes..."
git add .
git commit -m "chore: bump version to $NEW_VERSION

$RELEASE_NOTES"

# Create and push tag
echo "🏷️  Creating git tag..."
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION

$RELEASE_NOTES"

echo "📤 Pushing to origin..."
git push origin "$CURRENT_BRANCH"
git push origin "$NEW_VERSION"

echo ""
echo "✅ Release $NEW_VERSION created successfully!"
echo ""
echo "🚀 The GitHub Actions workflow will now:"
echo "   • Run tests and build the application"
echo "   • Create distribution packages for Windows, macOS, and Linux"
echo "   • Build and publish Docker images"
echo "   • Create a GitHub release with all assets"
echo ""
echo "📍 Track progress at:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
echo ""
echo "🎉 Your release will be available at:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases"