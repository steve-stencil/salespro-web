# Customer Home Feature Parity Plan

## Overview

The iOS `CustomerHomeViewController` is the main landing page of the mobile app. It displays three main sections:

- **Today's Appointments** - Calendar appointments for the current day
- **Today's Tasks** - Tasks due today with completion toggles
- **Recent Estimates** - Recently viewed customer estimates

This plan covers both the **backend API** (entities, services, routes) and **frontend** (types, hooks, components, pages) implementation.---

## Part 1: Backend Implementation

### 1.1 New MikroORM Entities

Create in `apps/api/src/entities/`:

#### Customer.entity.ts

```typescript
@Entity()
export class Customer {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @ManyToOne('Company')
  @Index()
  company!: Company;

  @ManyToOne('Office', { nullable: true })
  @Index()
  office?: Office;

  /** Source system ID (Parse objectId for migration) */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  /** Customer identifier from CRM/Salesforce */
  @Property({ type: 'string', nullable: true })
  @Index()
  identifier?: string;

  @Property({ type: 'string', nullable: true })
  nameFirst?: string;

  @Property({ type: 'string', nullable: true })
  nameLast?: string;

  @Property({ type: 'string', nullable: true })
  email?: string;

  @Property({ type: 'string', nullable: true })
  phone?: string;

  @OneToMany('Address', 'customer')
  addresses = new Collection<Address>(this);

  @OneToMany('Contact', 'customer')
  contacts = new Collection<Contact>(this);

  @OneToMany('Estimate', 'customer')
  estimates = new Collection<Estimate>(this);

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;

  get fullName(): string {
    return [this.nameFirst, this.nameLast].filter(Boolean).join(' ');
  }
}
```

#### Address.entity.ts

```typescript
@Entity()
export class Address {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @ManyToOne('Customer')
  @Index()
  customer!: Customer;

  @Property({ type: 'string', nullable: true })
  street?: string;

  @Property({ type: 'string', nullable: true })
  city?: string;

  @Property({ type: 'string', nullable: true })
  state?: string;

  @Property({ type: 'string', nullable: true })
  zipCode?: string;

  @Property({ type: 'boolean' })
  isPrimary: Opt<boolean> = false;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
```

#### Contact.entity.ts

```typescript
@Entity()
export class Contact {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @ManyToOne('Customer')
  @Index()
  customer!: Customer;

  @Property({ type: 'string', nullable: true })
  nameFirst?: string;

  @Property({ type: 'string', nullable: true })
  nameLast?: string;

  @Property({ type: 'string', nullable: true })
  email?: string;

  @Property({ type: 'string', nullable: true })
  phone?: string;

  @Property({ type: 'string', nullable: true })
  relationship?: string;

  @Property({ type: 'boolean' })
  isPrimary: Opt<boolean> = false;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();
}
```

#### Estimate.entity.ts

```typescript
@Entity()
export class Estimate {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @ManyToOne('Customer')
  @Index()
  customer!: Customer;

  @ManyToOne('Company')
  @Index()
  company!: Company;

  @ManyToOne('Office', { nullable: true })
  @Index()
  office?: Office;

  @ManyToOne('User', { nullable: true })
  createdBy?: User;

  /** Source system ID (Parse objectId for migration) */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  /** Display name for the estimate */
  @Property({ type: 'string', nullable: true })
  name?: string;

  /** Estimate result summary (from iOS resultFullString) */
  @Property({ type: 'text', nullable: true })
  resultSummary?: string;

  /** Status: draft, sent, signed, etc. */
  @Property({ type: 'string' })
  @Index()
  status: Opt<string> = 'draft';

  /** Total amount */
  @Property({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalAmount?: string;

  /** Last accessed for "recent" sorting */
  @Property({ type: 'Date', nullable: true })
  @Index()
  lastAccessedAt?: Date;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;
}
```

#### Task.entity.ts

