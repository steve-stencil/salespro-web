/**
 * Test data factories for price-guide entities
 */
import { v4 as uuid } from 'uuid';

import {
  PriceGuideCategory,
  PriceGuideOption,
  MeasureSheetItem,
  UpCharge,
  AdditionalDetailField,
  PriceObjectType,
  OfficePriceType,
  OptionPrice,
  UpChargePrice,
  MeasureSheetItemOption,
  MeasureSheetItemUpCharge,
  MeasureSheetItemOffice,
  MeasureSheetItemAdditionalDetailField,
  UpChargeAdditionalDetailField,
  Tag,
  ItemTag,
  File,
  PriceGuideImage,
  Company,
  User,
} from '../../entities';
import {
  AdditionalDetailInputType,
  PARENT_PRICE_TYPE_LABELS,
} from '../../entities/price-guide/types';
import { FileVisibility, FileStatus } from '../../entities/types';

import type { Office } from '../../entities';
import type {
  ParentPriceTypeCode,
  TaggableEntityType,
} from '../../entities/price-guide/types';
import type { EntityManager } from '@mikro-orm/core';

// ============================================================================
// Category Factory
// ============================================================================

export type CreateCategoryOptions = {
  name?: string;
  parent?: PriceGuideCategory;
  depth?: number;
  sortOrder?: number;
  isActive?: boolean;
};

export async function createTestCategory(
  em: EntityManager,
  company: Company,
  options: CreateCategoryOptions = {},
): Promise<PriceGuideCategory> {
  const category = em.create(PriceGuideCategory, {
    id: uuid(),
    company,
    name: options.name ?? `Test Category ${Date.now()}`,
    parent: options.parent,
    depth: options.depth ?? (options.parent ? options.parent.depth + 1 : 0),
    sortOrder: options.sortOrder ?? 0,
    isActive: options.isActive ?? true,
  });
  em.persist(category);
  await em.flush();
  return category;
}

// ============================================================================
// Option Factory
// ============================================================================

export type CreateOptionOptions = {
  name?: string;
  brand?: string;
  itemCode?: string;
  measurementType?: string;
  isActive?: boolean;
  lastModifiedBy?: User;
};

export async function createTestOption(
  em: EntityManager,
  company: Company,
  options: CreateOptionOptions = {},
): Promise<PriceGuideOption> {
  const option = em.create(PriceGuideOption, {
    id: uuid(),
    company,
    name: options.name ?? `Test Option ${Date.now()}`,
    brand: options.brand,
    itemCode: options.itemCode,
    measurementType: options.measurementType,
    searchVector: [options.name, options.brand, options.itemCode]
      .filter(Boolean)
      .join(' '),
    isActive: options.isActive ?? true,
    lastModifiedBy: options.lastModifiedBy,
  });
  em.persist(option);
  await em.flush();
  return option;
}

// ============================================================================
// UpCharge Factory
// ============================================================================

export type CreateUpChargeOptions = {
  name?: string;
  note?: string;
  measurementType?: string;
  identifier?: string;
  isActive?: boolean;
  lastModifiedBy?: User;
};

export async function createTestUpCharge(
  em: EntityManager,
  company: Company,
  options: CreateUpChargeOptions = {},
): Promise<UpCharge> {
  const upCharge = em.create(UpCharge, {
    id: uuid(),
    company,
    name: options.name ?? `Test UpCharge ${Date.now()}`,
    note: options.note,
    measurementType: options.measurementType,
    identifier: options.identifier,
    isActive: options.isActive ?? true,
    lastModifiedBy: options.lastModifiedBy,
  });
  em.persist(upCharge);
  await em.flush();
  return upCharge;
}

// ============================================================================
// Measure Sheet Item Factory
// ============================================================================

export type CreateMeasureSheetItemOptions = {
  name?: string;
  note?: string;
  measurementType?: string;
  sortOrder?: number;
  isActive?: boolean;
  lastModifiedBy?: User;
};

export async function createTestMeasureSheetItem(
  em: EntityManager,
  company: Company,
  category: PriceGuideCategory,
  options: CreateMeasureSheetItemOptions = {},
): Promise<MeasureSheetItem> {
  const name = options.name ?? `Test MSI ${Date.now()}`;
  const msi = em.create(MeasureSheetItem, {
    id: uuid(),
    company,
    category,
    name,
    note: options.note,
    measurementType: options.measurementType ?? 'each',
    sortOrder: options.sortOrder ?? 0,
    searchVector: name,
    isActive: options.isActive ?? true,
    lastModifiedBy: options.lastModifiedBy,
  });
  em.persist(msi);
  await em.flush();
  return msi;
}

// ============================================================================
// Additional Detail Field Factory
// ============================================================================

