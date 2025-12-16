import { v4 as uuid } from 'uuid';

import { Company, User, Role, UserRole, Session, Office } from '../../entities';
import { UserType, RoleType, CompanyAccessLevel } from '../../entities/types';
import { hashPassword } from '../../lib/crypto';
import { getORM } from '../../lib/db';
import { PERMISSIONS } from '../../lib/permissions';

import type { EntityManager } from '@mikro-orm/core';

/** Result from creating a user with session */
export type UserWithSession = {
  user: User;
  cookie: string;
  sessionId: string;
};

/** Result from creating a company with entities */
export type CompanySetup = {
  company: Company;
  adminUser: User;
  adminCookie: string;
  adminSessionId: string;
  adminRole: Role;
  office?: Office;
};

/** Options for creating a user with permissions */
export type CreateUserOptions = {
  companyId: string;
  permissions: string[];
  email?: string;
  nameFirst?: string;
  nameLast?: string;
  isActive?: boolean;
  mfaEnabled?: boolean;
};

/** Options for creating an internal user */
export type CreateInternalUserOptions = {
  platformRoleId?: string;
  companyAccessLevel?: CompanyAccessLevel;
  platformPermissions?: string[];
  customPermissions?: string[];
  email?: string;
  nameFirst?: string;
  nameLast?: string;
  switchToCompanyId?: string;
};

/** Options for creating a company */
export type CreateCompanyOptions = {
  name?: string;
  isActive?: boolean;
  mfaRequired?: boolean;
  createOffice?: boolean;
  officeName?: string;
};

/**
 * Create a test company with standard configuration.
 *
 * @param em - Entity manager
 * @param options - Company options
 * @returns Created company
 */
export async function createTestCompany(
  em: EntityManager,
  options: CreateCompanyOptions = {},
): Promise<Company> {
  const company = em.create(Company, {
    id: uuid(),
    name: options.name ?? `Test Company ${Date.now()}`,
    maxSessionsPerUser: 5,
    mfaRequired: options.mfaRequired ?? false,
    isActive: options.isActive ?? true,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      historyCount: 3,
      expirationDays: 90,
    },
  });
  em.persist(company);
  await em.flush();
  return company;
}

/**
 * Create a test office in a company.
 *
 * @param em - Entity manager
 * @param company - Company to create office in
 * @param name - Office name
 * @returns Created office
 */
export async function createTestOffice(
  em: EntityManager,
  company: Company,
  name?: string,
): Promise<Office> {
  const office = em.create(Office, {
    id: uuid(),
    name: name ?? `Test Office ${Date.now()}`,
    company,
    isActive: true,
  });
  em.persist(office);
  await em.flush();
  return office;
}

/**
 * Create a role with specific permissions.
 *
 * @param em - Entity manager
 * @param company - Company for the role (null for system role)
 * @param permissions - Array of permission strings
 * @param options - Additional role options
 * @returns Created role
 */
export async function createTestRole(
  em: EntityManager,
  company: Company | null,
  permissions: string[],
  options: {
    name?: string;
    displayName?: string;
    type?: RoleType;
    isDefault?: boolean;
  } = {},
): Promise<Role> {
  const role = em.create(Role, {
    id: uuid(),
    name: options.name ?? `testRole-${Date.now()}-${Math.random()}`,
    displayName: options.displayName ?? 'Test Role',
    permissions,
    type: options.type ?? (company ? RoleType.COMPANY : RoleType.SYSTEM),
    isDefault: options.isDefault ?? false,
    ...(company ? { company } : {}),
  });
  em.persist(role);
  await em.flush();
  return role;
}

/**
 * Create a user with specific permissions.
 *
 * @param em - Entity manager
 * @param company - Company for the user
 * @param permissions - Array of permission strings
 * @param options - Additional user options
 * @returns User and session cookie
 */
export async function createUserWithPermissions(
  em: EntityManager,
  company: Company,
  permissions: string[],
  options: Partial<CreateUserOptions> = {},
): Promise<UserWithSession> {
  // Create role with specified permissions
  const role = await createTestRole(em, company, permissions);

  // Create user
  const passwordHash = await hashPassword('TestPassword123!');
  const user = em.create(User, {
    id: uuid(),
    email: options.email ?? `test-${Date.now()}-${Math.random()}@example.com`,
    passwordHash,
    nameFirst: options.nameFirst ?? 'Test',
    nameLast: options.nameLast ?? 'User',
    isActive: options.isActive ?? true,
    emailVerified: true,
    mfaEnabled: options.mfaEnabled ?? false,
    company,
  });
  em.persist(user);

  // Assign role
  const userRole = em.create(UserRole, {
    id: uuid(),
    user,
    role,
    company,
  });
  em.persist(userRole);

  // Create session
  const sessionId = uuid();
  const session = em.create(Session, {
    sid: sessionId,
    user,
    company,
    data: { userId: user.id },
    source: 'web',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    mfaVerified: false,
  });
  em.persist(session);

  await em.flush();

  return { user, cookie: `sid=${sessionId}`, sessionId };
}

