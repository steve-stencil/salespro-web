/**
 * Validation schemas for document template routes.
 */
import { z } from 'zod';

/**
 * Schema for a single document data group (header, body, footer).
 */
const documentDataGroupSchema = z.object({
  objectId: z.string().optional(),
  groupType: z.enum(['header', 'body', 'footer']),
  data: z.array(z.unknown()),
});

/**
 * Schema for the document data JSON payload.
 */
export const documentDataJsonSchema = z.array(documentDataGroupSchema);

/**
 * Schema for the images JSON payload.
 */
export const imagesJsonSchema = z
  .array(
    z.object({
      __type: z.string().optional(),
      name: z.string().optional(),
      url: z.string().optional(),
    }),
  )
  .optional();

/**
 * Schema for category data in upsert.
 */
export const categoryUpsertSchema = z.object({
  /** Category name */
  name: z.string().min(1),
  /** Source category ID from Parse/iOS (optional) */
  sourceCategoryId: z.string().optional(),
  /** Sort order for display */
  sortOrder: z.number().int().default(0),
  /** Whether this is the "Imported" category */
  isImported: z.boolean().default(false),
});

/**
 * Schema for upserting a single document template.
 */
export const documentTemplateUpsertSchema = z.object({
  /** Source system's template ID (for upsert matching) */
  sourceTemplateId: z.string().min(1),

  /** Template type: contract, proposal, etc. */
  type: z.string().min(1),

  /** Page identifier: singlePage, pdfPage, etc. */
  pageId: z.string().min(1),

  /** Category for grouping in selection UI (will be created/matched by name) */
  category: categoryUpsertSchema,

  /** Display name shown in the UI */
  displayName: z.string().min(1),

  /** Sort order within category */
  sortOrder: z.number().int(),

  /** Whether multiple pages can be added */
  canAddMultiplePages: z.boolean().default(false),

  /** Whether this is a template (vs imported document) */
  isTemplate: z.boolean().default(false),

  /** States where this template is available. ['ALL'] means all states. */
  includedStates: z.array(z.string()).default(['ALL']),

  /** States where this template is NOT available */
  excludedStates: z.array(z.string()).default([]),

  /** Office IDs where this template is available. Empty means all offices. */
  includedOfficeIds: z.array(z.string().uuid()).default([]),

  /** Page size string in iOS format: "width,height" */
  pageSizeStr: z.string().min(1),

  /** Page width in points */
  pageWidth: z.number().int().positive(),

  /** Page height in points */
  pageHeight: z.number().int().positive(),

  /** Horizontal margin in points */
  hMargin: z.number().int().nonnegative(),

  /** Vertical/width margin in points */
  wMargin: z.number().int().nonnegative(),

  /** Number of photos per page for photo templates */
  photosPerPage: z.number().int().nonnegative().default(1),

  /** Whether watermark is enabled */
  useWatermark: z.boolean().default(false),

  /** Watermark width as percentage of page */
  watermarkWidthPercent: z.number().nonnegative().default(100),

  /** Watermark transparency (0-1) */
  watermarkAlpha: z.number().min(0).max(1).default(0.05),

  /** Full documentData structure from iOS */
  documentDataJson: documentDataJsonSchema,

  /** Images array from iOS */
  imagesJson: imagesJsonSchema,

  /** Icon background color from iOS: [r, g, b, a] format */
  iconBackgroundColor: z.array(z.number()).length(4).optional(),

  /** Whether this template contains user input sections (computed) */
  hasUserInput: z.boolean().default(false),

  /** Count of signature fields in the template (computed) */
  signatureFieldCount: z.number().int().nonnegative().default(0),

  /** Count of initials fields in the template (computed) */
  initialsFieldCount: z.number().int().nonnegative().default(0),
});

/**
 * Schema for the ingest upsert request body.
 */
export const ingestUpsertRequestSchema = z.object({
  templates: z.array(documentTemplateUpsertSchema).min(1).max(500),
});

/**
 * Schema for asset upload kind parameter.
 */
export const assetKindSchema = z.enum(['pdf', 'icon', 'watermark']);

/**
 * Inferred types from schemas.
 */
export type DocumentTemplateUpsert = z.infer<
  typeof documentTemplateUpsertSchema
>;
export type IngestUpsertRequest = z.infer<typeof ingestUpsertRequestSchema>;
export type AssetKind = z.infer<typeof assetKindSchema>;