export type CreateAdditionalDetailFieldOptions = {
  title?: string;
  inputType?: AdditionalDetailInputType;
  isRequired?: boolean;
  pickerValues?: string[];
  isActive?: boolean;
};

export async function createTestAdditionalDetailField(
  em: EntityManager,
  company: Company,
  options: CreateAdditionalDetailFieldOptions = {},
): Promise<AdditionalDetailField> {
  const field = em.create(AdditionalDetailField, {
    id: uuid(),
    company,
    title: options.title ?? `Test Field ${Date.now()}`,
    inputType: options.inputType ?? AdditionalDetailInputType.TEXT,
    isRequired: options.isRequired ?? false,
    pickerValues: options.pickerValues,
    isActive: options.isActive ?? true,
  });
  em.persist(field);
  await em.flush();
  return field;
}

// ============================================================================
// Price Object Type Factory
// ============================================================================

export type CreatePriceTypeOptions = {
  code?: string;
  name?: string;
  parentCode?: ParentPriceTypeCode;
  description?: string;
  sortOrder?: number;
};

/**
 * Create a company-specific price type
 * All price types must belong to a company (no global types)
 */
export async function createTestPriceType(
  em: EntityManager,
  company: Company,
  options: CreatePriceTypeOptions = {},
): Promise<PriceObjectType> {
  const priceType = em.create(PriceObjectType, {
    id: uuid(),
    company,
    code: options.code ?? `TYPE_${Date.now()}`,
    name: options.name ?? `Test Type ${Date.now()}`,
    parentCode: options.parentCode ?? 'OTHER',
    description: options.description,
    sortOrder: options.sortOrder ?? 0,
    isActive: true,
  });
  em.persist(priceType);
  await em.flush();
  return priceType;
}

/**
 * Create default price types for a company (MATERIAL, LABOR, TAX, OTHER)
 * Returns existing types if they already exist to avoid duplicates
 */
export async function createDefaultPriceTypes(
  em: EntityManager,
  company: Company,
): Promise<PriceObjectType[]> {
  const types: Array<{ code: ParentPriceTypeCode; sortOrder: number }> = [
    { code: 'MATERIAL', sortOrder: 1 },
    { code: 'LABOR', sortOrder: 2 },
    { code: 'TAX', sortOrder: 3 },
    { code: 'OTHER', sortOrder: 4 },
  ];

  const priceTypes: PriceObjectType[] = [];
  for (const t of types) {
    // Check if this type already exists for this company
    let pt = await em.findOne(PriceObjectType, {
      code: t.code,
      company: company.id,
    });

    if (!pt) {
      pt = em.create(PriceObjectType, {
        id: uuid(),
        company,
        code: t.code,
        name: PARENT_PRICE_TYPE_LABELS[t.code],
        parentCode: t.code,
        sortOrder: t.sortOrder,
        isActive: true,
      });
      em.persist(pt);
    }
    priceTypes.push(pt);
  }
  await em.flush();
  return priceTypes;
}

/**
 * Assign a price type to an office (creates OfficePriceType junction row)
 */
export async function assignPriceTypeToOffice(
  em: EntityManager,
  priceType: PriceObjectType,
  office: Office,
  sortOrder: number = 0,
): Promise<OfficePriceType> {
  const assignment = em.create(OfficePriceType, {
    id: uuid(),
    office,
    priceType,
    sortOrder,
  });
  em.persist(assignment);
  await em.flush();
  return assignment;
}

/**
 * Create default price types and assign them to an office
 */
export async function createDefaultPriceTypesWithOffice(
  em: EntityManager,
  company: Company,
  office: Office,
): Promise<PriceObjectType[]> {
  const priceTypes = await createDefaultPriceTypes(em, company);

  // Assign all price types to the office
  for (const pt of priceTypes) {
    await assignPriceTypeToOffice(em, pt, office, pt.sortOrder);
  }

  return priceTypes;
}

// ============================================================================
// Option Price Factory
// ============================================================================

export type CreateOptionPriceOptions = {
  amount?: number;
  effectiveDate?: Date;
};

export async function createTestOptionPrice(
  em: EntityManager,
  option: PriceGuideOption,
  office: Office,
  priceType: PriceObjectType,
  options: CreateOptionPriceOptions = {},
): Promise<OptionPrice> {
  const price = em.create(OptionPrice, {
    id: uuid(),
    option,
    office,
    priceType,
    amount: options.amount ?? 0,
    effectiveDate: options.effectiveDate,
  });
  em.persist(price);
  await em.flush();
  return price;
}

// ============================================================================
// UpCharge Price Factory
// ============================================================================

export type CreateUpChargePriceOptions = {
  option?: PriceGuideOption; // null = default price
  amount?: number;
  isPercentage?: boolean;
};