```typescript
@Entity()
export class Task {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @ManyToOne('Company')
  @Index()
  company!: Company;

  @ManyToOne('User')
  @Index()
  assignedTo!: User;

  @ManyToOne('Customer', { nullable: true })
  customer?: Customer;

  /** Source system ID (Parse objectId for migration) */
  @Property({ type: 'string', nullable: true })
  @Index()
  sourceId?: string;

  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'text', nullable: true })
  notes?: string;

  @Property({ type: 'Date', nullable: true })
  @Index()
  dueDate?: Date;

  @Property({ type: 'Date', nullable: true })
  @Index()
  completedDate?: Date;

  /** Calendar event ID if synced */
  @Property({ type: 'string', nullable: true })
  calendarEventId?: string;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @Property({ type: 'Date', nullable: true })
  deletedAt?: Date;

  get isComplete(): boolean {
    return this.completedDate != null;
  }
}
```

#### Appointment.entity.ts

```typescript
@Entity()
export class Appointment {
  @PrimaryKey({ type: 'uuid' })
  id: Opt<string> = uuid();

  @ManyToOne('Company')
  @Index()
  company!: Company;

  @ManyToOne('Office', { nullable: true })
  office?: Office;

  @ManyToOne('Customer', { nullable: true })
  customer?: Customer;

  @ManyToOne('User', { nullable: true })
  assignedTo?: User;

  /** Source: 'crm', 'salesforce', 'manual' */
  @Property({ type: 'string' })
  @Index()
  source!: string;

  /** External ID from CRM/Salesforce */
  @Property({ type: 'string', nullable: true })
  @Index()
  externalId?: string;

  @Property({ type: 'string', nullable: true })
  customerName?: string;

  @Property({ type: 'string', nullable: true })
  customerIdentifier?: string;

  @Property({ type: 'Date' })
  @Index()
  appointmentDate!: Date;

  @Property({ type: 'string', nullable: true })
  addressStreet?: string;

  @Property({ type: 'string', nullable: true })
  addressCity?: string;

  @Property({ type: 'string', nullable: true })
  addressState?: string;

  @Property({ type: 'string', nullable: true })
  addressZip?: string;

  /** Full address string (pre-formatted) */
  @Property({ type: 'string', nullable: true })
  fullAddress?: string;

  /** Raw data from CRM as JSON */
  @Property({ type: 'json', nullable: true })
  rawData?: Record<string, unknown>;

  @Property({ type: 'Date' })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'Date', onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();
}
```

### 1.2 Update Entity Index

Update `apps/api/src/entities/index.ts`:

```typescript
// Add to existing exports:
export { Customer } from './Customer.entity';
export { Address } from './Address.entity';
export { Contact } from './Contact.entity';
export { Estimate } from './Estimate.entity';
export { Task } from './Task.entity';
export { Appointment } from './Appointment.entity';
```

### 1.3 Database Migration

Create migration in `apps/api/src/migrations/`:

```typescript
// Migration0016_CustomerHomeEntities.ts
export class Migration0016_CustomerHomeEntities extends Migration {
  async up(): Promise<void> {
    // Create customer table
    this.addSql(`
      CREATE TABLE "customer" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL REFERENCES "company"("id"),
        "office_id" uuid REFERENCES "office"("id"),
        "source_id" varchar(255),
        "identifier" varchar(255),
        "name_first" varchar(255),
        "name_last" varchar(255),
        "email" varchar(255),
        "phone" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    // ... additional tables for Address, Contact, Estimate, Task, Appointment
    // ... indexes
  }
}
```

---

### 1.4 Services Layer

Create in `apps/api/src/services/mobile/`:

#### CustomerService.ts

```typescript
export class CustomerService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Search customers by name or identifier.
   * Maps to iOS: searchByCustomerIdentifier
   */
  async search(
    companyId: string,
    query: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ customers: Customer[]; total: number }> {
    const { limit = 20, offset = 0 } = options;
    const where = {
      company: companyId,
      deletedAt: null,
      $or: [
        { nameFirst: { $ilike: `%${query}%` } },
        { nameLast: { $ilike: `%${query}%` } },
        { identifier: { $ilike: `%${query}%` } },
        { email: { $ilike: `%${query}%` } },
      ],
    };

    const [customers, total] = await Promise.all([
      this.em.find(Customer, where, {
        limit,
        offset,
        orderBy: { nameLast: 'ASC', nameFirst: 'ASC' },
        populate: ['addresses'],
      }),
      this.em.count(Customer, where),
    ]);

    return { customers, total };
  }

  /**
   * Find customers by identifier (for duplicate detection).
   */
  async findByIdentifier(
    companyId: string,
    identifier: string,
  ): Promise<Customer[]> {
    return this.em.find(Customer, {
      company: companyId,
      identifier,
      deletedAt: null,
    });
  }

  /**
   * Create a new customer.
   */
  async create(data: CreateCustomerInput): Promise<Customer> {
    const customer = new Customer();
    Object.assign(customer, data);
    await this.em.persistAndFlush(customer);
    return customer;
  }

  /**
   * Get customer with full details.
   */
  async getById(id: string, companyId: string): Promise<Customer | null> {
    return this.em.findOne(
      Customer,
      { id, company: companyId, deletedAt: null },
      { populate: ['addresses', 'contacts'] },
    );
  }
}
```

#### EstimateService.ts

```typescript
export class EstimateService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Fetch recent estimates for a user.
   * Maps to iOS: fetchRecentEstimates cloud function
   */
  async getRecentEstimates(
    userId: string,
    companyId: string,
    limit = 20,
  ): Promise<Estimate[]> {
    return this.em.find(
      Estimate,
      {
        company: companyId,
        createdBy: userId,
        deletedAt: null,
      },
      {
        orderBy: { lastAccessedAt: 'DESC', updatedAt: 'DESC' },
        limit,
        populate: ['customer', 'customer.addresses'],
      },
    );
  }

  /**
   * Update lastAccessedAt when estimate is opened.
   */
  async markAccessed(id: string): Promise<void> {
    await this.em.nativeUpdate(
      Estimate,
      { id },
      { lastAccessedAt: new Date() },
    );
  }

  /**
   * Soft delete an estimate.
   */
  async delete(id: string, companyId: string): Promise<boolean> {
    const result = await this.em.nativeUpdate(
      Estimate,
      { id, company: companyId, deletedAt: null },
      { deletedAt: new Date() },
    );
    return result > 0;
  }
}
```

#### TaskService.ts

```typescript
export class TaskService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Get today's tasks for a user.
   * Includes: incomplete from yesterday + all from today.
   * Maps to iOS: SSTask.getTasks
   */
  async getTodaysTasks(userId: string, companyId: string): Promise<Task[]> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = endOfDay(subDays(now, 1));

    // Incomplete from yesterday
    const yesterdayIncomplete = await this.em.find(Task, {
      assignedTo: userId,
      company: companyId,
      deletedAt: null,
      completedDate: null,
      dueDate: { $gte: yesterdayStart, $lte: yesterdayEnd },
    });

    // All from today
    const todayTasks = await this.em.find(Task, {
      assignedTo: userId,
      company: companyId,
      deletedAt: null,
      $or: [
        { dueDate: { $gte: todayStart, $lte: todayEnd } },
        { createdAt: { $gte: todayStart, $lte: todayEnd } },
      ],
    });

    // Combine and sort by due date
    const combined = [...yesterdayIncomplete, ...todayTasks];
    const uniqueIds = new Set<string>();
    const unique = combined.filter(t => {
      if (uniqueIds.has(t.id)) return false;
      uniqueIds.add(t.id);
      return true;
    });

    return unique.sort((a, b) => {
      const dateA = a.dueDate ?? a.createdAt;
      const dateB = b.dueDate ?? b.createdAt;
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Toggle task completion.
   * Maps to iOS: SSTask.modifyTask
   */
  async toggleComplete(id: string, userId: string): Promise<Task | null> {
    const task = await this.em.findOne(Task, {
      id,
      assignedTo: userId,
      deletedAt: null,
    });

    if (!task) return null;

    task.completedDate = task.completedDate ? undefined : new Date();
    await this.em.flush();
    return task;
  }

  /**
   * Create a new task.
   */
  async create(data: CreateTaskInput): Promise<Task> {
    const task = new Task();
    Object.assign(task, data);
    await this.em.persistAndFlush(task);
    return task;
  }

  /**
   * Update a task.
   */
  async update(
    id: string,
    userId: string,
    data: UpdateTaskInput,
  ): Promise<Task | null> {
    const task = await this.em.findOne(Task, {
      id,
      assignedTo: userId,
      deletedAt: null,
    });
    if (!task) return null;
    Object.assign(task, data);
    await this.em.flush();
    return task;
  }

  /**
   * Soft delete a task.
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.em.nativeUpdate(
      Task,
      { id, assignedTo: userId, deletedAt: null },
      { deletedAt: new Date() },
    );
    return result > 0;
  }
}
```

#### AppointmentService.ts

```typescript
export class AppointmentService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Get today's appointments for a user's office.
   * Maps to iOS: promiseDownloadTodaysAppointments
   */
  async getTodaysAppointments(
    userId: string,
    companyId: string,
    officeId?: string,
  ): Promise<Appointment[]> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const where: FilterQuery<Appointment> = {
      company: companyId,
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
    };

    if (officeId) {
      where.office = officeId;
    }

    return this.em.find(Appointment, where, {
      orderBy: { appointmentDate: 'ASC' },
    });
  }

  /**
   * Sync appointments from CRM.
   * Called periodically or on demand.
   */
  async syncFromCRM(
    companyId: string,
    officeId: string,
    appointments: ExternalAppointment[],
  ): Promise<void> {
    for (const ext of appointments) {
      const existing = await this.em.findOne(Appointment, {
        company: companyId,
        externalId: ext.id,
      });

      if (existing) {
        Object.assign(
          existing,
          this.mapExternalToEntity(ext, companyId, officeId),
        );
      } else {
        const appt = new Appointment();
        Object.assign(appt, this.mapExternalToEntity(ext, companyId, officeId));
        this.em.persist(appt);
      }
    }
    await this.em.flush();
  }

  private mapExternalToEntity(
    ext: ExternalAppointment,
    companyId: string,
    officeId: string,
  ): Partial<Appointment> {
    return {
      company: this.em.getReference(Company, companyId),
      office: this.em.getReference(Office, officeId),
      source: 'crm',
      externalId: ext.id,
      customerName: ext.customerName,
      customerIdentifier: ext.customerId,
      appointmentDate: new Date(ext.date),
      addressStreet: ext.address?.street,
      addressCity: ext.address?.city,
      addressState: ext.address?.state,
      addressZip: ext.address?.zip,
      rawData: ext,
    };
  }
}
```

---

### 1.5 API Routes

Create in `apps/api/src/routes/mobile/`:

#### index.ts (Mobile routes entry)

```typescript
import { Router } from 'express';
import customerRoutes from './customers.routes';
import estimateRoutes from './estimates.routes';
import taskRoutes from './tasks.routes';
import appointmentRoutes from './appointments.routes';

