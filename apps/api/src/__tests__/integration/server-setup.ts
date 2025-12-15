import { beforeAll, afterAll } from 'vitest';

import { initORM, closeORM, getORM } from '../../lib/db';
import { createServer } from '../../server';

import type { Server } from 'http';
import type { AddressInfo } from 'net';

let server: Server | undefined;
let baseUrl: string;
let setupError: Error | undefined;

export function getTestServer() {
  if (setupError) {
    throw setupError;
  }
  return { server: server!, baseUrl };
}

beforeAll(async () => {
  try {
    // Connect to the test PostgreSQL instance
    await initORM();

    // Create database schema for tests
    const orm = getORM();
    const generator = orm.getSchemaGenerator();
    await generator.refreshDatabase();

    // Start the actual server
    server = await createServer();

    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;

    console.log(`Test server running on ${baseUrl}`);
  } catch (error) {
    // Store the error so tests can be skipped
    setupError = error instanceof Error ? error : new Error(String(error));
    console.error(
      'Failed to setup integration test server:',
      setupError.message,
    );
    console.error(
      'Make sure PostgreSQL is running (docker-compose -f docker-compose.test.yml up)',
    );
  }
});

afterAll(async () => {
  // Clean up server and database connection
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  await closeORM();
});
