import { defineConfig } from '@mikro-orm/postgresql';

import { entities } from './src/lib/db';

/**
 * MikroORM configuration for CLI and migrations.
 * Used by: mikro-orm CLI commands (migrations, schema generation, etc.)
 *
 * NOTE: Entities are imported from db.ts which is the SINGLE SOURCE OF TRUTH.
 * When adding a new entity, only add it to the entities array in db.ts.
 */
export default defineConfig({
  clientUrl:
    process.env['DATABASE_URL'] ??
    'postgresql://postgres:postgres@localhost:5432/salespro_dev',
  entities,
  migrations: {
    path: './src/migrations',
    pathTs: './src/migrations',
    glob: '!(*.d).{js,ts}',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    snapshot: true,
  },
  debug: process.env['NODE_ENV'] === 'development',
});