export async function createTestUpChargePrice(
  em: EntityManager,
  upCharge: UpCharge,
  office: Office,
  priceType: PriceObjectType,
  options: CreateUpChargePriceOptions = {},
): Promise<UpChargePrice> {
  const price = em.create(UpChargePrice, {
    id: uuid(),
    upCharge,
    option: options.option,
    office,
    priceType,
    amount: options.amount ?? 0,
    isPercentage: options.isPercentage ?? false,
  });
  em.persist(price);
  await em.flush();
  return price;
}

// ============================================================================
// Link Factories (Junction Tables)
// ============================================================================

export async function linkOptionToMeasureSheetItem(
  em: EntityManager,
  msi: MeasureSheetItem,
  option: PriceGuideOption,
  sortOrder: number = 0,
): Promise<MeasureSheetItemOption> {
  const link = em.create(MeasureSheetItemOption, {
    id: uuid(),
    measureSheetItem: msi,
    option,
    sortOrder,
  });
  em.persist(link);
  await em.flush();
  return link;
}

export async function linkUpChargeToMeasureSheetItem(
  em: EntityManager,
  msi: MeasureSheetItem,
  upCharge: UpCharge,
  sortOrder: number = 0,
): Promise<MeasureSheetItemUpCharge> {
  const link = em.create(MeasureSheetItemUpCharge, {
    id: uuid(),
    measureSheetItem: msi,
    upCharge,
    sortOrder,
  });
  em.persist(link);
  await em.flush();
  return link;
}

export async function linkMeasureSheetItemToOffice(
  em: EntityManager,
  msi: MeasureSheetItem,
  office: Office,
): Promise<MeasureSheetItemOffice> {
  const link = em.create(MeasureSheetItemOffice, {
    id: uuid(),
    measureSheetItem: msi,
    office,
  });
  em.persist(link);
  await em.flush();
  return link;
}

// ============================================================================
// Tag Factory
// ============================================================================

export type CreateTagOptions = {
  name?: string;
  color?: string;
  isActive?: boolean;
};

/**
 * Create a test tag for the given company
 */
export async function createTestTag(
  em: EntityManager,
  company: Company,
  options: CreateTagOptions = {},
): Promise<Tag> {
  const tag = em.create(Tag, {
    id: uuid(),
    company,
    name: options.name ?? `Test Tag ${Date.now()}`,
    color: options.color ?? '#4CAF50',
    isActive: options.isActive ?? true,
  });
  em.persist(tag);
  await em.flush();
  return tag;
}

/**
 * Assign a tag to an entity (Option, UpCharge, AdditionalDetailField)
 */
export async function assignTagToEntity(
  em: EntityManager,
  tag: Tag,
  entityType: TaggableEntityType,
  entityId: string,
): Promise<ItemTag> {
  const itemTag = em.create(ItemTag, {
    id: uuid(),
    tag,
    entityType,
    entityId,
  });
  em.persist(itemTag);
  await em.flush();
  return itemTag;
}

// ============================================================================
// Complete Setup Factory
// ============================================================================

export type PriceGuideSetup = {
  category: PriceGuideCategory;
  options: PriceGuideOption[];
  upCharges: UpCharge[];
  msi: MeasureSheetItem;
  priceTypes: PriceObjectType[];
};

/**
 * Create a complete price guide setup for testing
 */
export async function createPriceGuideSetup(
  em: EntityManager,
  company: Company,
  office: Office,
): Promise<PriceGuideSetup> {
  // Create price types and assign to office
  const priceTypes = await createDefaultPriceTypesWithOffice(
    em,
    company,
    office,
  );

  // Create category
  const category = await createTestCategory(em, company, {
    name: 'Windows',
  });

  // Create options
  const options: PriceGuideOption[] = [];
  for (let i = 0; i < 3; i++) {
    const option = await createTestOption(em, company, {
      name: `Window Option ${i + 1}`,
      brand: `Brand ${i + 1}`,
      itemCode: `WIN-${i + 1}`,
    });
    options.push(option);

    // Add pricing for each price type
    for (const pt of priceTypes) {
      await createTestOptionPrice(em, option, office, pt, {
        amount: (i + 1) * 100 + pt.sortOrder * 10,
      });
    }
  }

  // Create upcharges
  const upCharges: UpCharge[] = [];
  for (let i = 0; i < 2; i++) {
    const upCharge = await createTestUpCharge(em, company, {
      name: `UpCharge ${i + 1}`,
      note: `Test upcharge ${i + 1}`,
    });
    upCharges.push(upCharge);

    // Add default pricing
    for (const pt of priceTypes) {
      await createTestUpChargePrice(em, upCharge, office, pt, {
        amount: (i + 1) * 50 + pt.sortOrder * 5,
      });
    }
  }

  // Create MSI
  const msi = await createTestMeasureSheetItem(em, company, category, {
    name: 'Double Hung Window',
    note: 'Standard double hung window',
    measurementType: 'United Inches',
  });

  // Link options and upcharges to MSI
  for (const [i, option] of options.entries()) {
    await linkOptionToMeasureSheetItem(em, msi, option, i);
  }
  for (const [i, upCharge] of upCharges.entries()) {
    await linkUpChargeToMeasureSheetItem(em, msi, upCharge, i);
  }

  return {
    category,
    options,
    upCharges,
    msi,
    priceTypes,
  };
}