const router = Router();

router.use('/customers', customerRoutes);
router.use('/estimates', estimateRoutes);
router.use('/tasks', taskRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
```

#### customers.routes.ts

```typescript
const router = Router();

// GET /mobile/customers/search?q=...
router.get('/search', requireAuth(), async (req, res) => {
  const { q, limit, offset } = req.query;
  const service = new CustomerService(getORM().em.fork());
  const result = await service.search(req.companyContext.id, q as string, {
    limit: Number(limit) || 20,
    offset: Number(offset) || 0,
  });
  res.json(result);
});

// GET /mobile/customers/:id
router.get('/:id', requireAuth(), async (req, res) => {
  const service = new CustomerService(getORM().em.fork());
  const customer = await service.getById(req.params.id, req.companyContext.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer });
});

// POST /mobile/customers
router.post('/', requireAuth(), async (req, res) => {
  const service = new CustomerService(getORM().em.fork());
  const customer = await service.create({
    ...req.body,
    company: req.companyContext.id,
  });
  res.status(201).json({ customer });
});

// GET /mobile/customers/by-identifier/:identifier
router.get('/by-identifier/:identifier', requireAuth(), async (req, res) => {
  const service = new CustomerService(getORM().em.fork());
  const customers = await service.findByIdentifier(
    req.companyContext.id,
    req.params.identifier,
  );
  res.json({ customers, count: customers.length });
});

