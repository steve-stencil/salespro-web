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

### Custom Admin Credentials

You can provide custom email and password instead of using the defaults:

**Using CLI arguments:**

```bash
pnpm db:seed --email myemail@example.com --password MySecurePass123!
```

**Using environment variables:**

```bash
SEED_ADMIN_EMAIL=myemail@example.com SEED_ADMIN_PASSWORD=MySecurePass123! pnpm db:seed
```

**Priority order:** CLI args > Environment variables > Defaults

| Method  | Email Variable     | Password Variable     |
| ------- | ------------------ | --------------------- |
| CLI     | `--email`          | `--password`          |
| Env Var | `SEED_ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |

### Generate Additional Seed Data

For testing pagination, list views, and realistic scenarios, you can generate additional offices, users, and roles:

```bash
pnpm db:seed --offices 5 --users 20 --roles 3
```

**Available options:**

| Option      | Description                             | Default |
| ----------- | --------------------------------------- | ------- |
| `--offices` | Number of offices to create per company | 0       |
| `--users`   | Number of additional users per company  | 0       |
| `--roles`   | Number of custom roles per company      | 0       |

**Example with all options:**

```bash
pnpm db:seed --force \
  --email admin@example.com \
  --password MyPass123! \
  --offices 5 \
  --users 20 \
  --roles 3
```

This creates:

- 2 companies (SalesPro Demo Company, Acme Corporation)
- 1 admin user with the specified credentials
- 5 offices per company (Downtown Office, Midtown Office, etc.)
- 20 additional users per company (random names, assigned to random offices)
- 3 custom roles per company (Sales Rep, Sales Manager, Account Manager)

**Additional user details:**

- Email format: `firstname.lastname{index}.{companyslug}@example.com`
- Default password: `Password123!`
- 90% are active, 80% have verified emails
- Each user is assigned to a random office and role

### Force Reseed

If seed data already exists, you can force a reseed:

```bash
pnpm db:seed:force
```

With custom credentials:

```bash
pnpm db:seed:force --email newemail@example.com --password NewPass123!
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

### Admin Credentials (Recommended)

Use CLI arguments or environment variables to customize admin credentials without editing code:

```bash
# CLI arguments
pnpm db:seed --email admin@yourcompany.com --password YourSecurePassword123!

# Environment variables
SEED_ADMIN_EMAIL=admin@yourcompany.com SEED_ADMIN_PASSWORD=YourSecurePassword123! pnpm db:seed
```

### Company Settings (Advanced)

To customize company settings beyond credentials, edit `apps/api/scripts/seed.ts` and modify the `getSeedConfig()` function:

```typescript
return {
  company: {
    name: 'Your Company Name',
    maxSeats: 10,
    maxSessionsPerUser: 3,
    tier: SubscriptionTier.PROFESSIONAL,
    // ...
  },
  user: {
    email, // From CLI/env/default
    password, // From CLI/env/default
    nameFirst: 'Admin',
    nameLast: 'User',
    // ...
  },
};
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

---

## Internal Platform User Seeding

For development and testing of platform-level features (like managing platform roles), you can seed an internal platform user.

### What is an Internal Platform User?

Internal platform users (`userType: 'internal'`) are different from regular company users:

- Can switch between and access multiple companies
- Can view and manage **Platform Roles**
- Have platform-level permissions (e.g., `platform:admin`, `platform:view_companies`)

Regular company users (`userType: 'company'`) cannot see platform roles, even if they have superuser (`*`) permissions.

### Quick Start

```bash
# From the monorepo root
pnpm --filter api db:seed-internal-user

# Or from apps/api directory
pnpm db:seed-internal-user
```

### Default Internal User Data

#### Company

| Field             | Value               |
| ----------------- | ------------------- |
| Name              | Platform Operations |
| Tier              | Enterprise          |
| Max Seats         | 100                 |
| Sessions per User | 10                  |

#### Office

| Field | Value       |
| ----- | ----------- |
| Name  | Platform HQ |

#### Platform Role

| Field        | Value                  |
| ------------ | ---------------------- |
| Name         | platformAdmin          |
| Display Name | Platform Administrator |
| Access Level | Full                   |
| Type         | Platform               |

#### Internal User

| Field          | Value                   |
| -------------- | ----------------------- |
| Email          | `platform@salespro.dev` |
| Password       | `PlatformAdmin123!`     |
| Name           | Platform Admin          |
| User Type      | `internal`              |
| Email Verified | Yes                     |

> ⚠️ **Security Warning**: Change the default password immediately in production environments!

### Custom Internal User Credentials

You can provide custom email and password:

**Using CLI arguments:**

```bash
pnpm --filter api db:seed-internal-user --email admin@platform.dev --password MySecurePass123!
```

**Using environment variables:**

```bash
SEED_INTERNAL_EMAIL=admin@platform.dev SEED_INTERNAL_PASSWORD=MySecurePass123! pnpm --filter api db:seed-internal-user
```

**Priority order:** CLI args > Environment variables > Defaults

| Method  | Email Variable        | Password Variable        |
| ------- | --------------------- | ------------------------ |
| CLI     | `--email`             | `--password`             |
| Env Var | `SEED_INTERNAL_EMAIL` | `SEED_INTERNAL_PASSWORD` |

### Force Reseed Internal User

If internal user data already exists, you can force a reseed:

```bash
pnpm --filter api db:seed-internal-user:force
```

With custom credentials:

```bash
pnpm --filter api db:seed-internal-user:force --email newemail@platform.dev --password NewPass123!
```

### What Gets Created

The seed script creates:

```
Company (Platform Operations)
├── Office (Platform HQ)
└── User (platform@salespro.dev)
    ├── userType: internal
    ├── Platform Role Assignment (platformAdmin)
    └── Office Assignment (Platform HQ)
```

### Use Cases

1. **Testing Platform Roles** - See and manage platform-level roles in the Roles page
2. **Multi-Company Access** - Test switching between companies
3. **Platform Administration** - Manage internal users and company access
4. **Development** - Full platform access for debugging

---

## Related Documentation

- [Development Guide](./DEVELOPMENT.md)
- [API Architecture](./ARCHITECTURE.md)
- [Docker Setup](./DOCKER_SETUP.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