/**
 * Create a user with a global wildcard (*) permission.
 *
 * @param em - Entity manager
 * @param company - Company for the user
 * @returns User and session cookie
 */
export async function createAdminUser(
  em: EntityManager,
  company: Company,
): Promise<UserWithSession> {
  return createUserWithPermissions(em, company, ['*'], {
    nameFirst: 'Admin',
    nameLast: 'User',
  });
}

/**
 * Create a user with read-only permissions for common resources.
 *
 * @param em - Entity manager
 * @param company - Company for the user
 * @returns User and session cookie
 */
export async function createReadOnlyUser(
  em: EntityManager,
  company: Company,
): Promise<UserWithSession> {
  return createUserWithPermissions(
    em,
    company,
    ['user:read', 'office:read', 'role:read', 'customer:read'],
    {
      nameFirst: 'ReadOnly',
      nameLast: 'User',
    },
  );
}

/**
 * Create a platform role with specific access level.
 *
 * @param em - Entity manager
 * @param accessLevel - Company access level
 * @param options - Additional options
 * @returns Created platform role
 */
export async function createPlatformRole(
  em: EntityManager,
  accessLevel: CompanyAccessLevel,
  options: {
    name?: string;
    displayName?: string;
    platformPermissions?: string[];
    customPermissions?: string[];
  } = {},
): Promise<Role> {
  const permissions: string[] = options.platformPermissions ?? [
    PERMISSIONS.PLATFORM_VIEW_COMPANIES,
    PERMISSIONS.PLATFORM_SWITCH_COMPANY,
  ];

  // Add custom permissions for CUSTOM access level
  if (accessLevel === CompanyAccessLevel.CUSTOM && options.customPermissions) {
    permissions.push(...options.customPermissions);
  }

  const role = em.create(Role, {
    id: uuid(),
    name: options.name ?? `platformRole-${Date.now()}-${Math.random()}`,
    displayName: options.displayName ?? 'Platform Role',
    type: RoleType.PLATFORM,
    companyAccessLevel: accessLevel,
    permissions,
  });
  em.persist(role);
  await em.flush();
  return role;
}

/**
 * Create an internal platform user.
 *
 * @param em - Entity manager
 * @param platformRole - Platform role to assign
 * @param options - Additional options
 * @returns User and session cookie
 */
export async function createInternalUser(
  em: EntityManager,
  platformRole: Role,
  options: {
    email?: string;
    nameFirst?: string;
    nameLast?: string;
    switchToCompany?: Company;
  } = {},
): Promise<UserWithSession> {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = em.create(User, {
    id: uuid(),
    email:
      options.email ?? `internal-${Date.now()}-${Math.random()}@platform.com`,
    passwordHash,
    nameFirst: options.nameFirst ?? 'Internal',
    nameLast: options.nameLast ?? 'User',
    userType: UserType.INTERNAL,
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
  });
  em.persist(user);

  // Assign platform role
  const userRole = em.create(UserRole, {
    id: uuid(),
    user,
    role: platformRole,
    assignedAt: new Date(),
  });
  em.persist(userRole);

  // Create session with optional active company
  const sessionId = uuid();
  const session = em.create(Session, {
    sid: sessionId,
    user,
    data: { userId: user.id },
    source: 'web',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    mfaVerified: false,
    ...(options.switchToCompany
      ? { activeCompany: options.switchToCompany }
      : {}),
  });
  em.persist(session);

  await em.flush();

  return { user, cookie: `sid=${sessionId}`, sessionId };
}

/**
 * Create a complete company setup with admin user, role, and optional office.
 *
 * @param options - Setup options
 * @returns Company setup with all created entities
 */
