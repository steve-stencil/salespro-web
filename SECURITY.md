# Security Policy

## Supported Versions

We actively maintain security for the following versions:

| Version | Supported  |
| ------- | ---------- |
| Node.js | >= 20.11.0 |
| pnpm    | >= 10.18.1 |

## Security Best Practices

### Environment Variables

- **Never commit secrets**: All sensitive data must be stored in environment variables
- **Use `.env` files**: Keep environment files local and gitignored
- **Validate environment variables**: Use Zod schemas to validate required environment variables
- **Document required variables**: All environment variables must be documented in README.md

### API Security

- **Input validation**: All request bodies must be validated with Zod schemas
- **Error handling**: Never expose stack traces or sensitive information in error responses
- **CORS configuration**: Properly configure CORS for your domain
- **Helmet middleware**: Use Helmet for security headers
- **Rate limiting**: Consider implementing rate limiting for production use

### Database Security

- **Connection strings**: Use secure PostgreSQL connection strings with SSL in production
- **Environment isolation**: Use different databases for development, staging, and production
- **Data validation**: Validate all data before database operations
- **Query sanitization**: Use MikroORM's parameterized queries to prevent SQL injection

### Frontend Security

- **API base URL**: Use environment variables for API endpoints
- **Content Security Policy**: Implement CSP headers
- **XSS prevention**: Sanitize user inputs and use React's built-in XSS protection
- **HTTPS**: Always use HTTPS in production

### Dependencies

- **Regular updates**: Keep all dependencies updated
- **Security audits**: Run `pnpm audit` regularly
- **Vulnerability scanning**: Use tools like `npm audit` or `pnpm audit`
- **Lock files**: Commit lock files to ensure consistent dependency versions

## Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

1. **DO NOT** create a public GitHub issue
2. **DO NOT** disclose the vulnerability publicly
3. **Email us** at: [security@yourdomain.com] (replace with actual contact)
4. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 7 days
- **Resolution**: Within 30 days (depending on severity)

## Security Checklist for New Projects

When using this skeleton for a new project:

- [ ] Change default database names
- [ ] Update CORS origins
- [ ] Set strong JWT secrets (if using authentication)
- [ ] Configure proper environment variables
- [ ] Set up HTTPS in production
- [ ] Implement rate limiting
- [ ] Set up monitoring and logging
- [ ] Review and update dependencies
- [ ] Configure security headers
- [ ] Set up automated security scanning

## Security Dependencies

This project includes the following security-focused dependencies:

- **Helmet**: Security headers middleware
- **CORS**: Cross-origin resource sharing
- **Zod**: Runtime type validation
- **MikroORM**: PostgreSQL ORM with parameterized queries
- **Argon2**: Secure password hashing

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [React Security Best Practices](https://react.dev/learn/security)
- [PostgreSQL Security Documentation](https://www.postgresql.org/docs/current/security.html)

## Contact

For security-related questions or to report vulnerabilities, please contact us at [security@yourdomain.com].

---

**Note**: This is a skeleton project. When using this for production applications, ensure you implement additional security measures appropriate for your specific use case and data sensitivity.
