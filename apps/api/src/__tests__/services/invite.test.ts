import { describe, it, expect, vi, beforeEach } from 'vitest';

import { UserInvite, InviteStatus } from '../../entities';
import {
  createInvite,
  validateInviteToken,
  acceptInvite,
  revokeInvite,
  resendInvite,
  listPendingInvites,
} from '../../services/invite';

import type { User, Company, Office } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

// Mock crypto functions
vi.mock('../../lib/crypto', () => ({
  generateSecureToken: vi.fn(() => 'mock-token-12345'),
  hashToken: vi.fn((token: string) => `hashed-${token}`),
  hashPassword: vi.fn(() => Promise.resolve('hashed-password')),
}));

// Mock email service
vi.mock('../../lib/email', () => ({
  emailService: {
    isConfigured: vi.fn(() => true),
    sendInviteEmail: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

// Mock auth events
vi.mock('../../services/auth/events', () => ({
  logLoginEvent: vi.fn(() => Promise.resolve(undefined)),
}));

// Mock PermissionService
vi.mock('../../services/PermissionService', () => ({
  PermissionService: class MockPermissionService {
    assignRole = vi.fn(() => Promise.resolve({ success: true }));
  },
}));

/**
 * Create a mock EntityManager
 */
function createMockEm(): {
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findAndCount: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
  persistAndFlush: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  getReference: ReturnType<typeof vi.fn>;
} {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    findAndCount: vi.fn(),
    count: vi.fn(),
    persist: vi.fn(),
    persistAndFlush: vi.fn(),
    flush: vi.fn(),
    getReference: vi.fn((_entity, id) => ({ id })),
  };
}

/**
 * Create a mock Company
 */
function createMockCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-123',
    name: 'Test Company',
    maxSeats: 10,
    ...overrides,
  } as Company;
}

/**
 * Create a mock Office
 */
function createMockOffice(overrides: Partial<Office> = {}): Office {
  return {
    id: 'office-123',
    name: 'Test Office',
    company: createMockCompany(),
    isActive: true,
    ...overrides,
  } as Office;
}

/**
 * Create a mock User
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'inviter@example.com',
    nameFirst: 'Test',
    nameLast: 'User',
    fullName: 'Test User',
    ...overrides,
  } as User;
}

/**
 * Create a mock UserInvite
 */
function createMockInvite(overrides: Partial<UserInvite> = {}): UserInvite {
  const office = createMockOffice();
  const invite = {
    id: 'invite-123',
    email: 'newuser@example.com',
    tokenHash: 'hashed-mock-token-12345',
    company: createMockCompany(),
    invitedBy: createMockUser(),
    roles: ['role-1'],
    currentOffice: office,
    allowedOffices: [office.id],
    status: InviteStatus.PENDING,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    isExpired: false,
    isValid: true,
    ...overrides,
  } as UserInvite;
  return invite;
}

describe('InviteService', () => {
  let mockEm: ReturnType<typeof createMockEm>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEm = createMockEm();
  });

  describe('createInvite', () => {
    it('should create an invite successfully with office assignments', async () => {
      const company = createMockCompany();
      const inviter = createMockUser();
      const office = createMockOffice({ company });

      vi.mocked(mockEm.findOne)
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(null) // No existing invite
        .mockResolvedValueOnce(company) // Company found
        .mockResolvedValueOnce(office) // Current office found
        .mockResolvedValueOnce(inviter); // Inviter found

      vi.mocked(mockEm.find).mockResolvedValueOnce([office]); // All allowed offices found

      vi.mocked(mockEm.count)
        .mockResolvedValueOnce(5) // 5 existing users
        .mockResolvedValueOnce(2); // 2 pending invites

      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: office.id,
        allowedOfficeIds: [office.id],
      });

      expect(result.success).toBe(true);
      expect(result.invite).toBeDefined();
      expect(mockEm.persistAndFlush).toHaveBeenCalled();
    });

    it('should fail if currentOfficeId is not provided', async () => {
      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: undefined as unknown as string,
        allowedOfficeIds: ['office-123'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current office is required');
    });

    it('should fail if allowedOfficeIds is not provided', async () => {
      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: 'office-123',
        allowedOfficeIds: undefined as unknown as string[],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one allowed office is required');
    });

    it('should fail if allowedOfficeIds is empty', async () => {
      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: 'office-123',
        allowedOfficeIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least one allowed office is required');
    });

    it('should fail if currentOfficeId is not in allowedOfficeIds', async () => {
      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: 'office-999',
        allowedOfficeIds: ['office-123', 'office-456'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Current office must be one of the allowed offices',
      );
    });

    it('should fail if email already exists', async () => {
      vi.mocked(mockEm.findOne).mockResolvedValueOnce(createMockUser());

      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'existing@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: 'office-123',
        allowedOfficeIds: ['office-123'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('A user with this email already exists');
    });

    it('should fail if pending invite exists', async () => {
      vi.mocked(mockEm.findOne)
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(createMockInvite()); // Existing pending invite

      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: 'office-123',
        allowedOfficeIds: ['office-123'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'A pending invitation already exists for this email',
      );
    });

    it('should fail if company has reached max seats', async () => {
      const company = createMockCompany({ maxSeats: 5 });

      vi.mocked(mockEm.findOne)
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(null) // No existing invite
        .mockResolvedValueOnce(company); // Company found

      vi.mocked(mockEm.count)
        .mockResolvedValueOnce(4) // 4 existing users
        .mockResolvedValueOnce(1); // 1 pending invite = 5 total

      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: 'office-123',
        allowedOfficeIds: ['office-123'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Company has reached maximum seats (5)');
    });

    it('should fail if current office does not exist', async () => {
      const company = createMockCompany();

      vi.mocked(mockEm.findOne)
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(null) // No existing invite
        .mockResolvedValueOnce(company) // Company found
        .mockResolvedValueOnce(null); // Current office NOT found

      vi.mocked(mockEm.count)
        .mockResolvedValueOnce(5) // 5 existing users
        .mockResolvedValueOnce(2); // 2 pending invites

      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: 'invalid-office',
        allowedOfficeIds: ['invalid-office'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Current office not found or does not belong to this company',
      );
    });

    it('should fail if allowed offices do not all exist', async () => {
      const company = createMockCompany();
      const office = createMockOffice({ company });

      vi.mocked(mockEm.findOne)
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce(null) // No existing invite
        .mockResolvedValueOnce(company) // Company found
        .mockResolvedValueOnce(office); // Current office found

      // Only 1 of 2 allowed offices found
      vi.mocked(mockEm.find).mockResolvedValueOnce([office]);

      vi.mocked(mockEm.count)
        .mockResolvedValueOnce(5) // 5 existing users
        .mockResolvedValueOnce(2); // 2 pending invites

      const result = await createInvite(mockEm as unknown as EntityManager, {
        email: 'newuser@example.com',
        companyId: 'company-123',
        invitedById: 'user-123',
        roles: ['role-1'],
        inviterName: 'Test User',
        currentOfficeId: office.id,
        allowedOfficeIds: [office.id, 'non-existent-office'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'One or more allowed offices not found or do not belong to this company',
      );
    });
  });

  describe('validateInviteToken', () => {
    it('should return valid for a valid token', async () => {
      const invite = createMockInvite();
      vi.mocked(mockEm.findOne).mockResolvedValue(invite);

      const result = await validateInviteToken(
        mockEm as unknown as EntityManager,
        'mock-token-12345',
      );

      expect(result.valid).toBe(true);
      expect(result.email).toBe('newuser@example.com');
      expect(result.companyName).toBe('Test Company');
    });

    it('should return invalid for non-existent token', async () => {
      vi.mocked(mockEm.findOne).mockResolvedValue(null);

      const result = await validateInviteToken(
        mockEm as unknown as EntityManager,
        'invalid-token',
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid invitation token');
    });

    it('should return invalid for expired invite', async () => {
      const invite = createMockInvite({
        isExpired: true,
        isValid: false,
      });
      vi.mocked(mockEm.findOne).mockResolvedValue(invite);

      const result = await validateInviteToken(
        mockEm as unknown as EntityManager,
        'mock-token-12345',
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invitation has expired');
    });

    it('should return invalid for already accepted invite', async () => {
      const invite = createMockInvite({
        status: InviteStatus.ACCEPTED,
        isValid: false,
      });
      vi.mocked(mockEm.findOne).mockResolvedValue(invite);

      const result = await validateInviteToken(
        mockEm as unknown as EntityManager,
        'mock-token-12345',
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invitation has already been used');
    });
  });

  describe('acceptInvite', () => {
    it('should create user and accept invite with office assignments', async () => {
      const office = createMockOffice();
      const invite = createMockInvite({
        currentOffice: office,
        allowedOffices: [office.id],
      });

      vi.mocked(mockEm.findOne)
        .mockResolvedValueOnce(invite) // validateInviteToken finds invite
        .mockResolvedValueOnce(null); // No existing user with email

      const result = await acceptInvite(mockEm as unknown as EntityManager, {
        token: 'mock-token-12345',
        password: 'SecurePassword123!',
        nameFirst: 'New',
        nameLast: 'User',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      // Verify persist was called for user and user office records
      expect(mockEm.persist).toHaveBeenCalled();
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should create user with multiple office access', async () => {
      const office1 = createMockOffice({ id: 'office-1', name: 'Office 1' });
      const office2 = createMockOffice({ id: 'office-2', name: 'Office 2' });
      const invite = createMockInvite({
        currentOffice: office1,
        allowedOffices: [office1.id, office2.id],
      });

      vi.mocked(mockEm.findOne)
        .mockResolvedValueOnce(invite) // validateInviteToken finds invite
        .mockResolvedValueOnce(null); // No existing user with email

      const result = await acceptInvite(mockEm as unknown as EntityManager, {
        token: 'mock-token-12345',
        password: 'SecurePassword123!',
        nameFirst: 'New',
        nameLast: 'User',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      // Persist should be called for user + 2 UserOffice records
      expect(mockEm.persist).toHaveBeenCalled();
    });

    it('should fail for invalid token', async () => {
      vi.mocked(mockEm.findOne).mockResolvedValue(null);

      const result = await acceptInvite(mockEm as unknown as EntityManager, {
        token: 'invalid-token',
        password: 'SecurePassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid invitation token');
    });
  });

  describe('revokeInvite', () => {
    it('should revoke a pending invite', async () => {
      const invite = createMockInvite();
      vi.mocked(mockEm.findOne).mockResolvedValue(invite);

      const result = await revokeInvite(
        mockEm as unknown as EntityManager,
        'invite-123',
        'company-123',
      );

      expect(result.success).toBe(true);
      expect(invite.status).toBe(InviteStatus.REVOKED);
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should fail for non-existent invite', async () => {
      vi.mocked(mockEm.findOne).mockResolvedValue(null);

      const result = await revokeInvite(
        mockEm as unknown as EntityManager,
        'non-existent',
        'company-123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invite not found or already processed');
    });
  });

  describe('resendInvite', () => {
    it('should resend a pending invite with new token', async () => {
      const invite = createMockInvite();
      vi.mocked(mockEm.findOne).mockResolvedValue(invite);

      const result = await resendInvite(
        mockEm as unknown as EntityManager,
        'invite-123',
        'company-123',
        'Test User',
      );

      expect(result.success).toBe(true);
      expect(mockEm.flush).toHaveBeenCalled();
    });

    it('should fail for non-pending invite', async () => {
      const invite = createMockInvite({ status: InviteStatus.ACCEPTED });
      vi.mocked(mockEm.findOne).mockResolvedValue(invite);

      const result = await resendInvite(
        mockEm as unknown as EntityManager,
        'invite-123',
        'company-123',
        'Test User',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only resend pending invites');
    });
  });

  describe('listPendingInvites', () => {
    it('should return paginated pending invites', async () => {
      const invites = [
        createMockInvite(),
        createMockInvite({ id: 'invite-2' }),
      ];
      vi.mocked(mockEm.findAndCount).mockResolvedValue([invites, 2]);

      const result = await listPendingInvites(
        mockEm as unknown as EntityManager,
        'company-123',
        { page: 1, limit: 20 },
      );

      expect(result.invites).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should use default pagination', async () => {
      vi.mocked(mockEm.findAndCount).mockResolvedValue([[], 0]);

      await listPendingInvites(
        mockEm as unknown as EntityManager,
        'company-123',
      );

      expect(mockEm.findAndCount).toHaveBeenCalledWith(
        UserInvite,
        { company: 'company-123', status: InviteStatus.PENDING },
        expect.objectContaining({
          limit: 20,
          offset: 0,
        }),
      );
    });
  });
});