export default router;
```

#### estimates.routes.ts

```typescript
const router = Router();

// GET /mobile/estimates/recent
router.get('/recent', requireAuth(), async (req, res) => {
  const service = new EstimateService(getORM().em.fork());
  const estimates = await service.getRecentEstimates(
    req.user.id,
    req.companyContext.id,
    Number(req.query.limit) || 20,
  );

  // Format response to match iOS structure
  const formatted = estimates.map(e => ({
    id: e.id,
    objectId: e.sourceId ?? e.id,
    titleLabel: e.customer?.fullName ?? 'Unknown',
    detailLabel: formatAddress(e.customer?.addresses[0]),
    estimateName: e.name ?? '',
    customer: e.customer
      ? {
          id: e.customer.id,
          nameFirst: e.customer.nameFirst,
          nameLast: e.customer.nameLast,
        }
      : null,
  }));

  res.json({ estimates: formatted });
});

// DELETE /mobile/estimates/:id
router.delete('/:id', requireAuth(), async (req, res) => {
  const service = new EstimateService(getORM().em.fork());
  const deleted = await service.delete(req.params.id, req.companyContext.id);
  if (!deleted) return res.status(404).json({ error: 'Estimate not found' });
  res.status(204).send();
});

// POST /mobile/estimates/:id/access
router.post('/:id/access', requireAuth(), async (req, res) => {
  const service = new EstimateService(getORM().em.fork());
  await service.markAccessed(req.params.id);
  res.json({ success: true });
});

export default router;
```

#### tasks.routes.ts

```typescript
const router = Router();

// GET /mobile/tasks/today
router.get('/today', requireAuth(), async (req, res) => {
  const service = new TaskService(getORM().em.fork());
  const tasks = await service.getTodaysTasks(
    req.user.id,
    req.companyContext.id,
  );

  const formatted = tasks.map(t => ({
    id: t.id,
    name: t.name,
    notes: t.notes,
    dueDate: t.dueDate?.toISOString(),
    completedDate: t.completedDate?.toISOString(),
    isComplete: t.isComplete,
    customerId: t.customer?.id,
  }));

  res.json({ tasks: formatted });
});

