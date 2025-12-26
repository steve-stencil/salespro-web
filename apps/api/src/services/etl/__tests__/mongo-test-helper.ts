/**
 * MongoDB Test Helper
 *
 * Provides utilities for running integration tests against an in-memory
 * MongoDB instance using mongodb-memory-server.
 *
 * @example
 * ```typescript
 * import { setupMongoTestDb, teardownMongoTestDb, getTestCollection } from './mongo-test-helper';
 *
 * beforeAll(async () => {
 *   await setupMongoTestDb();
 * });
 *
 * afterAll(async () => {
 *   await teardownMongoTestDb();
 * });
 *
 * it('should query offices', async () => {
 *   const collection = await getTestCollection('Office');
 *   await collection.insertOne({ _id: 'test1', name: 'Test Office' });
 *   // ... test query logic
 * });
 * ```
 */

import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { closeSourceConnection } from '../queries/base';

import type { Collection, Db } from 'mongodb';

/**
 * Base document type for legacy MongoDB collections.
 *
 * The legacy Parse database uses string IDs instead of ObjectIds.
 */
export type LegacyDocument = {
  _id: string;
  [key: string]: unknown;
};

// Module-level state for the test MongoDB instance
let mongoServer: MongoMemoryServer | null = null;
let mongoClient: MongoClient | null = null;
let testDb: Db | null = null;

/**
 * Start an in-memory MongoDB server and configure the environment.
 *
 * Call this in `beforeAll` of your integration test suite.
 * Sets `LEGACY_MONGODB_URI` env var to point to the in-memory server.
 */
export async function setupMongoTestDb(): Promise<string> {
  // Create and start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Set the env var that base.ts reads
  process.env['LEGACY_MONGODB_URI'] = uri;

  // Create our own client for test data setup
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  testDb = mongoClient.db();

  return uri;
}

/**
 * Stop the in-memory MongoDB server and clean up.
 *
 * Call this in `afterAll` of your integration test suite.
 */
export async function teardownMongoTestDb(): Promise<void> {
  // Close the connection used by the query modules (base.ts singleton)
  await closeSourceConnection();

  // Close our test client
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    testDb = null;
  }

  // Stop the in-memory server
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }

  // Clear the env var
  delete process.env['LEGACY_MONGODB_URI'];
}

/**
 * Reset the query module's connection to the test database.
 *
 * Call this between test suites if you need to reset the connection state.
 * This forces the query modules to reconnect on the next query.
 */
export async function resetSourceConnection(): Promise<void> {
  await closeSourceConnection();
}

/**
 * Clear all collections in the test database.
 *
 * Call this in `beforeEach` to ensure test isolation.
 */
export async function clearTestDb(): Promise<void> {
  if (!testDb) {
    throw new Error(
      'Test database not initialized. Call setupMongoTestDb() first.',
    );
  }

  const collections = await testDb.listCollections().toArray();
  await Promise.all(
    collections.map(col => testDb!.collection(col.name).deleteMany({})),
  );
}

/**
 * Get a collection from the test database for inserting test data.
 *
 * Uses LegacyDocument type by default since the legacy database uses string IDs.
 *
 * @param name - Collection name (e.g., "Office", "_User")
 * @returns MongoDB collection
 */
export function getTestCollection<T extends LegacyDocument = LegacyDocument>(
  name: string,
): Collection<T> {
  if (!testDb) {
    throw new Error(
      'Test database not initialized. Call setupMongoTestDb() first.',
    );
  }

  return testDb.collection<T>(name);
}

/**
 * Get the test database instance.
 */
export function getTestDb(): Db {
  if (!testDb) {
    throw new Error(
      'Test database not initialized. Call setupMongoTestDb() first.',
    );
  }

  return testDb;
}

/**
 * Get the connection URI for the test database.
 */
export function getTestUri(): string {
  if (!mongoServer) {
    throw new Error(
      'Test server not initialized. Call setupMongoTestDb() first.',
    );
  }

  return mongoServer.getUri();
}

/**
 * Check if the test database is initialized.
 */
export function isTestDbInitialized(): boolean {
  return testDb !== null && mongoServer !== null;
}
