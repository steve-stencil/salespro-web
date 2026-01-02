/**
 * PostgreSQL-based job queue using pg-boss.
 * Provides background job processing for:
 * - Price guide import/export operations
 * - Mass price change jobs
 * - Other async operations
 *
 * Uses existing PostgreSQL database (no Redis infrastructure needed).
 */

import { PgBoss } from 'pg-boss';

import { env } from '../config/env';

/** Singleton pg-boss instance */
let boss: PgBoss | null = null;

/**
 * Get or create the pg-boss job queue instance.
 * Initializes pg-boss with the application's database connection.
 *
 * @returns Promise resolving to the pg-boss instance
 */
export async function getJobQueue(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
    // Maintenance interval for supervising jobs (in seconds)
    maintenanceIntervalSeconds: 30,
  });

  // Handle pg-boss error events
  boss.on('error', (error: Error) => {
    console.error('[job-queue] pg-boss error:', error);
  });

  await boss.start();
  console.log('[job-queue] pg-boss started successfully');

  return boss;
}

/**
 * Stop the pg-boss job queue gracefully.
 * Should be called during application shutdown.
 */
export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 30000 });
    boss = null;
    console.log('[job-queue] pg-boss stopped');
  }
}

/**
 * Check if the job queue is initialized and running.
 *
 * @returns True if the job queue is running
 */
export function isJobQueueRunning(): boolean {
  return boss !== null;
}

/**
 * Reset the job queue singleton.
 * Primarily used for testing.
 */
export function resetJobQueue(): void {
  boss = null;
}

/**
 * Job queue names used throughout the application.
 * Centralizing names prevents typos and provides autocomplete.
 */
export const JOB_QUEUES = {
  /** Pricing import from Excel files */
  PRICING_IMPORT: 'pricing-import',
  /** Mass price change operations */
  PRICE_CHANGE: 'price-change',
} as const;

export type JobQueueName = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES];
