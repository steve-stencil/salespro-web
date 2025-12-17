# Entities

## Purpose

This folder contains all MikroORM entity definitions for the SalesPro Dashboard API. Entities define the database schema and relationships using TypeScript decorators.

## Structure

### Core Entities

| Entity              | Purpose                                |
| ------------------- | -------------------------------------- |
| `Company.entity.ts` | Multi-tenant company/organization      |
| `User.entity.ts`    | User accounts with authentication data |
| `Session.entity.ts` | User session management                |

### RBAC (Role-Based Access Control)

| Entity                 | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `Role.entity.ts`       | Role definitions with permissions       |
| `UserRole.entity.ts`   | Junction table linking users to roles   |
| `Office.entity.ts`     | Physical office locations               |
| `UserOffice.entity.ts` | Junction table linking users to offices |

### OAuth 2.0

| Entity                             | Purpose                            |
| ---------------------------------- | ---------------------------------- |
| `OAuthClient.entity.ts`            | OAuth client applications          |
| `OAuthToken.entity.ts`             | Access and refresh tokens          |
| `OAuthAuthorizationCode.entity.ts` | Authorization codes for OAuth flow |

### Authentication Tracking

| Entity                    | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `LoginAttempt.entity.ts`  | Failed login attempt tracking (rate limiting) |
| `LoginEvent.entity.ts`    | Successful login audit log                    |
| `TrustedDevice.entity.ts` | Remembered devices for MFA bypass             |

### Password Management

| Entity                         | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `PasswordResetToken.entity.ts` | Password reset request tokens      |
| `PasswordHistory.entity.ts`    | Previous passwords (prevent reuse) |

### User Management

| Entity                             | Purpose                   |
| ---------------------------------- | ------------------------- |
| `UserInvite.entity.ts`             | Pending user invitations  |
| `EmailVerificationToken.entity.ts` | Email verification tokens |

### MFA (Multi-Factor Authentication)

| Entity                      | Purpose                 |
| --------------------------- | ----------------------- |
| `MfaRecoveryCode.entity.ts` | One-time recovery codes |
| `TrustedDevice.entity.ts`   | Devices that skip MFA   |

### Security Tokens

| Entity                      | Purpose                         |
| --------------------------- | ------------------------------- |
| `RememberMeToken.entity.ts` | "Remember me" session extension |
| `ApiKey.entity.ts`          | API key authentication          |

### File Management

| Entity           | Purpose                              |
| ---------------- | ------------------------------------ |
| `File.entity.ts` | File metadata and storage references |

### Supporting Files

| File       | Purpose                |
| ---------- | ---------------------- |
| `index.ts` | Entity exports         |
| `types.ts` | Shared enums and types |

## Entity Relationships

```
Company (1) ──────┬──── (*) User
                  ├──── (*) Role
                  ├──── (*) Office
                  └──── (*) File

User (1) ─────────┬──── (*) UserRole ──── Role
                  ├──── (*) UserOffice ── Office
                  ├──── (*) Session
                  ├──── (*) LoginEvent
                  └──── (*) File (uploadedBy)

Role (*) ─────────┴──── (*) UserRole
```

## Patterns

### Creating a New Entity

```typescript
import { Entity, Property, ManyToOne, PrimaryKey } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Company } from './Company.entity';

@Entity()
export class NewEntity {
  @PrimaryKey()
  id: string = v4();

  @Property()
  name!: string;

  @ManyToOne(() => Company)
  company!: Company;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
```

### Multi-Tenant Pattern

All company-scoped entities must have a `company` relation:

```typescript
@ManyToOne(() => Company)
company!: Company;
```

### Soft Delete Pattern

For entities that support soft delete:

```typescript
@Property({ nullable: true })
deletedAt?: Date;
```

## Dependencies

- **MikroORM** - ORM framework for entity definitions
- **uuid** - UUID generation for primary keys

## Related

- [Database Setup](../../../README.md#database-setup)
- [Migrations](../migrations/README.md)
- [Services](../services/README.md) - Business logic using entities
