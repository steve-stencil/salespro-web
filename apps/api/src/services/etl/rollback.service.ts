/**
 * Import Rollback Service
 *
 * Provides rollback functionality for price guide imports.
 * Deletes all entities created during a migration session in reverse dependency order.
 */

import {
  AdditionalDetailField,
  MeasureSheetItem,
  MeasureSheetItemAdditionalDetailField,
  MeasureSheetItemOffice,
  MeasureSheetItemOption,
  MeasureSheetItemUpCharge,
  MigrationSession,
  MigrationSessionStatus,
  OptionPrice,
  PriceGuideCategory,
  PriceGuideImage,
  PriceGuideOption,
  UpCharge,
  UpChargeAdditionalDetailField,
  UpChargeDisabledOption,
  UpChargePrice,
} from '../../entities';

import type { RollbackStats } from './types';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Service for rolling back price guide imports.
 *
 * Handles deletion of all entities in correct dependency order to avoid
 * foreign key constraint violations.
 */
export class ImportRollbackService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Rollback all entities created during a migration session.
   *
   * Deletes entities in reverse dependency order:
   * 1. Junction tables (MSI links, UpCharge links)
   * 2. Pricing entities (OptionPrice, UpChargePrice)
   * 3. Main entities (MSI, Option, UpCharge, AdditionalDetailField)
   * 4. Categories (after MSIs that reference them)
   * 5. Images (after MSIs/UpCharges that reference them)
   *
   * @param sessionId - Migration session ID to rollback
   * @returns Statistics about deleted entities
   */
  async rollbackSession(sessionId: string): Promise<RollbackStats> {
    const stats: RollbackStats = {
      categoriesDeleted: 0,
      msisDeleted: 0,
      optionsDeleted: 0,
      upChargesDeleted: 0,
      additionalDetailsDeleted: 0,
      pricesDeleted: 0,
      junctionsDeleted: 0,
    };

    // Get session first to verify it exists and can be rolled back
    const session = await this.em.findOne(MigrationSession, { id: sessionId });
    if (!session) {
      throw new Error(`Migration session ${sessionId} not found`);
    }

    const status = session.status as MigrationSessionStatus;
    if (
      status === MigrationSessionStatus.ROLLED_BACK ||
      status === MigrationSessionStatus.ROLLBACK_FAILED
    ) {
      throw new Error(`Session ${sessionId} has already been rolled back`);
    }

    try {
      await this.em.transactional(async tem => {
        // 1. Delete junction tables first (depend on main entities)

        // MSI junctions
        const msiOptionCount = await tem.nativeDelete(MeasureSheetItemOption, {
          migrationSessionId: sessionId,
        });
        stats.junctionsDeleted += msiOptionCount;

        const msiUpChargeCount = await tem.nativeDelete(
          MeasureSheetItemUpCharge,
          {
            migrationSessionId: sessionId,
          },
        );
        stats.junctionsDeleted += msiUpChargeCount;

        const msiOfficeCount = await tem.nativeDelete(MeasureSheetItemOffice, {
          migrationSessionId: sessionId,
        });
        stats.junctionsDeleted += msiOfficeCount;

        const msiAdditionalDetailCount = await tem.nativeDelete(
          MeasureSheetItemAdditionalDetailField,
          { migrationSessionId: sessionId },
        );
        stats.junctionsDeleted += msiAdditionalDetailCount;

        // UpCharge junctions
        const upChargeAdditionalDetailCount = await tem.nativeDelete(
          UpChargeAdditionalDetailField,
          { migrationSessionId: sessionId },
        );
        stats.junctionsDeleted += upChargeAdditionalDetailCount;

        const upChargeDisabledOptionCount = await tem.nativeDelete(
          UpChargeDisabledOption,
          { migrationSessionId: sessionId },
        );
        stats.junctionsDeleted += upChargeDisabledOptionCount;

        // 2. Delete pricing entities (depend on main entities)
        const optionPriceCount = await tem.nativeDelete(OptionPrice, {
          migrationSessionId: sessionId,
        });
        stats.pricesDeleted += optionPriceCount;

        const upChargePriceCount = await tem.nativeDelete(UpChargePrice, {
          migrationSessionId: sessionId,
        });
        stats.pricesDeleted += upChargePriceCount;

        // 3. Delete main entities

        // MSIs (after junctions and before categories)
        stats.msisDeleted = await tem.nativeDelete(MeasureSheetItem, {
          migrationSessionId: sessionId,
        });

        // Options (after pricing and junctions)
        stats.optionsDeleted = await tem.nativeDelete(PriceGuideOption, {
          migrationSessionId: sessionId,
        });

        // UpCharges (after pricing and junctions)
        stats.upChargesDeleted = await tem.nativeDelete(UpCharge, {
          migrationSessionId: sessionId,
        });

        // AdditionalDetailFields (after all links)
        stats.additionalDetailsDeleted = await tem.nativeDelete(
          AdditionalDetailField,
          {
            migrationSessionId: sessionId,
          },
        );

        // 4. Delete categories (after MSIs that reference them)
        // Delete deepest first to handle parent-child relationships
        // This requires multiple passes or proper ordering
        stats.categoriesDeleted = await this.deleteCategoriesRecursively(
          tem,
          sessionId,
        );

        // 5. Delete images (after MSIs/UpCharges that reference them)
        const imageCount = await tem.nativeDelete(PriceGuideImage, {
          migrationSessionId: sessionId,
        });
        stats.junctionsDeleted += imageCount; // Count images in junctions for simplicity
      });

      // Update session status
      await this.em.nativeUpdate(
        MigrationSession,
        { id: sessionId },
        {
          status: MigrationSessionStatus.ROLLED_BACK,
          completedAt: new Date(),
        },
      );
    } catch (error) {
      // Mark rollback as failed
      await this.em.nativeUpdate(
        MigrationSession,
        { id: sessionId },
        {
          status: MigrationSessionStatus.ROLLBACK_FAILED,
          errors: [
            ...session.errors,
            {
              sourceId: 'rollback',
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            },
          ],
        },
      );
      throw error;
    }

    return stats;
  }

  /**
   * Delete categories in correct order (children before parents).
   *
   * Uses depth field to delete from deepest to shallowest.
   *
   * @param tem - Transaction entity manager
   * @param sessionId - Migration session ID
   * @returns Total count of deleted categories
   */
  private async deleteCategoriesRecursively(
    tem: EntityManager,
    sessionId: string,
  ): Promise<number> {
    // Find max depth of categories in this session
    const categories = await tem.find(
      PriceGuideCategory,
      { migrationSessionId: sessionId },
      { fields: ['id', 'depth'], orderBy: { depth: 'DESC' } },
    );

    if (categories.length === 0) return 0;

    const maxDepth = categories[0]?.depth ?? 0;

    let totalDeleted = 0;

    // Delete from deepest to root (children first)
    for (let depth = maxDepth; depth >= 0; depth--) {
      const count = await tem.nativeDelete(PriceGuideCategory, {
        migrationSessionId: sessionId,
        depth,
      });
      totalDeleted += count;
    }

    return totalDeleted;
  }

  /**
   * Get rollback preview without actually deleting.
   *
   * Shows what would be deleted if rollback is performed.
   *
   * @param sessionId - Migration session ID to preview
   * @returns Preview of entities that would be deleted
   */
  async previewRollback(sessionId: string): Promise<RollbackStats> {
    const stats: RollbackStats = {
      categoriesDeleted: 0,
      msisDeleted: 0,
      optionsDeleted: 0,
      upChargesDeleted: 0,
      additionalDetailsDeleted: 0,
      pricesDeleted: 0,
      junctionsDeleted: 0,
    };

    // Count entities that would be deleted
    const [
      msiOptionCount,
      msiUpChargeCount,
      msiOfficeCount,
      msiAdditionalDetailCount,
      upChargeAdditionalDetailCount,
      upChargeDisabledOptionCount,
      optionPriceCount,
      upChargePriceCount,
      msiCount,
      optionCount,
      upChargeCount,
      additionalDetailCount,
      categoryCount,
    ] = await Promise.all([
      this.em.count(MeasureSheetItemOption, { migrationSessionId: sessionId }),
      this.em.count(MeasureSheetItemUpCharge, {
        migrationSessionId: sessionId,
      }),
      this.em.count(MeasureSheetItemOffice, { migrationSessionId: sessionId }),
      this.em.count(MeasureSheetItemAdditionalDetailField, {
        migrationSessionId: sessionId,
      }),
      this.em.count(UpChargeAdditionalDetailField, {
        migrationSessionId: sessionId,
      }),
      this.em.count(UpChargeDisabledOption, { migrationSessionId: sessionId }),
      this.em.count(OptionPrice, { migrationSessionId: sessionId }),
      this.em.count(UpChargePrice, { migrationSessionId: sessionId }),
      this.em.count(MeasureSheetItem, { migrationSessionId: sessionId }),
      this.em.count(PriceGuideOption, { migrationSessionId: sessionId }),
      this.em.count(UpCharge, { migrationSessionId: sessionId }),
      this.em.count(AdditionalDetailField, { migrationSessionId: sessionId }),
      this.em.count(PriceGuideCategory, { migrationSessionId: sessionId }),
    ]);

    stats.junctionsDeleted =
      msiOptionCount +
      msiUpChargeCount +
      msiOfficeCount +
      msiAdditionalDetailCount +
      upChargeAdditionalDetailCount +
      upChargeDisabledOptionCount;
    stats.pricesDeleted = optionPriceCount + upChargePriceCount;
    stats.msisDeleted = msiCount;
    stats.optionsDeleted = optionCount;
    stats.upChargesDeleted = upChargeCount;
    stats.additionalDetailsDeleted = additionalDetailCount;
    stats.categoriesDeleted = categoryCount;

    return stats;
  }
}
