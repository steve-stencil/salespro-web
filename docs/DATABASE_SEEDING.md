# Database Seeding

This document explains how to seed the SalesPro database with initial data for development and testing.

## Quick Start

```bash
# From the monorepo root
pnpm db:migrate    # Apply database migrations
pnpm db:seed       # Seed initial data
```

That's it! You can now log in with the default admin credentials.

## Default Seed Data

### Company

| Field             | Value                 |
| ----------------- | --------------------- |
| Name              | SalesPro Demo Company |
| Tier              | Professional          |
| Max Seats         | 10                    |
| Sessions per User | 3                     |
| MFA Required      | No                    |

### Admin User

| Field          | Value                |
| -------------- | -------------------- |
| Email          | `admin@salespro.dev` |
| Password       | `SalesProAdmin123!`  |
| Name           | Admin User           |
| Email Verified | Yes                  |
| Max Sessions   | 5                    |

> ⚠️ **Security Warning**: Change the default password immediately in production environments!

## Commands

### Seed the Database

```bash
# From monorepo root
pnpm db:seed

# Or from apps/api directory
pnpm db:seed
```

This command:

1. Connects to the database using `DATABASE_URL`
2. Checks if seed data already exists
3. Creates the demo company and admin user
4. Prints a summary with login credentials

### Force Reseed

If seed data already exists, you can force a reseed:

```bash
pnpm db:seed:force
```

This will:

1. Remove existing seed data (user and company)
2. Create fresh seed data
3. Print updated credentials

### Running Migrations

Before seeding, ensure your database schema is up to date:

```bash
# Apply all pending migrations
pnpm db:migrate

# Or from apps/api
pnpm migration:up
```

## Prerequisites

### 1. PostgreSQL Running

Ensure PostgreSQL is running. Using Docker:

```bash
# Start the development database
docker-compose up -d postgres
```

Or with local PostgreSQL:

```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### 2. Environment Configuration

Create `apps/api/.env` with your database URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/salespro_dev"
PORT=4000
NODE_ENV=development
SESSION_SECRET="your-secret-key-change-in-production"
```

### 3. Database Created

Create the database if it doesn't exist:

```bash
# Using psql
createdb salespro_dev

# Or via SQL
psql -c "CREATE DATABASE salespro_dev;"
```

## Full Setup Sequence

For a fresh development environment:

```bash
# 1. Start PostgreSQL (if using Docker)
docker-compose up -d postgres

# 2. Create the database (if needed)
createdb salespro_dev

# 3. Apply migrations
pnpm db:migrate

# 4. Seed the database
pnpm db:seed

# 5. Start the development server
pnpm dev
```

## Customizing Seed Data

To customize the seed data, edit `apps/api/scripts/seed.ts`:

```typescript
const SEED_CONFIG = {
  company: {
    name: 'Your Company Name',
    maxSeats: 10,
    maxSessionsPerUser: 3,
    tier: SubscriptionTier.PROFESSIONAL,
    // ...
  },
  user: {
    email: 'admin@yourcompany.com',
    password: 'YourSecurePassword123!',
    nameFirst: 'Admin',
    nameLast: 'User',
    // ...
  },
} as const;
```

## Troubleshooting

### "Connection refused" Error

**Cause**: PostgreSQL is not running or not accessible.

**Solution**:

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start Docker container
docker-compose up -d postgres
```

### "Database does not exist" Error

**Cause**: The database hasn't been created yet.

**Solution**:

```bash
createdb salespro_dev
```

### "Relation does not exist" Error

**Cause**: Migrations haven't been applied.

**Solution**:

```bash
pnpm db:migrate
```

### "Data already exists" Warning

**Cause**: Seed data was previously created.

**Solution**: Use force flag to reseed:

```bash
pnpm db:seed:force
```

### Password Doesn't Work

**Cause**: The password requirements may have changed, or there's a hash mismatch.

**Solution**: Force reseed to create fresh credentials:

```bash
pnpm db:seed:force
```

## Entity Relationships

The seed script creates the following entity structure:

```
Company (SalesPro Demo Company)
└── User (admin@salespro.dev)
    ├── sessions: []
    └── passwordHistory: []
```

### Company Entity

- Contains subscription tier and limits
- Defines password policy
- Has one-to-many relationship with Users

### User Entity

- Belongs to a Company (many-to-one)
- Has authentication fields (password hash, MFA, lockout)
- Has session management fields

## Environment-Specific Notes

### Development

- Use the default seed data as-is
- The debug output shows connection details
- Safe to reseed frequently

### CI/Testing

- Set `DATABASE_URL` to the test database
- Always run with `--force` for clean state
- Consider creating additional test fixtures

### Production

- **Never** use the default seed data in production
- Create proper admin accounts through secure channels
- Use strong, unique passwords
- Enable MFA for admin accounts

## Related Documentation

- [Development Guide](./DEVELOPMENT.md)
- [API Architecture](./ARCHITECTURE.md)
- [Docker Setup](./DOCKER_SETUP.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
