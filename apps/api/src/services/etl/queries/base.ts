/**
 * Base Query Utilities for ETL Operations
 *
 * Provides shared utilities for querying the legacy MongoDB database.
 * All collection-specific query modules should import from this file.
 *
 * @example
 * ```typescript
 * import { getCollection, parsePointer, createPointer } from './base';
 *
 * const collection = await getCollection<MyDocument>('MyCollection');
 * ```
 */

import { MongoClient, ReadPreference } from 'mongodb';

import { EtlErrorCode, EtlServiceError } from '../types';

import type { Collection, Db, Document, Filter, WithId } from 'mongodb';

// ============================================================================
// Connection Management (Singleton)
// ============================================================================

let mongoClient: MongoClient | null = null;
let db: Db | null = null;
let isReplicaSet = false;

/**
 * Check if connected to a replica set using the 'hello' command.
 */
async function checkIsReplicaSet(client: MongoClient): Promise<boolean> {
  try {
    const result = await client.db().admin().command({ hello: 1 });
    // 'setName' is present when connected to a replica set
    return !!result['setName'];
  } catch {
    return false;
  }
}

/**
 * Get the MongoDB URI from environment.
 *
 * Reads directly from process.env to support dynamic configuration in tests.
 */
function getMongoUri(): string | undefined {
  return process.env['LEGACY_MONGODB_URI'];
}

/**
 * Get or create MongoDB client connection.
 * Configures read preference for secondary if replica set is detected.
 */
async function getConnection(): Promise<Db> {
  if (db) return db;

  const uri = getMongoUri();
  if (!uri) {
    throw new EtlServiceError(
      'Legacy MongoDB URI not configured. Set LEGACY_MONGODB_URI.',
      EtlErrorCode.SOURCE_CONNECTION_FAILED,
    );
  }

  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    // Check if we're connected to a replica set
    isReplicaSet = await checkIsReplicaSet(mongoClient);

    // Get database with appropriate read preference
    if (isReplicaSet) {
      // Use secondaryPreferred to read from secondary when available
      db = mongoClient.db(undefined, {
        readPreference: ReadPreference.SECONDARY_PREFERRED,
      });
      console.log(
        '[ETL] Connected to replica set - using secondary read preference',
      );
    } else {
      db = mongoClient.db();
      console.log('[ETL] Connected to standalone MongoDB');
    }

    return db;
  } catch (error) {
    throw new EtlServiceError(
      `Failed to connect to legacy MongoDB: ${error instanceof Error ? error.message : String(error)}`,
      EtlErrorCode.SOURCE_CONNECTION_FAILED,
    );
  }
}

/**
 * Close MongoDB connection (for graceful shutdown).
 */
export async function closeSourceConnection(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    db = null;
    isReplicaSet = false;
  }
}

/**
 * Check if connected to a replica set (for diagnostics).
 */
export function isConnectedToReplicaSet(): boolean {
  return isReplicaSet;
}

/**
 * Check if source database is configured.
 */
export function isSourceConfigured(): boolean {
  return !!getMongoUri();
}

// ============================================================================
// Collection Access
// ============================================================================

/**
 * Get a typed collection by name.
 *
 * @param name - Collection name in legacy MongoDB (e.g., "Office", "_User")
 * @returns Typed MongoDB collection
 *
 * @example
 * ```typescript
 * type MyDoc = Document & { _id: string; name: string };
 * const collection = await getCollection<MyDoc>('MyCollection');
 * ```
 */
export async function getCollection<T extends Document>(
  name: string,
): Promise<Collection<T>> {
  const database = await getConnection();
  return database.collection<T>(name);
}

// ============================================================================
// Pointer Utilities
// ============================================================================

/**
 * Parse a pointer string (e.g., "Company$abc123") into its object ID.
 *
 * Legacy MongoDB stores relationships as pointer strings in format:
 * `ClassName$objectId`
 *
 * @param pointer - Pointer string to parse
 * @returns The objectId portion, or null if invalid
 *
 * @example
 * ```typescript
 * parsePointer('Company$abc123') // => 'abc123'
 * parsePointer('Office$xyz789')  // => 'xyz789'
 * parsePointer(undefined)         // => null
 * ```
 */
export function parsePointer(pointer: string | undefined): string | null {
  if (!pointer) return null;
  const parts = pointer.split('$');
  return parts.length === 2 ? (parts[1] ?? null) : null;
}

/**
 * Create a pointer string from class name and object ID.
 *
 * @param className - The class/collection name (e.g., "Company")
 * @param objectId - The object ID
 * @returns Pointer string in format "ClassName$objectId"
 *
 * @example
 * ```typescript
 * createPointer('Company', 'abc123') // => 'Company$abc123'
 * ```
 */
export function createPointer(className: string, objectId: string): string {
  return `${className}$${objectId}`;
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Standard result type for paginated queries.
 */
export type PaginatedResult<T> = {
  items: T[];
  total: number;
};

/**
 * Options for paginated queries.
 */
export type PaginationOptions = {
  skip?: number;
  limit?: number;
};

/**
 * Execute a paginated query with count.
 *
 * @param collection - MongoDB collection
 * @param filter - Query filter
 * @param options - Pagination options
 * @param transform - Transform function for documents
 * @returns Paginated result with items and total count
 */
export async function queryWithPagination<TDoc extends Document, TResult>(
  collection: Collection<TDoc>,
  filter: Filter<TDoc>,
  options: PaginationOptions & { sort?: Record<string, 1 | -1> },
  transform: (doc: WithId<TDoc>) => TResult,
): Promise<PaginatedResult<TResult>> {
  const { skip = 0, limit = 100, sort = {} } = options;

  const [docs, total] = await Promise.all([
    collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    items: docs.map(transform),
    total,
  };
}

// ============================================================================
// Base Document Types
// ============================================================================

/**
 * Base fields present on all legacy MongoDB documents.
 */
export type BaseMongoDocument = Document & {
  _id: string;
  _created_at?: Date;
  _updated_at?: Date;
};

/**
 * Helper to safely access document properties from index signatures.
 */
export function getDocField<T>(doc: Document, field: string): T | undefined {
  return doc[field] as T | undefined;
}
