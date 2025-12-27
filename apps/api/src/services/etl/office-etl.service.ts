/**
 * Office ETL Service
 *
 * Service for importing Office data from legacy MongoDB
 * into the new database schema. All queries are scoped by
 * the user's source company ID to ensure data isolation.
 */

import {
  Company,
  MigrationSession,
  MigrationSessionStatus,
  Office,
  User,
} from '../../entities';

import {
  countOffices,
  queryAllOffices,
  queryOffices,
  queryOfficesByIds,
} from './queries/office.queries';
import { getSourceCompanyIdByEmail } from './queries/user.queries';
import { isSourceConfigured } from './source-client';
import { EtlErrorCode, EtlServiceError } from './types';

import type {
  BaseEtlService,
  BatchImportOptions,
  BatchImportResult,
  FetchSourceResult,
  RawSourceOffice,
  TransformedOfficeData,
} from './types';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Office ETL Service.
 *
 * Handles:
 * - Fetching source offices from legacy MongoDB (scoped by company)
 * - Batch importing offices
 * - Tracking migration progress
 *
 * All queries are scoped by the user's source company ID, which is
 * looked up by email from the legacy _User collection.
 *
 * Implements BaseEtlService for consistent API across collections.
 */
export class OfficeEtlService implements BaseEtlService {
  private sourceCompanyId: string | null = null;

  constructor(private readonly em: EntityManager) {}

  /**
   * Check if source database is configured for migration.
   */
  isSourceConfigured(): boolean {
    return isSourceConfigured();
  }

  /**
   * Look up the source company ID by user email.
   * This must be called before any fetch operations.
   *
   * @param email - User's email address to look up in legacy system
   * @returns The source company ID
   * @throws EtlServiceError if user or company not found
   */
  async initializeSourceCompany(email: string): Promise<string> {
    const companyId = await getSourceCompanyIdByEmail(email);

    if (!companyId) {
      throw new EtlServiceError(
        `User "${email}" not found in legacy system or has no company assigned`,
        EtlErrorCode.SOURCE_COMPANY_NOT_FOUND,
      );
    }

    this.sourceCompanyId = companyId;
    return companyId;
  }

  /**
   * Set the source company ID directly (e.g., from a stored session).
   */
  setSourceCompanyId(sourceCompanyId: string): void {
    this.sourceCompanyId = sourceCompanyId;
  }

  /**
   * Get the current source company ID.
   */
  getSourceCompanyId(): string | null {
    return this.sourceCompanyId;
  }

  /**
   * Ensure source company is set before queries.
   */
  private requireSourceCompanyId(): string {
    if (!this.sourceCompanyId) {
      throw new EtlServiceError(
        'Source company not initialized. Call initializeSourceCompany() first.',
        EtlErrorCode.SOURCE_COMPANY_NOT_FOUND,
      );
    }
    return this.sourceCompanyId;
  }

  /**
   * Fetch source items from legacy database for preview.
   * Scoped by the initialized source company.
   */
  async fetchSourceItems(skip = 0, limit = 100): Promise<FetchSourceResult> {
    const sourceCompanyId = this.requireSourceCompanyId();
    const result = await queryOffices(sourceCompanyId, skip, limit);
    return {
      items: result.items,
      total: result.total,
    };
  }

  /**
   * Get total office count from source, scoped by company.
   */
  async getSourceCount(): Promise<number> {
    const sourceCompanyId = this.requireSourceCompanyId();
    return countOffices(sourceCompanyId);
  }

  /**
   * Get list of sourceIds that have already been imported.
   * Used to show import status in the UI.
   *
   * @param companyId - Target company ID
   * @param sourceIds - List of source IDs to check
   * @returns Set of sourceIds that are already imported
   */
  async getImportedSourceIds(
    companyId: string,
    sourceIds: string[],
  ): Promise<Set<string>> {
    if (sourceIds.length === 0) {
      return new Set();
    }

    const existingOffices = await this.em.find(
      Office,
      {
        company: companyId,
        sourceId: { $in: sourceIds },
      },
      { fields: ['sourceId'] },
    );

    return new Set(
      existingOffices.map(o => o.sourceId).filter(Boolean) as string[],
    );
  }

