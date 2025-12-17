# settings-object

# Creating a New Settings Object

This guide documents the complete pattern for adding a new settings object to the SalesPro Dashboard. Settings objects are JSON-stored configuration that can be attached to entities like Company, Office, User, etc.

## When to Use This Pattern

Use this pattern when you need to:

- Add configurable options to an existing entity
- Store structured settings as JSON in the database
- Provide defaults that can be overridden per-entity

## Step-by-Step Implementation

### Step 1: Define Types in `apps/api/src/entities/types.ts`

Add the settings type definition and defaults:

```typescript
// =============================================
// [EntityName] Settings
// =============================================

/** [EntityName]-specific settings stored as JSON */
export type [EntityName]Settings = {
  /** Description of setting1 */
  setting1: boolean;
  /** Description of setting2 */
  setting2: string;
  /** Description of setting3 (optional) */
  setting3?: number;
};

/** Default [EntityName] settings */
export const DEFAULT_[ENTITY_NAME]_SETTINGS: [EntityName]Settings = {
  setting1: false,
  setting2: 'default_value',
  // setting3 is optional, omit for undefined default
};
```

### Step 2: Add to Entity in `apps/api/src/entities/[EntityName].entity.ts`

Import and add the settings property:

```typescript
import {
  DEFAULT_[ENTITY_NAME]_SETTINGS,
} from './types';

import type { [EntityName]Settings } from './types';

// Inside the entity class:

/** [EntityName]-specific settings (JSON) */
@Property({ type: 'json', nullable: true })
settings: Opt<[EntityName]Settings | null> = { ...DEFAULT_[ENTITY_NAME]_SETTINGS };
```

### Step 3: Create Migration (if needed)

If the column doesn't exist, create a migration:

```bash
cd apps/api
pnpm mikro-orm migration:create --name add-[entity]-settings
```

Migration content:

```typescript
import { Migration } from '@mikro-orm/migrations';

export class Migration[Timestamp]_add_[entity]_settings extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table "[entity_table]" add column "settings" jsonb null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "[entity_table]" drop column "settings";');
  }
}
```

### Step 4: Create Zod Schema in `apps/api/src/schemas/`

Create or update the schema file (e.g., `apps/api/src/schemas/[entity].schema.ts`):

```typescript
import { z } from 'zod';

/** Schema for [EntityName] settings */
export const [entityName]SettingsSchema = z.object({
  setting1: z.boolean().optional(),
  setting2: z.string().optional(),
  setting3: z.number().min(0).max(100).optional(),
});

/** Schema for updating [EntityName] settings */
export const update[EntityName]SettingsSchema = z.object({
  settings: [entityName]SettingsSchema.optional(),
});

export type [EntityName]SettingsInput = z.infer<typeof [entityName]SettingsSchema>;
```

### Step 5: Add API Route Handler

In `apps/api/src/routes/[entities].ts`, add GET and PATCH endpoints:

```typescript
import { requireAuth, requirePermission } from '../middleware';
import { PERMISSIONS } from '../lib/permissions';
import { update[EntityName]SettingsSchema } from '../schemas/[entity].schema';

// GET settings
router.get(
  '/:id/settings',
  requireAuth(),
  requirePermission(PERMISSIONS.[ENTITY]_READ),
  async (req, res) => {
    const { id } = req.params;
    const entity = await em.findOneOrFail([EntityName], { id });
    res.json({ settings: entity.settings });
  }
);

// PATCH settings
router.patch(
  '/:id/settings',
  requireAuth(),
  requirePermission(PERMISSIONS.[ENTITY]_UPDATE),
  async (req, res) => {
    const { id } = req.params;
    const parsed = update[EntityName]SettingsSchema.parse(req.body);

    const entity = await em.findOneOrFail([EntityName], { id });
    entity.settings = { ...entity.settings, ...parsed.settings };
    await em.flush();

    res.json({ message: 'Settings updated', settings: entity.settings });
  }
);
```

### Step 6: Add Frontend Types in `apps/web/src/types/`

Create `apps/web/src/types/[entity].ts` or add to existing:

```typescript
/**
 * [EntityName] settings types.
 * Used for [entity]-level configuration.
 */

/** [EntityName] settings returned from the API */
export type [EntityName]Settings = {
  /** Description of setting1 */
  setting1: boolean;
  /** Description of setting2 */
  setting2: string;
  /** Description of setting3 (optional) */
  setting3?: number;
};

/** API response wrapper for [entity] settings */
export type [EntityName]SettingsResponse = {
  settings: [EntityName]Settings;
};

/** Partial settings for update requests */
export type [EntityName]SettingsUpdate = Partial<[EntityName]Settings>;
```

### Step 7: Add API Service in `apps/web/src/services/`

Create `apps/web/src/services/[entity].ts` or add to existing:

```typescript
import { apiClient } from '../lib/api-client';
import type {
  [EntityName]SettingsResponse,
  [EntityName]SettingsUpdate,
} from '../types/[entity]';

export const [entityName]Api = {
  /** Fetch [entity] settings */
  async getSettings(id: string): Promise<[EntityName]SettingsResponse> {
    const response = await apiClient.get<[EntityName]SettingsResponse>(
      `/[entities]/${id}/settings`
    );
    return response.data;
  },

  /** Update [entity] settings */
  async updateSettings(
    id: string,
    settings: [EntityName]SettingsUpdate
  ): Promise<[EntityName]SettingsResponse> {
    const response = await apiClient.patch<[EntityName]SettingsResponse>(
      `/[entities]/${id}/settings`,
      { settings }
    );
    return response.data;
  },
};
```

### Step 8: Create Settings Page Component (Optional)

If a dedicated settings page is needed, create `apps/web/src/pages/[EntityName]SettingsPage.tsx` following the pattern in `CompanySettingsPage.tsx`.

## Checklist

When adding a new settings object, ensure you:

- [ ] Define type in `apps/api/src/entities/types.ts`
- [ ] Define defaults constant in `apps/api/src/entities/types.ts`
- [ ] Add `settings` property to entity class
- [ ] Create migration if column doesn't exist
- [ ] Add Zod validation schema
- [ ] Add API routes (GET and PATCH)
- [ ] Protect routes with appropriate permissions
- [ ] Add frontend types
- [ ] Add API service functions
- [ ] Create settings page component (if needed)
- [ ] Add tests for API routes
- [ ] Update entity README if needed

## Permissions

Settings typically use the existing entity permissions:

- `[entity]:read` - View settings
- `[entity]:update` - Modify settings

If you need separate settings permissions, add them following `.cursor/rules/permissions.mdc`.

## Example: OfficeSettings

Here's a concrete example for adding `OfficeSettings`:

### Types (`apps/api/src/entities/types.ts`)

```typescript
export type OfficeSettings = {
  /** Office timezone (IANA format) */
  timezone: string;
  /** Business hours start (24h format, e.g., "09:00") */
  businessHoursStart: string;
  /** Business hours end (24h format, e.g., "17:00") */
  businessHoursEnd: string;
  /** Days office is open (0=Sunday, 6=Saturday) */
  businessDays: number[];
  /** Enable notifications for this office */
  notificationsEnabled: boolean;
};

export const DEFAULT_OFFICE_SETTINGS: OfficeSettings = {
  timezone: 'America/New_York',
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  businessDays: [1, 2, 3, 4, 5], // Mon-Fri
  notificationsEnabled: true,
};
```

### Entity Property (`apps/api/src/entities/Office.entity.ts`)

```typescript
import { DEFAULT_OFFICE_SETTINGS } from './types';
import type { OfficeSettings } from './types';

// In Office class:
@Property({ type: 'json', nullable: true })
settings: Opt<OfficeSettings | null> = { ...DEFAULT_OFFICE_SETTINGS };
```

## Related Documentation

- `.cursor/rules/permissions.mdc` - Adding new permissions
- `.cursor/rules/backend.mdc` - API routes and validation
- `.cursor/rules/frontend.mdc` - React components and hooks
- `apps/api/src/entities/README.md` - Entity patterns
- `apps/web/src/pages/CompanySettingsPage.tsx` - Example settings page