// PATCH /mobile/tasks/:id/complete
router.patch('/:id/complete', requireAuth(), async (req, res) => {
  const service = new TaskService(getORM().em.fork());
  const task = await service.toggleComplete(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({
    task: {
      id: task.id,
      isComplete: task.isComplete,
      completedDate: task.completedDate?.toISOString(),
    },
  });
});

// POST /mobile/tasks
router.post('/', requireAuth(), async (req, res) => {
  const service = new TaskService(getORM().em.fork());
  const task = await service.create({
    ...req.body,
    assignedTo: req.user.id,
    company: req.companyContext.id,
  });
  res.status(201).json({ task });
});

// PATCH /mobile/tasks/:id
router.patch('/:id', requireAuth(), async (req, res) => {
  const service = new TaskService(getORM().em.fork());
  const task = await service.update(req.params.id, req.user.id, req.body);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

// DELETE /mobile/tasks/:id
router.delete('/:id', requireAuth(), async (req, res) => {
  const service = new TaskService(getORM().em.fork());
  const deleted = await service.delete(req.params.id, req.user.id);
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

export default router;
```

#### appointments.routes.ts

```typescript
const router = Router();

// GET /mobile/appointments/today
router.get('/today', requireAuth(), async (req, res) => {
  const service = new AppointmentService(getORM().em.fork());
  const appointments = await service.getTodaysAppointments(
    req.user.id,
    req.companyContext.id,
    req.user.currentOffice?.id,
  );

  const formatted = appointments.map(a => ({
    id: a.id,
    customerName: a.customerName,
    customerIdentifier: a.customerIdentifier,
    appointmentDate: a.appointmentDate.toISOString(),
    address: {
      street: a.addressStreet,
      city: a.addressCity,
      state: a.addressState,
      zip: a.addressZip,
      full: a.fullAddress ?? formatAddress(a),
    },
    source: a.source,
  }));

  res.json({ appointments: formatted });
});

export default router;
```

### 1.6 Register Mobile Routes

Update `apps/api/src/routes/index.ts`:

```typescript
import mobileRoutes from './mobile';

// Add with other routes:
r.use('/mobile', mobileRoutes);
```

---

## Part 2: Frontend Implementation

### 2.1 Types

Create `apps/web/src/features/mobile/types/customer-home.ts`:

```typescript
export type Appointment = {
  id: string;
  customerName: string;
  customerIdentifier?: string;
  appointmentDate: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    full: string;
  };
  source: 'crm' | 'salesforce' | 'manual';
};

export type Task = {
  id: string;
  name: string;
  notes?: string;
  dueDate?: string;
  completedDate?: string;
  isComplete: boolean;
  customerId?: string;
};

export type RecentEstimate = {
  id: string;
  objectId: string;
  titleLabel: string;
  detailLabel: string;
  estimateName: string;
  customer?: {
    id: string;
    nameFirst?: string;
    nameLast?: string;
  };
};

export type Customer = {
  id: string;
  nameFirst?: string;
  nameLast?: string;
  fullName: string;
  email?: string;
  phone?: string;
  identifier?: string;
  addresses: Address[];
};

export type Address = {
  id: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isPrimary: boolean;
};
```

### 2.2 API Service

Create `apps/web/src/features/mobile/services/customer-home.ts`:

```typescript
import { get, post, patch, del } from '../lib/api-client';
import type {
  Appointment,
  Task,
  RecentEstimate,
  Customer,
} from '../types/customer-home';

export const customerHomeApi = {
  // Appointments
  getTodaysAppointments: () =>
    get<{ appointments: Appointment[] }>('/mobile/appointments/today'),

  // Tasks
  getTodaysTasks: () => get<{ tasks: Task[] }>('/mobile/tasks/today'),

  toggleTaskComplete: (taskId: string) =>
    patch<{ task: Pick<Task, 'id' | 'isComplete' | 'completedDate'> }>(
      `/mobile/tasks/${taskId}/complete`,
    ),

  createTask: (data: { name: string; notes?: string; dueDate?: string }) =>
    post<{ task: Task }>('/mobile/tasks', data),

  updateTask: (taskId: string, data: Partial<Task>) =>
    patch<{ task: Task }>(`/mobile/tasks/${taskId}`, data),

  deleteTask: (taskId: string) => del(`/mobile/tasks/${taskId}`),

  // Estimates
  getRecentEstimates: (limit = 20) =>
    get<{ estimates: RecentEstimate[] }>('/mobile/estimates/recent', { limit }),

  deleteEstimate: (estimateId: string) =>
    del(`/mobile/estimates/${estimateId}`),

  markEstimateAccessed: (estimateId: string) =>
    post(`/mobile/estimates/${estimateId}/access`),

  // Customers
  searchCustomers: (query: string, limit = 20, offset = 0) =>
    get<{ customers: Customer[]; total: number }>('/mobile/customers/search', {
      q: query,
      limit,
      offset,
    }),

  getCustomer: (customerId: string) =>
    get<{ customer: Customer }>(`/mobile/customers/${customerId}`),

  createCustomer: (data: Partial<Customer>) =>
    post<{ customer: Customer }>('/mobile/customers', data),

  findByIdentifier: (identifier: string) =>
    get<{ customers: Customer[]; count: number }>(
      `/mobile/customers/by-identifier/${identifier}`,
    ),
};
```

### 2.3 Hooks

Create `apps/web/src/features/mobile/hooks/useCustomerHome.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerHomeApi } from '../services/customer-home';

export function useTodaysAppointments() {
  return useQuery({
    queryKey: ['mobile', 'appointments', 'today'],
    queryFn: async () => {
      const { appointments } = await customerHomeApi.getTodaysAppointments();
      return appointments;
    },
  });
}

export function useTodaysTasks() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mobile', 'tasks', 'today'],
    queryFn: async () => {
      const { tasks } = await customerHomeApi.getTodaysTasks();
      return tasks;
    },
  });

  const toggleComplete = useMutation({
    mutationFn: customerHomeApi.toggleTaskComplete,
    onMutate: async taskId => {
      await queryClient.cancelQueries({
        queryKey: ['mobile', 'tasks', 'today'],
      });
      const previous = queryClient.getQueryData(['mobile', 'tasks', 'today']);

      queryClient.setQueryData(
        ['mobile', 'tasks', 'today'],
        (old: Task[] | undefined) =>
          old?.map(t =>
            t.id === taskId
              ? {
                  ...t,
                  isComplete: !t.isComplete,
                  completedDate: t.isComplete
                    ? undefined
                    : new Date().toISOString(),
                }
              : t,
          ),
      );

      return { previous };
    },
    onError: (_err, _taskId, context) => {
      queryClient.setQueryData(['mobile', 'tasks', 'today'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile', 'tasks', 'today'] });
    },
  });

  return { ...query, toggleComplete };
}

export function useRecentEstimates() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mobile', 'estimates', 'recent'],
    queryFn: async () => {
      const { estimates } = await customerHomeApi.getRecentEstimates();
      return estimates;
    },
  });

  const deleteEstimate = useMutation({
    mutationFn: customerHomeApi.deleteEstimate,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mobile', 'estimates', 'recent'],
      });
    },
  });

  return { ...query, deleteEstimate };
}