  /**
   * Create a new migration session.
   * Stores the source company ID for use across batches.
   */
  async createSession(
    companyId: string,
    userId: string,
  ): Promise<MigrationSession> {
    const sourceCompanyId = this.requireSourceCompanyId();

    const company = await this.em.findOne(Company, { id: companyId });
    if (!company) {
      throw new EtlServiceError(
        'Company not found',
        EtlErrorCode.SESSION_NOT_FOUND,
      );
    }

    const totalCount = await this.getSourceCount();

    const session = new MigrationSession();
    session.company = this.em.getReference(Company, companyId);
    session.createdBy = this.em.getReference(User, userId);
    session.sourceCompanyId = sourceCompanyId;
    session.status = MigrationSessionStatus.PENDING;
    session.totalCount = totalCount;

    await this.em.persistAndFlush(session);
    return session;
  }

  /**
   * Get a migration session by ID.
   */
  async getSession(
    sessionId: string,
    companyId: string,
  ): Promise<MigrationSession | null> {
    return this.em.findOne(MigrationSession, {
      id: sessionId,
      company: companyId,
    });
  }

  /**
   * Import a batch of offices.
   * Uses the sourceCompanyId stored in the session to scope queries.
   *
   * If sourceIds is provided, only those specific offices are imported.
   * Otherwise, uses skip/limit pagination to import all offices.
   */
  async importBatch(options: BatchImportOptions): Promise<BatchImportResult> {
    const { companyId, skip, limit, sessionId, sourceIds } = options;

    // Get session
    const session = await this.em.findOne(MigrationSession, { id: sessionId });
    if (!session) {
      throw new EtlServiceError(
        'Migration session not found',
        EtlErrorCode.SESSION_NOT_FOUND,
      );
    }

    const currentStatus = session.status as MigrationSessionStatus;
    if (currentStatus === MigrationSessionStatus.COMPLETED) {
      throw new EtlServiceError(
        'Migration session already completed',
        EtlErrorCode.SESSION_INVALID_STATE,
      );
    }

    // Update status to in progress
    if (currentStatus === MigrationSessionStatus.PENDING) {
      session.status = MigrationSessionStatus.IN_PROGRESS;
    }

    // Use sourceCompanyId from session to scope queries
    const sourceCompanyId = session.sourceCompanyId;

    // Fetch offices either by specific IDs or by pagination
    let rawOffices: RawSourceOffice[];
    let hasMore: boolean;

    if (sourceIds && sourceIds.length > 0) {
      // Selective import: fetch specific offices by ID
      rawOffices = await queryOfficesByIds(sourceCompanyId, sourceIds);
      hasMore = false; // All selected items are fetched at once
    } else {
      // Bulk import: fetch batch from source database
      rawOffices = await queryAllOffices(sourceCompanyId, skip, limit);
      hasMore = rawOffices.length === limit;
    }

    const result: BatchImportResult = {
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      hasMore,
    };

    for (const raw of rawOffices) {
      try {
        // Check if already exists by sourceId
        const existing = await this.em.findOne(Office, {
          sourceId: raw.objectId,
          company: companyId,
        });

        if (existing) {
          result.skippedCount++;
          session.skippedCount++;
          continue;
        }

        // Transform
        const data = this.transformOffice(raw);

        // Create office
        const office = new Office();
        office.company = this.em.getReference(Company, companyId);
        office.name = data.name;
        office.sourceId = data.sourceId;
        office.isActive = true;

        this.em.persist(office);
        result.importedCount++;
        session.importedCount++;
      } catch (error) {
        result.errorCount++;
        session.errorCount++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push({
          sourceId: raw.objectId,
          error: errorMessage,
        });
        session.errors.push({
          sourceId: raw.objectId,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Check if import is complete
    // Only mark as completed when we've processed all expected items AND there are no more items to fetch
    const totalProcessed =
      session.importedCount + session.skippedCount + session.errorCount;
    if (totalProcessed >= session.totalCount && !result.hasMore) {
      session.status = MigrationSessionStatus.COMPLETED;
      session.completedAt = new Date();
    }

    await this.em.flush();

    return result;
  }

  /**
   * Transform a raw legacy office to our schema.
   */
  private transformOffice(raw: RawSourceOffice): TransformedOfficeData {
    return {
      sourceId: raw.objectId,
      name: raw.name ?? `Office ${raw.objectId}`,
      sourceCompanyId: raw.sourceCompanyId,
    };
  }
}
