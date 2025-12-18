# Troubleshooting Guide

This guide helps identify and resolve common issues when building applications with SalesPro Web.

## Quick Diagnostic Commands

### Check Project Health

```bash
# Check if all services are running
pnpm dev

# Verify all tests pass
pnpm test

# Check for linting issues
pnpm lint

# Verify TypeScript compilation
pnpm typecheck

# Check build process
pnpm build
```

### Check Environment Setup

```bash
# Verify Node.js version
node --version  # Should be >= 20.11.0

# Verify pnpm version
pnpm --version  # Should be >= 10.18.1

# Check if environment files exist
ls -la apps/api/.env
ls -la apps/web/.env
```

## Common Issues and Solutions

### 1. Development Server Issues

#### "Port already in use" Error

**Symptoms**: Error message about port being in use
**Causes**: Another process using the same port
**Solutions**:

```bash
# Find process using the port
lsof -i :4000  # For API port
lsof -i :5173  # For web port

# Kill the process
kill -9 <PID>

# Or change ports in .env files
# apps/api/.env: PORT=4001
# apps/web/.env: VITE_API_BASE="http://localhost:4001/api"
```

#### "Cannot find module" Errors

**Symptoms**: Module not found errors during development
**Causes**: Missing dependencies or incorrect imports
**Solutions**:

```bash
# Reinstall dependencies
pnpm install

# Clear node_modules and reinstall
rm -rf node_modules
pnpm install

# Check import paths
# Use @shared/* for shared packages
# Use relative paths for local imports
```

#### Hot Reload Not Working

**Symptoms**: Changes not reflecting in browser
**Causes**: File watching issues or cache problems
**Solutions**:

```bash
# Restart development server
pnpm dev

# Clear Vite cache
rm -rf apps/web/dist
rm -rf apps/web/node_modules/.vite

# Check file permissions
ls -la apps/web/src/
```

### 2. Database Connection Issues

#### "PostgreSQL connection failed"

**Symptoms**: Database connection errors in API
**Causes**: PostgreSQL not running or incorrect connection string
**Solutions**:

**Local PostgreSQL**:

```bash
# Start PostgreSQL service
brew services start postgresql@16  # macOS
sudo systemctl start postgresql    # Linux

# Check if PostgreSQL is running
pg_isready
```

**Docker PostgreSQL**:

```bash
# Start PostgreSQL via Docker
docker-compose -f docker-compose.dev.yml up -d postgres

# Check container status
docker-compose ps postgres
```

**Connection String Issues**:

```bash
# Check connection string in apps/api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salespro_dev"

# Test connection
psql "postgresql://postgres:postgres@localhost:5432/salespro_dev" -c "SELECT 1"
```

#### "Database timeout" Errors

**Symptoms**: Slow queries or connection timeouts
**Causes**: Database performance issues or network problems
**Solutions**:

```bash
# Check database connectivity
pg_isready -h localhost -p 5432

# Check connection pool settings in MikroORM config
# In apps/api/mikro-orm.config.ts, adjust pool options
```

### 3. Build and Compilation Issues

#### TypeScript Compilation Errors

**Symptoms**: TypeScript errors during build
**Causes**: Type mismatches or missing type definitions
**Solutions**:

**Common TypeScript Issues**:

```typescript
// ❌ Avoid 'any' type (forbidden)
const data: any = response.data;

// ✅ Use proper typing
const data: User = response.data;

// ❌ Missing return type
function getUser(id: string) {
  return User.findById(id);
}

// ✅ Explicit return type
function getUser(id: string): Promise<User | null> {
  return User.findById(id);
}
```

**Fix TypeScript Errors**:

```bash
# Check specific TypeScript errors
pnpm typecheck

# Fix import issues
# Use type imports for types
import type { User } from '@shared/types';

# Use value imports for functions
import { validateUser } from '@shared/zod';
```

#### Build Failures

**Symptoms**: Build process fails with errors
**Causes**: Missing dependencies or configuration issues
**Solutions**:

```bash
# Clean build artifacts
rm -rf apps/*/dist
rm -rf packages/*/dist

# Rebuild everything
pnpm build

# Check for missing dependencies
pnpm install

# Verify all packages build individually
pnpm --filter api build
pnpm --filter web build
pnpm --filter shared build
```

### 4. Testing Issues

#### Test Failures

**Symptoms**: Tests failing unexpectedly
**Causes**: Test setup issues or code changes
**Solutions**:

**Check Test Setup**:

```bash
# Run tests with verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test apps/api/src/__tests__/users.test.ts

# Check test environment
# Verify test database connection
# Check mock configurations
```

**Common Test Issues**:

```typescript
// ❌ Tests not isolated
describe('User API', () => {
  // Tests share state
});

// ✅ Proper test isolation
describe('User API', () => {
  beforeEach(() => {
    // Setup fresh state for each test
  });

  afterEach(() => {
    // Clean up after each test
  });
});
```

#### Integration Test Failures

**Symptoms**: Integration tests failing
**Causes**: Database or external service issues
**Solutions**:

```bash
# Run integration tests separately
pnpm test:integration

# Check test database setup
# Verify PostgreSQL test container is running
docker-compose -f docker-compose.test.yml up -d postgres-test

# Check test environment variables
cat apps/api/.env.test
```

### 5. Frontend Issues

#### React Component Errors

**Symptoms**: Components not rendering or throwing errors
**Causes**: Props mismatches or state issues
**Solutions**:

**Check Component Props**:

```typescript
// ❌ Missing required props
<UserCard user={user} />  // Missing onEdit prop

// ✅ Provide all required props
<UserCard user={user} onEdit={handleEdit} />
```

**Check State Management**:

```typescript
// ❌ State not properly initialized
const [users, setUsers] = useState();

// ✅ Proper state initialization
const [users, setUsers] = useState<User[]>([]);
```

#### API Integration Issues

**Symptoms**: Frontend not receiving data from API
**Causes**: API endpoint issues or CORS problems
**Solutions**:

**Check API Endpoints**:

```bash
# Test API endpoints directly
curl http://localhost:4000/api/healthz
curl http://localhost:4000/api/users

# Check API logs
# Look for request/response logs in terminal
```

**Check CORS Configuration**:

```typescript
// In apps/api/src/server.ts
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
```

### 6. Environment and Configuration Issues

#### Environment Variables Not Loading

**Symptoms**: Undefined environment variables
**Causes**: Missing .env files or incorrect variable names
**Solutions**:

**Check .env Files**:

```bash
# Verify .env files exist
ls -la apps/api/.env
ls -la apps/web/.env

# Check file contents
cat apps/api/.env
cat apps/web/.env
```

**Common Environment Issues**:

```bash
# ❌ Missing required variables
DATABASE_URL=  # Empty value

# ✅ Proper environment setup
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salespro_dev"
PORT=4000
NODE_ENV=development
SESSION_SECRET="your-session-secret-change-in-production"
```

#### Path Alias Issues

**Symptoms**: Import errors with @shared/\* paths
**Causes**: TypeScript path mapping issues
**Solutions**:

**Check TypeScript Configuration**:

```json
// tsconfig.json (or tsconfig.base.json)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/core": ["packages/shared/src/index.ts"],
      "@shared/*": ["packages/shared/src/*"]
    }
  }
}
```

**Verify Package Structure**:

```bash
# Check if shared package builds
pnpm --filter @shared/core build

# Check if shared package typechecks
pnpm --filter @shared/core typecheck

# Verify the dependency is installed in consuming apps
# Check apps/web/package.json or apps/api/package.json for:
# "@shared/core": "workspace:*"
```

### Shared Package Issues

#### "Cannot find module '@shared/core'"

**Symptoms**: Import errors when importing from `@shared/core`
**Causes**: Missing dependency or build not run
**Solutions**:

```bash
# 1. Ensure the dependency is in package.json
cd apps/web  # or apps/api
pnpm add '@shared/core@workspace:*'

# 2. Build the shared package
pnpm --filter @shared/core build

# 3. Reinstall dependencies
pnpm install
```

#### "Type not exported from '@shared/core'"

**Symptoms**: Type import fails even though it's defined
**Causes**: Type not exported from index.ts or package not rebuilt
**Solutions**:

```bash
# 1. Check the type is exported in packages/shared/src/types/index.ts
# 2. Rebuild the shared package
pnpm --filter @shared/core build

# 3. Restart TypeScript server in IDE
# In VS Code: Cmd+Shift+P > "TypeScript: Restart TS Server"
```

### 7. Performance Issues

#### Slow Development Server

**Symptoms**: Hot reload takes too long
**Causes**: Large codebase or inefficient file watching
**Solutions**:

```bash
# Check file watching limits
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Exclude unnecessary directories from watching
# Check vite.config.ts for exclude patterns
```

#### Slow Build Process

**Symptoms**: Build takes too long
**Causes**: Inefficient build configuration or dependencies
**Solutions**:

```bash
# Use build caching
pnpm build --cache

# Check for unnecessary dependencies
pnpm list --depth=0

# Optimize build configuration
# Check turbo.json for build optimization
```

### 8. Docker Issues

#### Container Build Failures

**Symptoms**: Docker build fails
**Causes**: Missing dependencies or incorrect Dockerfile
**Solutions**:

```bash
# Check Dockerfile syntax
docker build -t salespro-api apps/api/

# Check for missing dependencies
# Verify all dependencies are in package.json
```

#### Container Runtime Issues

**Symptoms**: Containers not starting or crashing
**Causes**: Environment variables or port conflicts
**Solutions**:

```bash
# Check container logs
docker compose logs api
docker compose logs web

# Verify environment variables
docker compose config

# Check port conflicts
```

## Debugging Tools

### 1. Logging and Monitoring

```bash
# Enable debug logging
DEBUG=* pnpm dev

# Check structured logs
# Look for request/response logs in API
# Check browser console for frontend errors
```

### 2. Database Debugging

```bash
# Connect to PostgreSQL directly
psql "postgresql://postgres:postgres@localhost:5432/salespro_dev"

# Check tables and data
\dt                    # List tables
SELECT * FROM "user";  # Query users table

# Check database info
\conninfo              # Connection info
```

### 3. Network Debugging

```bash
# Check API endpoints
curl -v http://localhost:4000/api/healthz

# Check CORS headers
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:4000/api/users
```

### 4. Frontend Debugging

```bash
# Check browser developer tools
# Network tab for API calls
# Console tab for JavaScript errors
# Application tab for local storage

# Check React DevTools
# Component tree and props
# State and hooks debugging
```

## Prevention Strategies

### 1. Regular Maintenance

```bash
# Update dependencies regularly
pnpm update

# Check for security vulnerabilities
pnpm audit

# Run tests before committing
pnpm test
```

### 2. Code Quality Checks

```bash
# Run linting before commits
pnpm lint

# Check TypeScript before commits
pnpm typecheck

# Run tests before commits
pnpm test
```

### 3. Environment Management

```bash
# Use consistent environment setup
# Document all required environment variables
# Use .env.example files for reference
```

## Getting Help

### 1. Check Documentation

- README.md for setup instructions
- docs/ARCHITECTURE.md for system design
- docs/DEVELOPMENT.md for development patterns
- docs/AI_DEVELOPMENT.md for AI agent guidance

### 2. Check Logs

- API logs in terminal
- Browser console for frontend errors
- Database logs for connection issues

### 3. Common Solutions

- Restart development server
- Clear caches and rebuild
- Check environment variables
- Verify all dependencies are installed

### 4. When to Ask for Help

- Error persists after trying common solutions
- Unclear error messages
- Performance issues that can't be resolved
- Security concerns

This troubleshooting guide should help resolve most common issues when building applications with SalesPro Web.
