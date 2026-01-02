/**
 * Price Guide ETL Service
 *
 * Service for importing price guide data from legacy MongoDB
 * into the new database schema. Handles:
 * - Categories (from CustomConfig.categories_ and MSI paths)
 * - MeasureSheetItems (SSMeasureSheetItem)
 * - Options (SSPriceGuideItem where isAccessory=false)
 * - UpCharges (SSPriceGuideItem where isAccessory=true)
 * - AdditionalDetailFields (embedded in MSIs and UpCharges)
 * - Pricing (itemPrices, accessoryPrices)
 *
 * All queries are scoped by company ID to ensure data isolation.
 */

import { generateKeyBetween } from 'fractional-indexing';

import {
  AdditionalDetailField,
  Company,
  MeasureSheetItem,
  MeasureSheetItemAdditionalDetailField,
  MeasureSheetItemOffice,
  MeasureSheetItemOption,
  MeasureSheetItemUpCharge,
  MigrationSession,
  MigrationSessionStatus,
  Office,
  OptionPrice,
  PriceGuideCategory,
  PriceGuideOption,
  PriceObjectType,
  QuantityMode,
  UpCharge,
  UpChargeAdditionalDetailField,
  UpChargeDisabledOption,
  UpChargePrice,
  User,
} from '../../entities';

import {
  buildCategoryHierarchy,
  flattenCategoryHierarchy,
  getCategoryPath,
} from './builders';
import { FormulaEvaluatorService } from './formula-evaluator.service';
import { transformAdditionalDetail } from './mappers';
import {
  countCategories,
  queryCategories,
} from './queries/custom-config.queries';
import {
  countMSIs,
  queryAllMSIs,
  queryMSIs,
} from './queries/measure-sheet-item.queries';
import {
  countOptions,
  countUpCharges,
  queryOptions,
  queryUpCharges,
} from './queries/price-guide-item.queries';
import { getSourceCompanyIdByEmail } from './queries/user.queries';
import { isSourceConfigured } from './source-client';
import { EtlErrorCode, EtlServiceError } from './types';

import type {
  BaseEtlService,
  BatchImportOptions,
  FetchSourceResult,
  LegacyAdditionalDetailObject,
  PriceGuideBatchImportOptions,
  PriceGuideBatchImportResult,
  RawSourceMSI,
} from './types';
import type { EntityManager } from '@mikro-orm/core';

/**
 * Batch size for importing entities.
 */
const IMPORT_BATCH_SIZE = 100;

/**
 * Price Guide ETL Service.
 *
 * Implements BaseEtlService for consistent API across collections.
 * Coordinates the full import process:
 * 1. Fetch categories from CustomConfig
 * 2. Build category hierarchy from MSI paths
 * 3. Import AdditionalDetailFields
 * 4. Import Options with pricing
 * 5. Import UpCharges with pricing
 * 6. Import MSIs with all relationships
 * 7. Transform formulas (legacy ID -> UUID)
 */
export class PriceGuideEtlService implements BaseEtlService {
  private sourceCompanyId: string | null = null;
  private readonly formulaEvaluator: FormulaEvaluatorService;

  constructor(private readonly em: EntityManager) {
    this.formulaEvaluator = new FormulaEvaluatorService();
  }

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
   * Fetch source items (MSIs) from legacy database for preview.
   * Scoped by the initialized source company.
   */
  async fetchSourceItems(skip = 0, limit = 100): Promise<FetchSourceResult> {
    const sourceCompanyId = this.requireSourceCompanyId();
    const result = await queryMSIs(sourceCompanyId, skip, limit);
    return {
      items: result.items,
      total: result.total,
    };
  }

  /**
   * Get total MSI count from source, scoped by company.
   */
  async getSourceCount(): Promise<number> {
    const sourceCompanyId = this.requireSourceCompanyId();
    return countMSIs(sourceCompanyId);
  }

  /**
   * Get counts for all price guide entities.
   */
  async getSourceCounts(): Promise<{
    categories: number;
    msis: number;
    options: number;
    upCharges: number;
  }> {
    const sourceCompanyId = this.requireSourceCompanyId();

    const [categories, msis, options, upCharges] = await Promise.all([
      countCategories(sourceCompanyId),
      countMSIs(sourceCompanyId),
      countOptions(sourceCompanyId),
      countUpCharges(sourceCompanyId),
    ]);

    return { categories, msis, options, upCharges };
  }