export function useCustomerSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const searchQuery = useQuery({
    queryKey: ['mobile', 'customers', 'search', debouncedQuery],
    queryFn: () => customerHomeApi.searchCustomers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return { query, setQuery, ...searchQuery };
}

export function useCustomerHome() {
  const appointments = useTodaysAppointments();
  const tasks = useTodaysTasks();
  const estimates = useRecentEstimates();

  const refetchAll = () => {
    appointments.refetch();
    tasks.refetch();
    estimates.refetch();
  };

  return {
    appointments,
    tasks,
    estimates,
    refetchAll,
    isLoading: appointments.isLoading || tasks.isLoading || estimates.isLoading,
  };
}
```

### 2.4 UI Components

Create in `apps/web/src/features/mobile/components/`:

- `CustomerHomeHeader.tsx` - Search bar + ADD NEW + Calendar buttons
- `AppointmentCard.tsx` - Appointment display with nav/info actions
- `TaskCard.tsx` - Task with checkbox and edit modal trigger
- `EstimateCard.tsx` - Estimate with swipe-to-delete
- `CustomerHomeSection.tsx` - Section wrapper with header and list
- `TaskEditModal.tsx` - Task editing form
- `CustomerSearchModal.tsx` - Search modal with results

### 2.5 Customer Home Page

Create `apps/web/src/features/mobile/pages/CustomerHomePage.tsx`:

```typescript
export function CustomerHomePage(): React.ReactElement {
  const { appointments, tasks, estimates, refetchAll, isLoading } =
    useCustomerHome();
  const { flags } = useFeatureFlags();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <CustomerHomeHeader
        onSearch={() => setSearchOpen(true)}
        onAddNew={() => navigate("/mobile/customers/new")}
        onCalendar={() => navigate("/mobile/calendar")}
        showAddNew={flags.showAddNewCustomerButton}
        showCalendar={flags.appointmentsEnabled}
      />

      <PullToRefresh onRefresh={refetchAll}>
        <Box sx={{ flex: 1, overflow: "auto", pb: 2 }}>
          {flags.appointmentsEnabled && (
            <CustomerHomeSection
              title="Today's Appointments"
              items={appointments.data ?? []}
              isLoading={appointments.isLoading}
              renderItem={(appt) => (
                <AppointmentCard key={appt.id} appointment={appt} />
              )}
              emptyMessage="No appointments today"
            />
          )}

          {flags.tasksEnabled && (
            <CustomerHomeSection
              title="Today's Tasks"
              items={tasks.data ?? []}
              isLoading={tasks.isLoading}
              renderItem={(task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={() => tasks.toggleComplete.mutate(task.id)}
                />
              )}
              emptyMessage="No tasks for today"
            />
          )}

          <CustomerHomeSection
            title="Recent Estimates"
            items={estimates.data ?? []}
            isLoading={estimates.isLoading}
            renderItem={(est) => (
              <EstimateCard
                key={est.id}
                estimate={est}
                onDelete={() => estimates.deleteEstimate.mutate(est.id)}
              />
            )}
            emptyMessage="No recent estimates"
          />
        </Box>
      </PullToRefresh>
    </Box>
  );
}
```

### 2.6 Routing

Update `apps/web/src/router.tsx`:

```typescript
// Add import
import { CustomerHomePage } from './features/mobile/pages/CustomerHomePage';

