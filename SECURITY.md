# Security Policy

## Supported Versions

We provide security updates for the following versions of Pictallion:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Pictallion, please report it responsibly:

### Private Disclosure

**Do NOT** open a public GitHub issue for security vulnerabilities.

Instead, please:

1. **Email**: Send details to security@pictallion.com
2. **GitHub**: Use [private vulnerability reporting](https://github.com/yourusername/pictallion/security/advisories/new)

### What to Include

Please provide:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if known)
- Your contact information

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Development**: 2-4 weeks (depending on severity)
- **Public Disclosure**: After fix is released

## Security Measures

### Application Security

#### Authentication & Authorization
- Session-based authentication with secure cookies
- CSRF protection on all state-changing operations
- Proper session management and logout functionality

#### Input Validation
- All user inputs validated using Zod schemas
- File upload restrictions (type, size, content validation)
- SQL injection prevention through parameterized queries
- XSS protection through proper encoding

#### File Security
- File uploads restricted to supported image formats
- Content-type validation beyond file extensions
- File size limits enforced (50MB default)
- Files stored outside web root directory
- Proper file permissions and access controls

#### API Security
- Rate limiting on all endpoints
- Proper error handling without information leakage
- Secure headers configured
- HTTPS enforcement in production

### Infrastructure Security

#### Database Security
- PostgreSQL with SSL connections
- Environment variable configuration for credentials
- Regular security updates
- Connection pooling with proper timeouts

#### Container Security
- Multi-stage Docker builds with minimal base images
- Non-root user execution
- Security scanning in CI/CD pipeline
- Regular base image updates

### Development Security

#### Dependency Management
- Regular security audits with `npm audit`
- Automated dependency updates via GitHub Actions
- Known vulnerability scanning with Snyk
- Minimal dependency principle

#### Code Security
- Static code analysis with CodeQL
- TypeScript for type safety
- ESLint security rules
- Regular security code reviews

### Deployment Security

#### Environment Security
- Environment variables for all sensitive configuration
- No hardcoded secrets in codebase
- Proper secret management in deployment environments
- SSL/TLS encryption for all communications

#### Monitoring
- Application logging for security events
- Failed authentication attempt tracking
- File upload monitoring
- Error tracking and alerting

## Security Best Practices for Users

### Installation Security
- Always download from official releases
- Verify checksums when provided
- Use strong database passwords
- Keep system dependencies updated

### Configuration Security
- Use environment variables for sensitive data
- Enable HTTPS in production deployments
- Configure firewall rules appropriately
- Regular security updates

### Operational Security
- Regular database backups
- Log monitoring and retention
- Access control for admin functions
- Regular security assessments

## Known Security Considerations

### Current Limitations
- Single-user authentication model (suitable for personal/small team use)
- Local file storage (ensure proper backup and access controls)
- AI provider API key management (secure environment variable storage required)

### Recommended Mitigations
- Deploy behind reverse proxy with additional security headers
- Use managed database services for production
- Implement additional monitoring and alerting
- Regular security assessment and updates

## Security Updates

Security updates are released as:
- **Critical**: Immediate patch releases
- **High**: Within 1-2 weeks
- **Moderate**: In next regular release
- **Low**: Addressed in future releases

Subscribe to our releases to stay informed about security updates:
- Watch this repository for releases
- Follow our security advisories
- Check the changelog for security-related changes

## Contact Information

- **Security Email**: security@pictallion.com
- **General Issues**: [GitHub Issues](https://github.com/yourusername/pictallion/issues)
- **Private Reports**: [GitHub Security Advisories](https://github.com/yourusername/pictallion/security/advisories)

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve Pictallion's security.

---

This security policy is regularly updated. Last updated: January 2025