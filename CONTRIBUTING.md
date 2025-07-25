# Contributing to Pictallion

Thank you for your interest in contributing to Pictallion! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- Git
- PostgreSQL (local or cloud)
- Code editor (VS Code recommended)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/pictallion.git
   cd pictallion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 📝 Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Use ESLint and Prettier for formatting
- Write meaningful commit messages

### Project Structure

- `client/` - React frontend code
- `server/` - Express.js backend code
- `shared/` - Shared TypeScript types
- `scripts/` - Build and deployment scripts

### Database Changes

- Use Drizzle ORM for database operations
- Add migrations in `shared/schema.ts`
- Run `npm run db:push` to apply changes

### AI Integration

- Support both Ollama and OpenAI providers
- Handle provider failures gracefully
- Test with mock responses when providers unavailable

## 🐛 Bug Reports

When reporting bugs, please include:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node.js version, etc.)
- Screenshots if applicable
- Error messages and logs

## ✨ Feature Requests

For new features:

- Describe the use case and benefits
- Consider backward compatibility
- Discuss implementation approach
- Include mockups or examples if helpful

## 🔄 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add tests if applicable
   - Update documentation

3. **Test thoroughly**
   ```bash
   npm run check  # Type checking
   npm run dev    # Manual testing
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add photo batch processing"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format

Use conventional commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build/tooling changes

## 🧪 Testing

### Manual Testing Checklist

- [ ] Photo upload works correctly
- [ ] AI processing functions (with mock or real providers)
- [ ] Photo promotion between tiers works
- [ ] Search and filtering works
- [ ] Settings can be saved and loaded
- [ ] Error handling works gracefully

### Browser Testing

Test in major browsers:
- Chrome/Chromium
- Firefox
- Safari (if on macOS)
- Edge

## 📚 Documentation

When adding features:

- Update README.md if needed
- Add inline code comments
- Update API documentation
- Include usage examples

## 🔒 Security

- Never commit API keys or secrets
- Use environment variables for configuration
- Validate all user inputs
- Follow secure coding practices
- Report security issues privately

## 💡 Ideas for Contributions

### Good First Issues

- UI improvements and polish
- Documentation updates
- Error message improvements
- Additional file format support
- Performance optimizations

### Advanced Features

- Additional AI providers
- Advanced search filters
- Photo editing capabilities
- Batch operations
- Export/import features
- Mobile app companion

## 🤝 Community

### Code of Conduct

- Be respectful and inclusive
- Help others learn and grow
- Focus on constructive feedback
- Celebrate diverse perspectives

### Getting Help

- Check existing issues and discussions
- Ask questions in GitHub Discussions
- Be specific about your environment and setup
- Provide minimal reproducible examples

## 📋 Release Process

For maintainers:

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release tag
4. Build and test distribution packages
5. Publish release notes

## 🙏 Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes for significant contributions
- Optional mentions in documentation

Thank you for helping make Pictallion better for everyone!