# Docker Setup for SalesPro Web

This document explains the Docker setup for SalesPro Web, including development, testing, and production environments.

## 🐳 Docker Services

### Production Services

- **`postgres`** - Production PostgreSQL (port 5432)
- **`api`** - Production API server (port 4000)
- **`web`** - Production web app (port 5173)

### Development Services

- **`postgres`** - Development PostgreSQL (port 5432)
- **`api-dev`** - Development API with hot reload (port 4000)
- **`web-dev`** - Development web app with hot reload (port 5173)

### Test Services

- **`postgres-test`** - Test PostgreSQL (port 5433)
- **`api-test`** - Test API server (port 4001)

## 🚀 Quick Start

### Development Environment

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Or start just the database
docker-compose -f docker-compose.dev.yml up -d postgres
```

### Test Environment

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm test:integration
```

### Production Environment

```bash
# Start production environment
docker-compose up -d
```

## 🧪 Integration Testing

### Using Scripts (Recommended)

```bash
# API integration tests
cd apps/api
pnpm test:integration

# Watch mode
pnpm test:integration:watch
```

### Using Docker Directly

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run tests
cd apps/api
pnpm test:integration

# Cleanup
docker-compose -f docker-compose.test.yml down
```

## 📁 Docker Compose Files

| File                      | Purpose     | Services                   |
| ------------------------- | ----------- | -------------------------- |
| `docker-compose.yml`      | Production  | postgres, api, web         |
| `docker-compose.dev.yml`  | Development | postgres, api-dev, web-dev |
| `docker-compose.test.yml` | Testing     | postgres-test, api-test    |
| `docker-compose.ci.yml`   | CI Pipeline | postgres-test              |

## 🔧 Environment Variables

### Development

- `NODE_ENV=development`
- `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/salespro_dev`
- `PORT=4000`

### Testing

- `NODE_ENV=test`
- `DATABASE_URL=postgresql://postgres:postgres@postgres-test:5432/salespro_test`
- `PORT=4001`

### Production

- `NODE_ENV=production`
- `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/salespro`
- `PORT=4000`

## 🗂️ Volumes

- **`postgres_data`** - Production PostgreSQL data
- **`postgres_dev_data`** - Development PostgreSQL data
- **`postgres_test_data`** - Test PostgreSQL data

## 🛠️ Scripts

| Script                                       | Purpose                     |
| -------------------------------------------- | --------------------------- |
| `apps/api/scripts/test-integration.sh`       | Run API integration tests   |
| `apps/api/scripts/test-integration-watch.sh` | Run API tests in watch mode |

## 🧹 Cleanup

```bash
# Stop all services
docker-compose down

# Stop development services
docker-compose -f docker-compose.dev.yml down

# Stop test services
docker-compose -f docker-compose.test.yml down

# Remove volumes (⚠️ This will delete all data)
docker-compose down -v
```

## 🔍 Health Checks

The PostgreSQL services include health checks to ensure they're ready before running tests:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U postgres -d salespro_test']
  interval: 5s
  timeout: 3s
  retries: 5
  start_period: 10s
```

## 🐛 Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres-test

# Check PostgreSQL logs
docker-compose logs postgres-test

# Test PostgreSQL connection
docker-compose exec postgres-test psql -U postgres -d salespro_test -c "SELECT 1"
```

### Port Conflicts

- Development API: 4000
- Test API: 4001
- Development Web: 5173
- Production Web: 5173
- PostgreSQL: 5432
- Test PostgreSQL: 5433

### Volume Issues

```bash
# List volumes
docker volume ls

# Remove specific volume
docker volume rm salespro-web_postgres_test_data
```

### Database Migration Issues

```bash
# Run migrations manually
pnpm db:migrate

# Check migration status
pnpm --filter api migration:up
```
