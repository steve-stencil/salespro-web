import { Router } from 'express';
import { z } from 'zod';

import {
  PriceObjectType,
  OfficePriceType,
  Company,
  Office,
  PARENT_PRICE_TYPE_CODES,
  PARENT_PRICE_TYPE_LABELS,
} from '../../../entities';
import { getORM } from '../../../lib/db';
import { PERMISSIONS } from '../../../lib/permissions';
import { requireAuth, requirePermission } from '../../../middleware';

import type { User, ParentPriceTypeCode } from '../../../entities';
import type { AuthenticatedRequest } from '../../../middleware/requireAuth';
import type { EntityManager } from '@mikro-orm/postgresql';
import type { Request, Response, Router as RouterType } from 'express';

const router: RouterType = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const parentCodeSchema = z.enum(
  PARENT_PRICE_TYPE_CODES as unknown as [string, ...string[]],
);

const createPriceTypeSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  name: z.string().min(1).max(255),
  parentCode: parentCodeSchema,
  description: z.string().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const updatePriceTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentCode: parentCodeSchema.optional(),
  description: z.string().max(1000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const generatePriceTypesSchema = z.object({
  parentCodes: z.array(parentCodeSchema).min(1),
  officeIds: z.array(z.string().uuid()).min(1),
});

const officeAssignmentSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

function getCompanyContext(
  req: Request,
): { user: User; company: Company } | null {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  const company = authReq.companyContext;
  return user && company ? { user, company } : null;
}

// ============================================================================
// Price Type Routes (Company Level)
// ============================================================================

/**
 * GET /price-guide/pricing/price-types
 * List all company price types
 */
router.get(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Get company's price types with office assignments
      const priceTypes = await em.find(
        PriceObjectType,
        {
          company: company.id,
          isActive: true,
        },
        {
          orderBy: { sortOrder: 'ASC', name: 'ASC' },
          populate: ['officeAssignments', 'officeAssignments.office'],
        },
      );

      // Get office count for the company
      const offices = await em.find(Office, { company: company.id });
      const totalOffices = offices.length;

      res.status(200).json({
        priceTypes: priceTypes.map(pt => {
          const assignments = pt.officeAssignments.getItems();
          return {
            id: pt.id,
            code: pt.code,
            name: pt.name,
            parentCode: pt.parentCode,
            parentLabel: PARENT_PRICE_TYPE_LABELS[pt.parentCode],
            description: pt.description,
            sortOrder: pt.sortOrder,
            isActive: pt.isActive,
            officeCount: assignments.length,
            totalOffices,
            /** Office IDs where this price type is enabled (row exists = enabled) */
            enabledOfficeIds: assignments.map(a => a.office.id),
            createdAt: pt.createdAt,
            updatedAt: pt.updatedAt,
          };
        }),
        parentCodes: PARENT_PRICE_TYPE_CODES.map(code => ({
          code,
          label: PARENT_PRICE_TYPE_LABELS[code],
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'List price types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /price-guide/pricing/price-types/:id
 * Get a specific price type with office assignments
 */
router.get(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Price type ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const priceType = await em.findOne(
        PriceObjectType,
        {
          id,
          company: company.id,
        },
        { populate: ['officeAssignments', 'officeAssignments.office'] },
      );

      if (!priceType) {
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      res.status(200).json({
        priceType: {
          id: priceType.id,
          code: priceType.code,
          name: priceType.name,
          parentCode: priceType.parentCode,
          parentLabel: PARENT_PRICE_TYPE_LABELS[priceType.parentCode],
          description: priceType.description,
          sortOrder: priceType.sortOrder,
          isActive: priceType.isActive,
          createdAt: priceType.createdAt,
          updatedAt: priceType.updatedAt,
          officeAssignments: priceType.officeAssignments.getItems().map(a => ({
            id: a.id,
            officeId: a.office.id,
            officeName: a.office.name,
            sortOrder: a.sortOrder,
          })),
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Get price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/pricing/price-types
 * Create a new price type
 */
router.post(
  '/',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const parseResult = createPriceTypeSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const data = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Check for duplicate code within company
      const existing = await em.findOne(PriceObjectType, {
        company: company.id,
        code: data.code,
        isActive: true,
      });

      if (existing) {
        res.status(409).json({
          error: 'A price type with this code already exists',
          existingCode: existing.code,
        });
        return;
      }

      // Get max sort order if not provided
      if (data.sortOrder === undefined) {
        const existingTypes = await em.find(
          PriceObjectType,
          { company: company.id, isActive: true },
          { orderBy: { sortOrder: 'DESC' }, limit: 1 },
        );
        const firstType = existingTypes[0];
        const maxSort = firstType ? firstType.sortOrder : 0;
        data.sortOrder = maxSort + 1;
      }

      const priceType = new PriceObjectType();
      priceType.company = em.getReference(Company, company.id);
      priceType.code = data.code;
      priceType.name = data.name;
      priceType.parentCode = data.parentCode as ParentPriceTypeCode;
      priceType.description = data.description;
      priceType.sortOrder = data.sortOrder;

      await em.persistAndFlush(priceType);

      req.log.info(
        {
          priceTypeId: priceType.id,
          code: priceType.code,
          parentCode: priceType.parentCode,
          userId: context.user.id,
        },
        'Price type created',
      );

      res.status(201).json({
        message: 'Price type created successfully',
        priceType: {
          id: priceType.id,
          code: priceType.code,
          name: priceType.name,
          parentCode: priceType.parentCode,
          parentLabel: PARENT_PRICE_TYPE_LABELS[priceType.parentCode],
          description: priceType.description,
          sortOrder: priceType.sortOrder,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Create price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/pricing/price-types/generate
 * Generate default price types and assign to offices
 */
router.post(
  '/generate',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const parseResult = generatePriceTypesSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { parentCodes, officeIds } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify all offices belong to this company
      const offices = await em.find(Office, {
        id: { $in: officeIds },
        company: company.id,
      });

      if (offices.length !== officeIds.length) {
        res.status(400).json({
          error:
            'One or more offices not found or do not belong to this company',
        });
        return;
      }

      const createdPriceTypes: PriceObjectType[] = [];
      const createdAssignments: OfficePriceType[] = [];

      // Get current max sort order
      const existingTypes = await em.find(
        PriceObjectType,
        { company: company.id, isActive: true },
        { orderBy: { sortOrder: 'DESC' }, limit: 1 },
      );
      let sortOrder = existingTypes[0] ? existingTypes[0].sortOrder + 1 : 1;

      for (const parentCode of parentCodes) {
        const code = parentCode;
        const name =
          PARENT_PRICE_TYPE_LABELS[parentCode as ParentPriceTypeCode];

        // Check if this code already exists for the company (including soft-deleted)
        const existing = await em.findOne(PriceObjectType, {
          company: company.id,
          code,
        });

        if (existing) {
          // Reactivate if soft-deleted
          if (!existing.isActive) {
            existing.isActive = true;
            existing.sortOrder = sortOrder;
            createdPriceTypes.push(existing);
          }

          // Create office assignments for existing price type if needed
          for (const office of offices) {
            const existingAssignment = await em.findOne(OfficePriceType, {
              office: office.id,
              priceType: existing.id,
            });

            if (!existingAssignment) {
              const assignment = new OfficePriceType();
              assignment.office = office;
              assignment.priceType = existing;
              assignment.sortOrder = sortOrder;
              em.persist(assignment);
              createdAssignments.push(assignment);
            }
            // Assignment exists = already enabled, nothing to do
          }
          sortOrder++;
          continue;
        }

        // Create new price type
        const priceType = new PriceObjectType();
        priceType.company = em.getReference(Company, company.id);
        priceType.code = code;
        priceType.name = name;
        priceType.parentCode = parentCode as ParentPriceTypeCode;
        priceType.sortOrder = sortOrder;
        em.persist(priceType);
        createdPriceTypes.push(priceType);

        // Create office assignments (row exists = enabled)
        for (const office of offices) {
          const assignment = new OfficePriceType();
          assignment.office = office;
          assignment.priceType = priceType;
          assignment.sortOrder = sortOrder;
          em.persist(assignment);
          createdAssignments.push(assignment);
        }

        sortOrder++;
      }

      await em.flush();

      req.log.info(
        {
          priceTypesCreated: createdPriceTypes.length,
          assignmentsCreated: createdAssignments.length,
          userId: context.user.id,
        },
        'Default price types generated',
      );

      res.status(201).json({
        message: 'Default price types generated successfully',
        priceTypesCreated: createdPriceTypes.length,
        assignmentsCreated: createdAssignments.length,
        priceTypes: createdPriceTypes.map(pt => ({
          id: pt.id,
          code: pt.code,
          name: pt.name,
          parentCode: pt.parentCode,
        })),
      });
    } catch (err) {
      req.log.error({ err }, 'Generate price types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/price-types/:id
 * Update a price type
 */
router.put(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Price type ID is required' });
        return;
      }

      const parseResult = updatePriceTypeSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const data = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const priceType = await em.findOne(PriceObjectType, {
        id,
        company: company.id,
      });

      if (!priceType) {
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      // Update fields
      if (data.name !== undefined) priceType.name = data.name;
      if (data.parentCode !== undefined)
        priceType.parentCode = data.parentCode as ParentPriceTypeCode;
      if (data.description !== undefined)
        priceType.description = data.description ?? undefined;
      if (data.sortOrder !== undefined) priceType.sortOrder = data.sortOrder;

      await em.flush();

      req.log.info(
        { priceTypeId: priceType.id, userId: context.user.id },
        'Price type updated',
      );

      res.status(200).json({
        message: 'Price type updated successfully',
        priceType: {
          id: priceType.id,
          code: priceType.code,
          name: priceType.name,
          parentCode: priceType.parentCode,
          parentLabel: PARENT_PRICE_TYPE_LABELS[priceType.parentCode],
          description: priceType.description,
          sortOrder: priceType.sortOrder,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/pricing/price-types/:id
 * Soft delete a price type
 */
router.delete(
  '/:id',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Price type ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      const priceType = await em.findOne(PriceObjectType, {
        id,
        company: company.id,
      });

      if (!priceType) {
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      // Soft delete
      priceType.isActive = false;
      await em.flush();

      req.log.info(
        { priceTypeId: priceType.id, userId: context.user.id },
        'Price type deleted',
      );

      res.status(200).json({
        message: 'Price type deleted successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Delete price type error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/price-types/reorder
 * Reorder price types
 */
router.put(
  '/reorder',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;

      const parseResult = z
        .object({
          order: z.array(
            z.object({
              id: z.string().uuid(),
              sortOrder: z.number().int().min(0),
            }),
          ),
        })
        .safeParse(req.body);

      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const { order } = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      for (const item of order) {
        const priceType = await em.findOne(PriceObjectType, {
          id: item.id,
          company: company.id,
        });
        if (priceType) {
          priceType.sortOrder = item.sortOrder;
        }
      }

      await em.flush();

      req.log.info(
        { userId: context.user.id, count: order.length },
        'Price types reordered',
      );

      res.status(200).json({
        message: 'Price types reordered successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Reorder price types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ============================================================================
// Office Assignment Routes
// ============================================================================

/**
 * GET /price-guide/pricing/price-types/offices/:officeId
 * List price types for a specific office with their assignment status
 */
router.get(
  '/offices/:officeId',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { officeId } = req.params;
      if (!officeId) {
        res.status(400).json({ error: 'Office ID is required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify office belongs to company
      const office = await em.findOne(Office, {
        id: officeId,
        company: company.id,
      });

      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      // Get all active price types for the company
      const priceTypes = await em.find(
        PriceObjectType,
        { company: company.id, isActive: true },
        { orderBy: { sortOrder: 'ASC', name: 'ASC' } },
      );

      // Get assignments for this office
      const assignments = await em.find(OfficePriceType, {
        office: officeId,
        priceType: { $in: priceTypes.map(pt => pt.id) },
      });

      const assignmentMap = new Map(assignments.map(a => [a.priceType.id, a]));

      res.status(200).json({
        office: {
          id: office.id,
          name: office.name,
        },
        priceTypes: priceTypes.map(pt => {
          const assignment = assignmentMap.get(pt.id);
          return {
            id: pt.id,
            code: pt.code,
            name: pt.name,
            parentCode: pt.parentCode,
            parentLabel: PARENT_PRICE_TYPE_LABELS[pt.parentCode],
            description: pt.description,
            sortOrder: pt.sortOrder,
            // Row exists = enabled, no row = disabled
            isEnabled: !!assignment,
            officeSortOrder: assignment?.sortOrder ?? pt.sortOrder,
          };
        }),
      });
    } catch (err) {
      req.log.error({ err }, 'List office price types error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * POST /price-guide/pricing/price-types/:id/offices/:officeId
 * Assign a price type to an office
 */
router.post(
  '/:id/offices/:officeId',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { id, officeId } = req.params;
      if (!id || !officeId) {
        res
          .status(400)
          .json({ error: 'Price type ID and Office ID are required' });
        return;
      }

      const parseResult = officeAssignmentSchema.safeParse(req.body);
      const data = parseResult.success ? parseResult.data : {};

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify price type belongs to company
      const priceType = await em.findOne(PriceObjectType, {
        id,
        company: company.id,
        isActive: true,
      });

      if (!priceType) {
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      // Verify office belongs to company
      const office = await em.findOne(Office, {
        id: officeId,
        company: company.id,
      });

      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      // Check if assignment already exists
      let assignment = await em.findOne(OfficePriceType, {
        office: officeId,
        priceType: id,
      });

      if (assignment) {
        // Assignment already exists - update sortOrder if provided
        if (data.sortOrder !== undefined) {
          assignment.sortOrder = data.sortOrder;
        }
      } else {
        // Create new assignment (row exists = enabled)
        assignment = new OfficePriceType();
        assignment.office = office;
        assignment.priceType = priceType;
        assignment.sortOrder = data.sortOrder ?? priceType.sortOrder;
        em.persist(assignment);
      }

      await em.flush();

      req.log.info(
        {
          priceTypeId: id,
          officeId,
          userId: context.user.id,
        },
        'Price type assigned to office',
      );

      res.status(201).json({
        message: 'Price type assigned to office successfully',
        assignment: {
          id: assignment.id,
          priceTypeId: priceType.id,
          officeId: office.id,
          sortOrder: assignment.sortOrder,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Assign price type to office error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /price-guide/pricing/price-types/:id/offices/:officeId
 * Update a price type office assignment
 */
router.put(
  '/:id/offices/:officeId',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { id, officeId } = req.params;
      if (!id || !officeId) {
        res
          .status(400)
          .json({ error: 'Price type ID and Office ID are required' });
        return;
      }

      const parseResult = officeAssignmentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const data = parseResult.data;
      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify price type belongs to company
      const priceType = await em.findOne(PriceObjectType, {
        id,
        company: company.id,
      });

      if (!priceType) {
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      // Verify office belongs to company
      const office = await em.findOne(Office, {
        id: officeId,
        company: company.id,
      });

      if (!office) {
        res.status(404).json({ error: 'Office not found' });
        return;
      }

      // Find assignment
      const assignment = await em.findOne(OfficePriceType, {
        office: officeId,
        priceType: id,
      });

      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }

      // Update fields
      if (data.sortOrder !== undefined) assignment.sortOrder = data.sortOrder;

      await em.flush();

      req.log.info(
        {
          priceTypeId: id,
          officeId,
          userId: context.user.id,
        },
        'Office price type assignment updated',
      );

      res.status(200).json({
        message: 'Assignment updated successfully',
        assignment: {
          id: assignment.id,
          priceTypeId: priceType.id,
          officeId: office.id,
          sortOrder: assignment.sortOrder,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Update office price type assignment error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /price-guide/pricing/price-types/:id/offices/:officeId
 * Remove a price type office assignment
 */
router.delete(
  '/:id/offices/:officeId',
  requireAuth(),
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const context = getCompanyContext(req);
      if (!context) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { company } = context;
      const { id, officeId } = req.params;
      if (!id || !officeId) {
        res
          .status(400)
          .json({ error: 'Price type ID and Office ID are required' });
        return;
      }

      const orm = getORM();
      const em = orm.em.fork() as EntityManager;

      // Verify price type belongs to company
      const priceType = await em.findOne(PriceObjectType, {
        id,
        company: company.id,
      });

      if (!priceType) {
        res.status(404).json({ error: 'Price type not found' });
        return;
      }

      // Find and delete assignment
      const assignment = await em.findOne(OfficePriceType, {
        office: officeId,
        priceType: id,
      });

      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }

      await em.removeAndFlush(assignment);

      req.log.info(
        {
          priceTypeId: id,
          officeId,
          userId: context.user.id,
        },
        'Office price type assignment removed',
      );

      res.status(200).json({
        message: 'Assignment removed successfully',
      });
    } catch (err) {
      req.log.error({ err }, 'Remove office price type assignment error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;
