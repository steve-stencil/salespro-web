/**
 * Cleanup job for orphaned and deleted files.
 *
 * This job handles three types of file cleanup:
 * 1. PENDING files older than 24 hours (upload started but never confirmed)
 * 2. DELETED files older than 30 days (past retention period for recovery)
 * 3. ACTIVE files not referenced by any entity (orphaned)
 *
 * Run via: pnpm --filter api run job:cleanup-files
 * Or schedule via cron: 0 2 * * * (daily at 2 AM)
 */

import { File, FileStatus } from '../entities';
import { initORM, closeORM } from '../lib/db';
import { getStorageAdapter } from '../lib/storage';

import type { EntityManager } from '@mikro-orm/postgresql';

/** Retention period for deleted files before hard delete (30 days) */
const DELETED_RETENTION_DAYS = 30;

/** Max age for pending files before cleanup (24 hours) */
const PENDING_MAX_AGE_HOURS = 24;

/** Grace period for orphaned files - must be older than 1 hour to be considered orphaned */
const ORPHAN_GRACE_PERIOD_MS = 60 * 60 * 1000;

type CleanupStats = {
  pendingCleaned: number;
  deletedPurged: number;
  orphanedCleaned: number;
  errors: string[];
};

/**
 * Delete a file from storage (both main file and thumbnail).
 * Errors are caught and returned rather than thrown.
 */
async function deleteFromStorage(
  file: File,
  storage: ReturnType<typeof getStorageAdapter>,
): Promise<string | null> {
  try {
    await storage.delete(file.storageKey);
    if (file.thumbnailKey) {
      await storage.delete(file.thumbnailKey);
    }
    return null;
  } catch (err) {
    return `${file.id}: ${(err as Error).message}`;
  }
}

/**
 * Clean up stale PENDING files (upload started but never confirmed).
 */
async function cleanupPendingFiles(
  em: EntityManager,
  storage: ReturnType<typeof getStorageAdapter>,
  stats: CleanupStats,
): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - PENDING_MAX_AGE_HOURS);

  const stalePendingFiles = await em.find(File, {
    status: FileStatus.PENDING,
    createdAt: { $lt: cutoff },
  });

  console.log(
    `Found ${stalePendingFiles.length} stale pending files to clean up`,
  );

  for (const file of stalePendingFiles) {
    const error = await deleteFromStorage(file, storage);
    if (error) {
      stats.errors.push(`Pending file ${error}`);
    }

    // Remove from database regardless of storage deletion result
    await em.removeAndFlush(file);
    stats.pendingCleaned++;
  }
}

/**
 * Purge DELETED files past retention period.
 */
async function purgeDeletedFiles(
  em: EntityManager,
  storage: ReturnType<typeof getStorageAdapter>,
  stats: CleanupStats,
): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DELETED_RETENTION_DAYS);

  const expiredDeletedFiles = await em.find(File, {
    status: FileStatus.DELETED,
    deletedAt: { $lt: cutoff },
  });

  console.log(
    `Found ${expiredDeletedFiles.length} expired deleted files to purge`,
  );

  for (const file of expiredDeletedFiles) {
    const error = await deleteFromStorage(file, storage);
    if (error) {
      stats.errors.push(`Deleted file ${error}`);
    }

    // Remove from database regardless of storage deletion result
    await em.removeAndFlush(file);
    stats.deletedPurged++;
  }
}

/**
 * Find and clean orphaned ACTIVE files (not referenced by any entity).
 * Uses raw SQL to efficiently find files not referenced by MSI or UpCharge entities.
 */
async function cleanupOrphanedFiles(
  em: EntityManager,
  storage: ReturnType<typeof getStorageAdapter>,
  stats: CleanupStats,
): Promise<void> {
  const gracePeriodCutoff = new Date(Date.now() - ORPHAN_GRACE_PERIOD_MS);

  // Find files that are ACTIVE but not referenced by any entity
  // Only consider files older than grace period to avoid race conditions
  const orphanedFiles = await em
    .createQueryBuilder(File, 'f')
    .select('f.*')
    .where({
      status: FileStatus.ACTIVE,
      createdAt: { $lt: gracePeriodCutoff },
    })
    .andWhere(
      `f.id NOT IN (
        SELECT image_id FROM measure_sheet_item WHERE image_id IS NOT NULL
        UNION
        SELECT image_id FROM up_charge WHERE image_id IS NOT NULL
      )`,
    )
    .getResultList();

  console.log(
    `Found ${orphanedFiles.length} orphaned active files to clean up`,
  );

  for (const file of orphanedFiles) {
    const error = await deleteFromStorage(file, storage);
    if (error) {
      stats.errors.push(`Orphaned file ${error}`);
    }

    // Mark as deleted (soft delete) rather than hard delete for safety
    file.status = FileStatus.DELETED;
    file.deletedAt = new Date();
    await em.flush();
    stats.orphanedCleaned++;
  }
}

/**
 * Main cleanup function.
 * Runs all cleanup tasks and returns statistics.
 */
export async function runCleanupJob(): Promise<CleanupStats> {
  const orm = await initORM();
  const em = orm.em.fork() as EntityManager;
  const storage = getStorageAdapter();

  const stats: CleanupStats = {
    pendingCleaned: 0,
    deletedPurged: 0,
    orphanedCleaned: 0,
    errors: [],
  };

  console.log('Starting file cleanup job...');
  console.log(`- Pending file max age: ${PENDING_MAX_AGE_HOURS} hours`);
  console.log(`- Deleted file retention: ${DELETED_RETENTION_DAYS} days`);

  try {
    // 1. Clean up stale PENDING files
    await cleanupPendingFiles(em, storage, stats);

    // 2. Purge DELETED files past retention period
    await purgeDeletedFiles(em, storage, stats);

    // 3. Find and clean orphaned ACTIVE files
    await cleanupOrphanedFiles(em, storage, stats);

    console.log('File cleanup job completed successfully');
    console.log('Stats:', {
      pendingCleaned: stats.pendingCleaned,
      deletedPurged: stats.deletedPurged,
      orphanedCleaned: stats.orphanedCleaned,
      errorCount: stats.errors.length,
    });

    if (stats.errors.length > 0) {
      console.warn('Errors encountered:', stats.errors);
    }
  } catch (err) {
    console.error('File cleanup job failed:', err);
    stats.errors.push(`Job failed: ${(err as Error).message}`);
  }

  return stats;
}

// Allow running directly from command line
const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/^file:\/\//, ''));
if (isMainModule) {
  runCleanupJob()
    .then(stats => {
      console.log('Cleanup stats:', JSON.stringify(stats, null, 2));
      return closeORM();
    })
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}