  /**
   * Create a new migration session for price guide import.
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

    const counts = await this.getSourceCounts();
    const totalCount =
      counts.categories + counts.msis + counts.options + counts.upCharges;

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
   * Import a batch of price guide data.
   * This method handles the full import process in batches.
   */
  async importBatch(
    options: BatchImportOptions,
  ): Promise<PriceGuideBatchImportResult> {
    const priceGuideOptions: PriceGuideBatchImportOptions = {
      ...options,
      includeImages: false,
      validateFormulas: true,
    };

    return this.importPriceGuideBatch(priceGuideOptions);
  }

  /**
   * Import price guide data with full options.
   */
  async importPriceGuideBatch(
    options: PriceGuideBatchImportOptions,
  ): Promise<PriceGuideBatchImportResult> {
    const { companyId, sessionId } = options;

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

    const sourceCompanyId = session.sourceCompanyId;
    this.setSourceCompanyId(sourceCompanyId);

    const result: PriceGuideBatchImportResult = {
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      hasMore: false,
      categoriesImported: 0,
      msisImported: 0,
      optionsImported: 0,
      upChargesImported: 0,
      additionalDetailsImported: 0,
      formulaWarnings: [],
    };

    try {
      // Step 1: Import categories (only once, at the start)
      if (session.importedCount === 0) {
        const categoryResult = await this.importCategories(
          sourceCompanyId,
          companyId,
          sessionId,
        );
        result.categoriesImported = categoryResult.count;
        result.importedCount += categoryResult.count;
        session.importedCount += categoryResult.count;
      }

      // Step 2: Import options in batches
      const optionResult = await this.importOptions(
        sourceCompanyId,
        companyId,
        sessionId,
        options.skip,
        IMPORT_BATCH_SIZE,
      );
      result.optionsImported = optionResult.imported;
      result.importedCount += optionResult.imported;
      result.skippedCount += optionResult.skipped;
      session.importedCount += optionResult.imported;
      session.skippedCount += optionResult.skipped;

      // Step 3: Import upcharges in batches
      const upChargeResult = await this.importUpCharges(
        sourceCompanyId,
        companyId,
        sessionId,
        options.skip,
        IMPORT_BATCH_SIZE,
      );
      result.upChargesImported = upChargeResult.imported;
      result.additionalDetailsImported += upChargeResult.additionalDetails;
      result.importedCount += upChargeResult.imported;
      result.skippedCount += upChargeResult.skipped;
      session.importedCount += upChargeResult.imported;
      session.skippedCount += upChargeResult.skipped;

      // Step 4: Import MSIs in batches
      const msiResult = await this.importMSIs(
        sourceCompanyId,
        companyId,
        sessionId,
        options.skip,
        IMPORT_BATCH_SIZE,
        options.validateFormulas ?? true,
      );
      result.msisImported = msiResult.imported;
      result.additionalDetailsImported += msiResult.additionalDetails;
      result.importedCount += msiResult.imported;
      result.skippedCount += msiResult.skipped;
      result.formulaWarnings = msiResult.formulaWarnings;
      session.importedCount += msiResult.imported;
      session.skippedCount += msiResult.skipped;

      // Determine if there's more to import
      result.hasMore =
        msiResult.hasMore || optionResult.hasMore || upChargeResult.hasMore;

      // Check if import is complete
      if (!result.hasMore) {
        session.status = MigrationSessionStatus.COMPLETED;
        session.completedAt = new Date();
      }

      // Merge errors
      for (const err of msiResult.errors) {
        result.errors.push(err);
        session.errors.push({
          sourceId: err.sourceId,
          error: err.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errorCount++;
      session.errorCount++;
      result.errors.push({ sourceId: 'batch', error: errorMessage });
      session.errors.push({
        sourceId: 'batch',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }

    await this.em.flush();
    return result;
  }

  /**
   * Import categories from CustomConfig and MSI paths.
   */
  private async importCategories(
    sourceCompanyId: string,
    companyId: string,
    sessionId: string,
  ): Promise<{ count: number }> {
    // Fetch root categories from CustomConfig
    const rootCategories = await queryCategories(sourceCompanyId);

    // Fetch all MSIs to build full hierarchy (paginated)
    const allMsis: RawSourceMSI[] = [];
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const batch = await queryAllMSIs(sourceCompanyId, skip, 500);
      allMsis.push(...batch.items);
      hasMore = batch.items.length === 500;
      skip += 500;
    }

    // Build category hierarchy
    const hierarchy = buildCategoryHierarchy(rootCategories, allMsis);
    const flatCategories = flattenCategoryHierarchy(hierarchy);

    // Create categories in database
    const categoryMap = new Map<string, PriceGuideCategory>();
    let count = 0;

    for (const cat of flatCategories) {
      // Check if already exists
      const existing = await this.em.findOne(PriceGuideCategory, {
        company: companyId,
        name: cat.name,
        depth: cat.depth,
        sourceId: cat.sourceId ?? undefined,
      });

      if (existing) {
        categoryMap.set(cat.path.join('>'), existing);
        continue;
      }

      const category = new PriceGuideCategory();
      category.company = this.em.getReference(Company, companyId);
      category.name = cat.name;
      category.categoryType = cat.categoryType;
      category.sortOrder = cat.sortOrder;
      category.depth = cat.depth;
      category.sourceId = cat.sourceId;
      category.migrationSessionId = sessionId;

      // Set parent if not root
      if (cat.path.length > 1) {
        const parentPath = cat.path.slice(0, -1).join('>');
        const parent = categoryMap.get(parentPath);
        if (parent) {
          category.parent = parent;
        }
      }

      this.em.persist(category);
      categoryMap.set(cat.path.join('>'), category);
      count++;
    }

    await this.em.flush();
    return { count };
  }

  /**
   * Import options from SSPriceGuideItem.
   */
  private async importOptions(
    sourceCompanyId: string,
    companyId: string,
    sessionId: string,
    skip: number,
    limit: number,
  ): Promise<{ imported: number; skipped: number; hasMore: boolean }> {
    const { items, total } = await queryOptions(sourceCompanyId, skip, limit);

    let imported = 0;
    let skipped = 0;

    // Get first price type for this company (sorted by sortOrder)
    const defaultPriceType = await this.em.findOne(
      PriceObjectType,
      { company: companyId, isActive: true },
      { orderBy: { sortOrder: 'ASC' } },
    );

    // Get office mapping (sourceId -> entity)
    const officeMap = await this.getOfficeMap(companyId);

    for (const raw of items) {
      // Check if already exists
      const existing = await this.em.findOne(PriceGuideOption, {
        company: companyId,
        sourceId: raw.objectId,
      });

      if (existing) {
        skipped++;
        continue;
      }

      const option = new PriceGuideOption();
      option.company = this.em.getReference(Company, companyId);
      option.name = raw.displayTitle ?? 'Unknown Option';
      option.sourceId = raw.objectId;
      option.migrationSessionId = sessionId;

      // Extract item code from itemCodes if available
      if (raw.itemCodes && Object.keys(raw.itemCodes).length > 0) {
        option.itemCode = Object.values(raw.itemCodes)[0];
      }

      this.em.persist(option);

      // Create prices from itemPrices
      if (raw.itemPrices && defaultPriceType) {
        for (const priceEntry of raw.itemPrices) {
          const office = officeMap.get(priceEntry.officeId);
          if (!office) continue;

          const price = new OptionPrice();
          price.option = option;
          price.office = office;
          price.priceType = defaultPriceType;
          price.amount = priceEntry.total;
          price.migrationSessionId = sessionId;

          this.em.persist(price);
        }
      }

      imported++;
    }

    await this.em.flush();

    return {
      imported,
      skipped,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Import upcharges from SSPriceGuideItem.
   */
  private async importUpCharges(
    sourceCompanyId: string,
    companyId: string,
    sessionId: string,
    skip: number,
    limit: number,
  ): Promise<{
    imported: number;
    skipped: number;
    additionalDetails: number;
    hasMore: boolean;
  }> {
    const { items, total } = await queryUpCharges(sourceCompanyId, skip, limit);

    let imported = 0;
    let skipped = 0;
    let additionalDetails = 0;

    // Get office mapping and option mapping
    const officeMap = await this.getOfficeMap(companyId);
    const optionMap = await this.getOptionMap(companyId);

    // Get first price type for this company (sorted by sortOrder)
    const defaultPriceType = await this.em.findOne(
      PriceObjectType,
      { company: companyId, isActive: true },
      { orderBy: { sortOrder: 'ASC' } },
    );

    for (const raw of items) {
      // Check if already exists
      const existing = await this.em.findOne(UpCharge, {
        company: companyId,
        sourceId: raw.objectId,
      });

      if (existing) {
        skipped++;
        continue;
      }

      const upCharge = new UpCharge();
      upCharge.company = this.em.getReference(Company, companyId);
      upCharge.name = raw.name ?? 'Unknown UpCharge';
      upCharge.note = raw.info;
      upCharge.identifier = raw.identifier;
      upCharge.sourceId = raw.objectId;
      upCharge.migrationSessionId = sessionId;

      this.em.persist(upCharge);

      // Import additional detail fields linked to this upcharge
      if (raw.additionalDetails) {
        additionalDetails += await this.importAdditionalDetails(
          raw.additionalDetails,
          companyId,
          sessionId,
          upCharge,
        );
      }

      // Create disabled option links
      if (raw.disabledParents) {
        for (const disabledOptionSourceId of raw.disabledParents) {
          const option = optionMap.get(disabledOptionSourceId);
          if (!option) continue;

          const disabledOption = new UpChargeDisabledOption();
          disabledOption.upCharge = upCharge;
          disabledOption.option = option;
          disabledOption.migrationSessionId = sessionId;

          this.em.persist(disabledOption);
        }
      }

      // Create prices from accessoryPrices
      if (raw.accessoryPrices && defaultPriceType) {
        for (const accessoryPrice of raw.accessoryPrices) {
          const option = optionMap.get(accessoryPrice.priceGuideItemId);

          for (const itemTotal of accessoryPrice.itemTotals) {
            const office = officeMap.get(itemTotal.officeId);
            if (!office) continue;

            const price = new UpChargePrice();
            price.upCharge = upCharge;
            price.office = office;
            price.priceType = defaultPriceType;
            price.amount = itemTotal.total;
            price.isPercentage = raw.percentagePrice ?? false;
            price.migrationSessionId = sessionId;

            // Link to specific option if this is an override
            if (option) {
              price.option = option;
            }

            this.em.persist(price);
          }
        }
      }

      imported++;
    }

    await this.em.flush();

    return {
      imported,
      skipped,
      additionalDetails,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Import MSIs from SSMeasureSheetItem.
   */
  private async importMSIs(
    sourceCompanyId: string,
    companyId: string,
    sessionId: string,
    skip: number,
    limit: number,
    validateFormulas: boolean,
  ): Promise<{
    imported: number;
    skipped: number;
    additionalDetails: number;
    hasMore: boolean;
    errors: Array<{ sourceId: string; error: string }>;
    formulaWarnings: Array<{ msiSourceId: string; unresolvedRefs: string[] }>;
  }> {
    const { items, total } = await queryAllMSIs(sourceCompanyId, skip, limit);

    let imported = 0;
    let skipped = 0;
    let additionalDetails = 0;
    const errors: Array<{ sourceId: string; error: string }> = [];
    const formulaWarnings: Array<{
      msiSourceId: string;
      unresolvedRefs: string[];
    }> = [];

    // Get mappings
    const categoryMap = await this.getCategoryMap(companyId);
    const officeMap = await this.getOfficeMap(companyId);
    const optionMap = await this.getOptionMap(companyId);
    const upChargeMap = await this.getUpChargeMap(companyId);
    const formulaIdMapping = await this.getFormulaIdMapping(companyId);

    // Track sort order per category
    const lastSortOrder = new Map<string, string>();

    for (const raw of items) {
      try {
        // Check if already exists
        const existing = await this.em.findOne(MeasureSheetItem, {
          company: companyId,
          sourceId: raw.objectId,
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Find category
        const categoryPath = getCategoryPath(raw);
        const categoryKey = categoryPath.join('>');
        const category = categoryMap.get(categoryKey);

        if (!category) {
          errors.push({
            sourceId: raw.objectId,
            error: `Category not found: ${categoryKey}`,
          });
          continue;
        }

        // Generate sort order
        const lastKey = lastSortOrder.get(categoryKey) ?? null;
        const sortOrder = generateKeyBetween(lastKey, null);
        lastSortOrder.set(categoryKey, sortOrder);

        const msi = new MeasureSheetItem();
        msi.company = this.em.getReference(Company, companyId);
        msi.category = category;
        msi.name = raw.itemName ?? 'Unknown Item';
        msi.note = raw.itemNote;
        msi.measurementType = raw.measurementType ?? 'each';
        msi.formulaId = raw.formulaID;
        msi.defaultQty = raw.defaultQty ?? 1;
        msi.showSwitch = raw.shouldShowSwitch ?? false;
        msi.sortOrder = sortOrder;
        msi.sourceId = raw.objectId;
        msi.migrationSessionId = sessionId;

        // Handle formula transformation
        if (raw.qtyFormula) {
          const { formula, unresolvedRefs } =
            this.formulaEvaluator.transformFormula(
              raw.qtyFormula,
              formulaIdMapping,
            );
          msi.qtyFormula = formula;
          msi.quantityMode = QuantityMode.FORMULA;

          if (validateFormulas && unresolvedRefs.length > 0) {
            formulaWarnings.push({
              msiSourceId: raw.objectId,
              unresolvedRefs,
            });
          }
        }

        this.em.persist(msi);

        // Link to offices
        if (raw.includedOffices) {
          for (const officeRef of raw.includedOffices) {
            const office = officeMap.get(officeRef.objectId);
            if (!office) continue;

            const msiOffice = new MeasureSheetItemOffice();
            msiOffice.measureSheetItem = msi;
            msiOffice.office = office;
            msiOffice.migrationSessionId = sessionId;

            this.em.persist(msiOffice);
          }
        }

        // Link to options
        if (raw.items) {
          let optionSortOrder = 0;
          for (const optionRef of raw.items) {
            const option = optionMap.get(optionRef.objectId);
            if (!option) continue;

            const msiOption = new MeasureSheetItemOption();
            msiOption.measureSheetItem = msi;
            msiOption.option = option;
            msiOption.sortOrder = optionSortOrder++;
            msiOption.migrationSessionId = sessionId;

            this.em.persist(msiOption);
          }
        }

        // Link to upcharges
        if (raw.accessories) {
          let upChargeSortOrder = 0;
          for (const upChargeRef of raw.accessories) {
            const upCharge = upChargeMap.get(upChargeRef.objectId);
            if (!upCharge) continue;

            const msiUpCharge = new MeasureSheetItemUpCharge();
            msiUpCharge.measureSheetItem = msi;
            msiUpCharge.upCharge = upCharge;
            msiUpCharge.sortOrder = upChargeSortOrder++;
            msiUpCharge.migrationSessionId = sessionId;

            this.em.persist(msiUpCharge);
          }
        }

        // Import additional detail fields
        if (raw.additionalDetailObjects) {
          additionalDetails += await this.importAdditionalDetails(
            raw.additionalDetailObjects,
            companyId,
            sessionId,
            undefined,
            msi,
          );
        }

        imported++;
      } catch (error) {
        errors.push({
          sourceId: raw.objectId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.em.flush();

    return {
      imported,
      skipped,
      additionalDetails,
      hasMore: skip + limit < total,
      errors,
      formulaWarnings,
    };
  }

  /**
   * Import additional detail fields and link to parent entity.
   */
  private async importAdditionalDetails(
    legacyDetails: LegacyAdditionalDetailObject[],
    companyId: string,
    sessionId: string,
    upCharge?: UpCharge,
    msi?: MeasureSheetItem,
  ): Promise<number> {
    let count = 0;

    for (const legacy of legacyDetails) {
      // Check if additional detail field already exists
      let field = await this.em.findOne(AdditionalDetailField, {
        company: companyId,
        sourceId: legacy.objectId,
      });

      if (!field) {
        // Transform and create new field
        const transformed = transformAdditionalDetail(legacy);

        field = new AdditionalDetailField();
        field.company = this.em.getReference(Company, companyId);
        field.title = transformed.title;
        field.inputType = transformed.inputType;
        field.cellType = transformed.cellType;
        field.placeholder = transformed.placeholder;
        field.note = transformed.note;
        field.defaultValue = transformed.defaultValue;
        field.isRequired = transformed.isRequired;
        field.shouldCopy = transformed.shouldCopy;
        field.pickerValues = transformed.pickerValues;
        field.sizePickerConfig = transformed.sizePickerConfig;
        field.unitedInchConfig = transformed.unitedInchConfig;
        field.photoConfig = transformed.photoConfig;
        field.allowDecimal = transformed.allowDecimal;
        field.dateDisplayFormat = transformed.dateDisplayFormat;
        field.notAddedReplacement = transformed.notAddedReplacement;
        field.sourceId = legacy.objectId;
        field.migrationSessionId = sessionId;

        this.em.persist(field);
        count++;
      }

      // Create junction link
      if (upCharge) {
        const link = new UpChargeAdditionalDetailField();
        link.upCharge = upCharge;
        link.additionalDetailField = field;
        link.sortOrder = count;
        link.migrationSessionId = sessionId;

        this.em.persist(link);
      } else if (msi) {
        const link = new MeasureSheetItemAdditionalDetailField();
        link.measureSheetItem = msi;
        link.additionalDetailField = field;
        // MeasureSheetItemAdditionalDetailField uses string sortOrder (fractional indexing)
        link.sortOrder = generateKeyBetween(null, null);
        link.migrationSessionId = sessionId;

        this.em.persist(link);
      }
    }

    return count;
  }

  /**
   * Get office mapping (sourceId -> entity reference).
   */
  private async getOfficeMap(companyId: string): Promise<Map<string, Office>> {
    const offices = await this.em.find(
      Office,
      { company: companyId },
      { fields: ['id', 'sourceId'] },
    );

    const map = new Map<string, Office>();
    for (const office of offices) {
      if (office.sourceId) {
        // Use getReference to get a proper entity reference for relationships
        map.set(office.sourceId, this.em.getReference(Office, office.id));
      }
    }
    return map;
  }

  /**
   * Get option mapping (sourceId -> entity reference).
   */
  private async getOptionMap(
    companyId: string,
  ): Promise<Map<string, PriceGuideOption>> {
    const options = await this.em.find(
      PriceGuideOption,
      { company: companyId },
      { fields: ['id', 'sourceId'] },
    );

    const map = new Map<string, PriceGuideOption>();
    for (const option of options) {
      if (option.sourceId) {
        // Use getReference to get a proper entity reference for relationships
        map.set(
          option.sourceId,
          this.em.getReference(PriceGuideOption, option.id),
        );
      }
    }
    return map;
  }

  /**
   * Get upcharge mapping (sourceId -> entity reference).
   */
  private async getUpChargeMap(
    companyId: string,
  ): Promise<Map<string, UpCharge>> {
    const upCharges = await this.em.find(
      UpCharge,
      { company: companyId },
      { fields: ['id', 'sourceId'] },
    );

    const map = new Map<string, UpCharge>();
    for (const upCharge of upCharges) {
      if (upCharge.sourceId) {
        // Use getReference to get a proper entity reference for relationships
        map.set(upCharge.sourceId, this.em.getReference(UpCharge, upCharge.id));
      }
    }
    return map;
  }

  /**
   * Get category mapping (path -> entity).
   */
  private async getCategoryMap(
    companyId: string,
  ): Promise<Map<string, PriceGuideCategory>> {
    const categories = await this.em.find(
      PriceGuideCategory,
      { company: companyId },
      { populate: ['parent'] },
    );

    const map = new Map<string, PriceGuideCategory>();

    // Build path for each category
    for (const category of categories) {
      const path = this.buildCategoryPath(category, categories);
      map.set(path.join('>'), category);
    }

    return map;
  }

  /**
   * Build full path from root to category.
   */
  private buildCategoryPath(
    category: PriceGuideCategory,
    allCategories: PriceGuideCategory[],
  ): string[] {
    const path: string[] = [category.name];
    let current: PriceGuideCategory | undefined = category;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (current?.parent) {
      const parentRef: PriceGuideCategory = current.parent;
      const parentId: string = parentRef.id;
      const parent: PriceGuideCategory | undefined = allCategories.find(
        c => c.id === parentId,
      );
      if (parent) {
        path.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }

    return path;
  }

  /**
   * Get formula ID mapping for transforming legacy formulas.
   */
  private async getFormulaIdMapping(
    companyId: string,
  ): Promise<Map<string, string>> {
    const msis = await this.em.find(
      MeasureSheetItem,
      { company: companyId },
      { fields: ['id', 'sourceId', 'formulaId'] },
    );

    return this.formulaEvaluator.buildFormulaIdMapping(msis);
  }
}
