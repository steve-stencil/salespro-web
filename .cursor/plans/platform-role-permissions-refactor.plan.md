# Platform Role Permissions Refactor

## Overview

Refactor platform roles to use explicit company permissions instead of the companyAccessLevel enum. Platform roles will have two permission arrays: `permissions` for platform-level actions and `companyPermissions` for what internal users can do when switched into any company.

## Current State

Platform roles use a `companyAccessLevel` enum to determine company access:

- `FULL` → SuperUser access (`*`) in any company
- `READ_ONLY` → All `:read` permissions
- `CUSTOM` → Non-platform permissions from the role's permissions array

## Target State

Platform roles will have **two explicit permission arrays**:

- `permissions[]` → Platform-level actions (e.g., `platform:switch_company`)
- `companyPermissions[]` → Permissions when switched into a company (e.g., `customer:read`, `user:update`)

## Files to Modify

### 1. Entity Changes

**apps/api/src/entities/Role.entity.ts**

- Add `companyPermissions: string[]` property (JSON array, default `[]`)
- Remove `companyAccessLevel` property

**apps/api/src/entities/types.ts**

- Remove `CompanyAccessLevel` enum

### 2. Service Changes

**apps/api/src/services/PermissionService.ts**

- Update `getInternalUserCompanyPermissions()` to return `role.companyPermissions` directly
- Remove the switch statement on `companyAccessLevel`
- Keep wildcard matching logic for `*` and `resource:*` patterns

Key change:\`\`\`typescript// BEFOREswitch (platformRole.companyAccessLevel) {case CompanyAccessLevel.FULL: return ['*'];case CompanyAccessLevel.READ_ONLY: return getReadOnlyPermissions();case CompanyAccessLevel.CUSTOM: return platformRole.permissions.filter(...);}// AFTERreturn platformRole.companyPermissions;\`\`\`

### 3. Seed Script Updates

**apps/api/scripts/seed-roles.ts**

- Update `PLATFORM_ROLES` array to use `companyPermissions` instead of `companyAccessLevel`
- Remove `CompanyAccessLevel` import

Example transformation:\`\`\`typescript// BEFORE{name: 'platformAdmin',companyAccessLevel: CompanyAccessLevel.FULL,permissions: ['platform:admin', 'platform:view_companies', ...],}// AFTER{name: 'platformAdmin',permissions: ['platform:admin', 'platform:view_companies', ...],companyPermissions: ['*'], // Full access in any company}// BEFORE{name: 'platformSupport',companyAccessLevel: CompanyAccessLevel.READ_ONLY,permissions: ['platform:view_companies', ...],}// AFTER{name: 'platformSupport',permissions: ['platform:view_companies', ...],companyPermissions: ['customer:read', 'user:read', 'office:read','role:read', 'report:read', 'settings:read','company:read', 'file:read'],}\`\`\`

### 4. Database Migration

**New migration file**: Migration20251218000000_platform-role-company-permissions.ts\`\`\`sql-- Add companyPermissions columnALTER TABLE "role" ADD COLUMN "company_permissions" jsonb NOT NULL DEFAULT '[]';-- Migrate existing platform roles based on companyAccessLevelUPDATE "role" SET "company_permissions" = '["*"]'WHERE "type" = 'platform' AND "company_access_level" = 'full';UPDATE "role" SET "company_permissions" = '["customer:read", "user:read", ...]'WHERE "type" = 'platform' AND "company_access_level" = 'read_only';UPDATE "role" SET "company_permissions" = (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text("permissions") AS elemWHERE elem NOT LIKE 'platform:%')WHERE "type" = 'platform' AND "company_access_level" = 'custom';-- Drop old columnALTER TABLE "role" DROP COLUMN "company_access_level";\`\`\`

### 5. Route Updates

**apps/api/src/routes/internal-users.ts**

- Update any role creation/update logic to handle `companyPermissions`

**apps/api/src/routes/auth/login.routes.ts**

- Remove references to `CompanyAccessLevel.FULL` check
- Use wildcard check on `companyPermissions` instead

### 6. Type Exports

**apps/api/src/entities/index.ts**

- Remove `CompanyAccessLevel` export

**apps/web/src/types/platform.ts**

- Update `PlatformRole` type to include `companyPermissions`
- Remove `companyAccessLevel` field

## Migration Strategy

1. Create migration that adds `companyPermissions` column
2. Migrate existing data based on current `companyAccessLevel` values
3. Drop `companyAccessLevel` column
4. Update seed script for fresh installs
5. Update entity and service code

## Testing Checklist