export async function createCompanySetup(
  options: CreateCompanyOptions = {},
): Promise<CompanySetup> {
  const orm = getORM();
  const em = orm.em.fork();

  // Create company
  const company = await createTestCompany(em, options);

  // Create admin role
  const adminRole = await createTestRole(em, null, ['*'], {
    name: `companyAdmin-${company.id}`,
    displayName: 'Company Admin',
    type: RoleType.SYSTEM,
  });

  // Create admin user
  const passwordHash = await hashPassword('TestPassword123!');
  const adminUser = em.create(User, {
    id: uuid(),
    email: `admin-${Date.now()}@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
    passwordHash,
    nameFirst: 'Admin',
    nameLast: 'User',
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    company,
  });
  em.persist(adminUser);

  // Assign admin role
  const userRole = em.create(UserRole, {
    id: uuid(),
    user: adminUser,
    role: adminRole,
    company,
  });
  em.persist(userRole);

  // Create session
  const adminSessionId = uuid();
  const session = em.create(Session, {
    sid: adminSessionId,
    user: adminUser,
    company,
    data: { userId: adminUser.id },
    source: 'web',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    mfaVerified: false,
  });
  em.persist(session);

  await em.flush();

  // Optionally create office
  let office: Office | undefined;
  if (options.createOffice) {
    office = await createTestOffice(em, company, options.officeName);
  }

  return {
    company,
    adminUser,
    adminCookie: `sid=${adminSessionId}`,
    adminSessionId,
    adminRole,
    office,
  };
}

/**
 * Clean up all test data in correct order respecting FK constraints.
 */
export async function cleanupTestData(): Promise<void> {
  const orm = getORM();
  const em = orm.em.fork();

  await em.nativeDelete('user_office', {});
  await em.nativeDelete('user_role', {});
  await em.nativeDelete('session', {});
  await em.nativeDelete('office', {});
  await em.nativeDelete('user', {});
  await em.nativeDelete('role', {});
  await em.nativeDelete('company', {});
}

/**
 * Create multiple users with different permission levels for comprehensive testing.
 *
 * @param em - Entity manager
 * @param company - Company for the users
 * @returns Object with users at different permission levels
 */
export async function createTestUserSet(
  em: EntityManager,
  company: Company,
): Promise<{
  admin: UserWithSession;
  userManager: UserWithSession;
  roleManager: UserWithSession;
  readOnly: UserWithSession;
  noPermissions: UserWithSession;
}> {
  const admin = await createUserWithPermissions(em, company, ['*'], {
    nameFirst: 'Admin',
    nameLast: 'User',
  });

  const userManager = await createUserWithPermissions(em, company, ['user:*'], {
    nameFirst: 'User',
    nameLast: 'Manager',
  });

  const roleManager = await createUserWithPermissions(em, company, ['role:*'], {
    nameFirst: 'Role',
    nameLast: 'Manager',
  });

  const readOnly = await createUserWithPermissions(
    em,
    company,
    ['user:read', 'office:read', 'role:read'],
    {
      nameFirst: 'ReadOnly',
      nameLast: 'User',
    },
  );

  // Create user with no permissions
  const passwordHash = await hashPassword('TestPassword123!');
  const noPermsUser = em.create(User, {
    id: uuid(),
    email: `no-perms-${Date.now()}@example.com`,
    passwordHash,
    nameFirst: 'No',
    nameLast: 'Permissions',
    isActive: true,
    emailVerified: true,
    mfaEnabled: false,
    company,
  });
  em.persist(noPermsUser);

  const noPermsSessionId = uuid();
  const noPermsSession = em.create(Session, {
    sid: noPermsSessionId,
    user: noPermsUser,
    company,
    data: { userId: noPermsUser.id },
    source: 'web',
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    mfaVerified: false,
  });
  em.persist(noPermsSession);

  await em.flush();

  return {
    admin,
    userManager,
    roleManager,
    readOnly,
    noPermissions: {
      user: noPermsUser,
      cookie: `sid=${noPermsSessionId}`,
      sessionId: noPermsSessionId,
    },
  };
}

/**
 * Assert that a response has the expected forbidden status.
 *
 * @param response - Supertest response
 * @param expectedPermission - Optional expected permission in error message
 */
export function expectForbidden(
  response: {
    status: number;
    body: { error?: string; requiredPermission?: string };
  },
  expectedPermission?: string,
): void {
  expect(response.status).toBe(403);
  expect(response.body.error).toBe('Forbidden');
  if (expectedPermission) {
    expect(response.body.requiredPermission).toBe(expectedPermission);
  }
}

/**
 * Assert that a response has the expected unauthorized status.
 *
 * @param response - Supertest response
 */
export function expectUnauthorized(response: {
  status: number;
  body: { error?: string };
}): void {
  expect(response.status).toBe(401);
}

/**
 * Assert that a response has the expected not found status.
 *
 * @param response - Supertest response
 * @param expectedMessage - Optional expected error message
 */
export function expectNotFound(
  response: { status: number; body: { error?: string } },
  expectedMessage?: string,
): void {
  expect(response.status).toBe(404);
  if (expectedMessage) {
    expect(response.body.error).toBe(expectedMessage);
  }
}