// ============================================================================
// File Factory (for PriceGuideImage support)
// ============================================================================

export type CreateFileOptions = {
  filename?: string;
  mimeType?: string;
  size?: number;
  storageKey?: string;
  thumbnailKey?: string;
  visibility?: FileVisibility;
  status?: FileStatus;
};

/**
 * Create a test File entity (mock file without actual S3 upload)
 */
export async function createTestFile(
  em: EntityManager,
  company: Company,
  uploadedBy: User,
  options: CreateFileOptions = {},
): Promise<File> {
  const fileId = uuid();
  // Get references in current EM context to avoid cross-EM issues
  const companyRef = em.getReference(Company, company.id);
  const userRef = em.getReference(User, uploadedBy.id);

  const file = em.create(File, {
    id: fileId,
    company: companyRef,
    uploadedBy: userRef,
    filename: options.filename ?? `test-image-${Date.now()}.jpg`,
    mimeType: options.mimeType ?? 'image/jpeg',
    size: options.size ?? 1024,
    storageKey: options.storageKey ?? `${company.id}/files/${fileId}.jpg`,
    thumbnailKey:
      options.thumbnailKey ?? `${company.id}/thumbnails/${fileId}_thumb.jpg`,
    visibility: options.visibility ?? FileVisibility.COMPANY,
    status: options.status ?? FileStatus.ACTIVE,
  });
  em.persist(file);
  await em.flush();
  return file;
}

// ============================================================================
// PriceGuideImage Factory
// ============================================================================

export type CreatePriceGuideImageOptions = {
  name?: string;
  description?: string;
  isActive?: boolean;
  lastModifiedBy?: User;
};

/**
 * Create a test PriceGuideImage with an associated File entity
 */
export async function createTestPriceGuideImage(
  em: EntityManager,
  company: Company,
  uploadedBy: User,
  options: CreatePriceGuideImageOptions = {},
): Promise<PriceGuideImage> {
  // First create the underlying file
  const file = await createTestFile(em, company, uploadedBy);

  const name = options.name ?? `Test Image ${Date.now()}`;
  const image = em.create(PriceGuideImage, {
    id: uuid(),
    company,
    file,
    name,
    description: options.description,
    searchVector: [name, options.description].filter(Boolean).join(' '),
    isActive: options.isActive ?? true,
    lastModifiedBy: options.lastModifiedBy,
  });
  em.persist(image);
  await em.flush();
  return image;
}

// ============================================================================
// Thumbnail Image Setter
// ============================================================================

/**
 * Set a PriceGuideImage as thumbnail for a MeasureSheetItem
 */
export async function setMsiThumbnail(
  em: EntityManager,
  msi: MeasureSheetItem,
  image: PriceGuideImage,
): Promise<void> {
  msi.thumbnailImage = image;
  await em.flush();
}

// ============================================================================
// UpCharge Additional Detail Field Factory
// ============================================================================

/**
 * Link an additional detail field to an upcharge
 */
export async function linkAdditionalDetailToUpCharge(
  em: EntityManager,
  upCharge: UpCharge,
  additionalDetailField: AdditionalDetailField,
  sortOrder: number = 0,
): Promise<UpChargeAdditionalDetailField> {
  const link = em.create(UpChargeAdditionalDetailField, {
    id: uuid(),
    upCharge,
    additionalDetailField,
    sortOrder,
  });
  em.persist(link);
  await em.flush();
  return link;
}

/**
 * Link an additional detail field to a measure sheet item
 */
export async function linkAdditionalDetailToMeasureSheetItem(
  em: EntityManager,
  msi: MeasureSheetItem,
  additionalDetailField: AdditionalDetailField,
  sortOrder: number = 0,
): Promise<MeasureSheetItemAdditionalDetailField> {
  const link = em.create(MeasureSheetItemAdditionalDetailField, {
    id: uuid(),
    measureSheetItem: msi,
    additionalDetailField,
    sortOrder,
  });
  em.persist(link);
  await em.flush();
  return link;
}