// Add route (before /mobile/contracts):
{
  path: '/mobile',
  element: (
    <PermissionGuard permission={PERMISSIONS.APP_MOBILE}>
      <CustomerHomePage />
    </PermissionGuard>
  ),
},
```

---

## File Structure Summary

```javascript
apps/api/src/
├── entities/
│   ├── Customer.entity.ts      (new)
│   ├── Address.entity.ts       (new)
│   ├── Contact.entity.ts       (new)
│   ├── Estimate.entity.ts      (new)
│   ├── Task.entity.ts          (new)
│   ├── Appointment.entity.ts   (new)
│   └── index.ts                (update)
├── migrations/
│   └── Migration0016_CustomerHomeEntities.ts (new)
├── services/
│   └── mobile/
│       ├── CustomerService.ts    (new)
│       ├── EstimateService.ts    (new)
│       ├── TaskService.ts        (new)
│       ├── AppointmentService.ts (new)
│       └── index.ts              (new)
└── routes/
    ├── mobile/
    │   ├── customers.routes.ts    (new)
    │   ├── estimates.routes.ts    (new)
    │   ├── tasks.routes.ts        (new)
    │   ├── appointments.routes.ts (new)
    │   └── index.ts               (new)
    └── index.ts                   (update)

apps/web/src/features/mobile/
├── components/
│   ├── AppointmentCard.tsx       (new)
│   ├── CustomerHomeHeader.tsx    (new)
│   ├── CustomerHomeSection.tsx   (new)
│   ├── CustomerSearchModal.tsx   (new)
│   ├── EstimateCard.tsx          (new)
│   ├── TaskCard.tsx              (new)
│   └── TaskEditModal.tsx         (new)
├── hooks/
│   └── useCustomerHome.ts        (new)
├── pages/
│   └── CustomerHomePage.tsx      (new)
├── services/
│   └── customer-home.ts          (new)
├── types/
│   └── customer-home.ts          (new)
└── index.ts                      (update)
```

---

## Feature Flags

Use existing `FeatureFlagContext` for:

- `showAddNewCustomerButton` - Controls ADD NEW button
- `tasksEnabled` - Controls tasks section
- `appointmentsEnabled` - Controls appointments + calendar

---

## Out of Scope (Future Work)

- Device calendar integration (browser Calendar API is limited)
- Full calendar view page
