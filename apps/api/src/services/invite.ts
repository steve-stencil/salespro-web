/**
 * Invite service for managing user invitations.
 * Handles creating, validating, accepting, revoking, and resending invites.
 * Supports both new user invites and existing user invites (multi-company access).
 */
import { env } from '../config/env';
import {
  User,
  UserInvite,
  Company,
  Office,
  UserOffice,
  UserCompany,
  InviteStatus,
  LoginEventType,
  SessionSource,
  UserType,
} from '../entities';
import { hashPassword, generateSecureToken, hashToken } from '../lib/crypto';
import { emailService } from '../lib/email';
import { AppError, ErrorCode } from '../lib/errors';

import { logLoginEvent } from './auth/events';
import { PermissionService } from './PermissionService';

import type { EntityManager } from '@mikro-orm/core';

/** Default invite expiration in days */
const INVITE_EXPIRATION_DAYS = 7;

/** Result type for invite creation */
export type CreateInviteResult = {
  success: boolean;
  invite?: UserInvite;
  error?: string;
  /** Token returned only in development mode */
  token?: string;
  /** Existing invite ID when duplicate detected */
  existingInviteId?: string;
  /** True if the invite is for an existing user to join another company */
  isExistingUserInvite?: boolean;
};

/** Result type for invite acceptance */
export type AcceptInviteResult = {
  success: boolean;
  user?: User;
  error?: string;
};

/** Result type for invite validation */
export type ValidateInviteResult = {
  valid: boolean;
  invite?: UserInvite;
  companyName?: string;
  email?: string;
  error?: string;
  /** True if this is an invite for an existing user to join an additional company */
  isExistingUserInvite?: boolean;
};

/** Options for creating an invite */
export type CreateInviteOptions = {
  email: string;
  companyId: string;
  invitedById: string;
  roles: string[];
  inviterName: string;
  /** The office to set as the user's current/active office (required) */
  currentOfficeId: string;
  /** Array of office IDs the user will have access to (required, non-empty) */
  allowedOfficeIds: string[];
  /** IP address of the inviter for audit logging */
  ipAddress: string;
  /** User agent of the inviter for audit logging */
  userAgent: string;
};

/** Options for accepting an invite */
export type AcceptInviteOptions = {
  token: string;
  password: string;
  nameFirst?: string;
  nameLast?: string;
  ipAddress: string;
  userAgent: string;
};

/**
 * Create and send a user invitation.
 * Supports two scenarios:
 * 1. New user invite: User doesn't exist, will create account when accepting
 * 2. Existing user invite: User already has account, will be added to new company
 */
export async function createInvite(
  em: EntityManager,
  options: CreateInviteOptions,
): Promise<CreateInviteResult> {
  const {
    email,
    companyId,
    invitedById,
    roles,
    inviterName,
    currentOfficeId,
    allowedOfficeIds,
    ipAddress,
    userAgent,
  } = options;
  const normalizedEmail = email.toLowerCase().trim();

  // Validate office fields (required)
  const officeValidation = validateOfficeFields(
    currentOfficeId,
    allowedOfficeIds,
  );
  if (!officeValidation.success) {
    return officeValidation;
  }

  // Check if user already exists
  const existingUser = await em.findOne(User, {
    email: normalizedEmail,
    deletedAt: null,
  });

  // If user exists, check if they're already in this company
  if (existingUser) {
    // Only company users can be invited to additional companies
    const userType = existingUser.userType as UserType;
    if (userType !== UserType.COMPANY) {
      return {
        success: false,
        error: 'Internal platform users cannot be invited to companies',
      };
    }

    // Check if user is already a member of this company
    const existingMembership = await em.findOne(UserCompany, {
      user: existingUser.id,
      company: companyId,
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        return {
          success: false,
          error: 'User is already a member of this company',
        };
      } else {
        // User was previously deactivated in this company
        return {
          success: false,
          error:
            'User was previously deactivated in this company. Reactivate their access instead.',
        };
      }
    }
  }

  // Check for existing pending invite for the same email AND company
  const existingInvite = await em.findOne(UserInvite, {
    email: normalizedEmail,
    company: companyId,
    status: InviteStatus.PENDING,
  });
  if (existingInvite && existingInvite.isValid) {
    return {
      success: false,
      error: 'A pending invitation already exists for this email',
      existingInviteId: existingInvite.id,
    };
  }

  // Check company seat limit
  const company = await em.findOne(Company, { id: companyId });
  if (!company) {
    return { success: false, error: 'Company not found' };
  }

  const seatCheckResult = await checkSeatLimit(em, company);
  if (!seatCheckResult.success) {
    return seatCheckResult;
  }

  // Validate current office exists and belongs to company
  const currentOffice = await em.findOne(Office, {
    id: currentOfficeId,
    company: companyId,
    isActive: true,
  });
  if (!currentOffice) {
    return {
      success: false,
      error: 'Current office not found or does not belong to this company',
    };
  }

  // Validate all allowed offices exist and belong to company
  const allowedOffices = await em.find(Office, {
    id: { $in: allowedOfficeIds },
    company: companyId,
    isActive: true,
  });
  if (allowedOffices.length !== allowedOfficeIds.length) {
    return {
      success: false,
      error:
        'One or more allowed offices not found or do not belong to this company',
    };
  }

  // Generate token and create invite
  const token = generateSecureToken(32);
  const invite = createInviteEntity(em, {
    email: normalizedEmail,
    tokenHash: hashToken(token),
    company,
    invitedById,
    roles,
    currentOffice,
    allowedOfficeIds,
    existingUser: existingUser ?? undefined,
  });

  await em.persistAndFlush(invite);

  // Log the event
  const inviter = await em.findOne(User, { id: invitedById });
  if (inviter) {
    await logInviteSentEvent(
      em,
      inviter,
      normalizedEmail,
      ipAddress,
      userAgent,
    );
  }

  // Send email - different message for existing users
  if (existingUser) {
    await sendExistingUserInviteEmailSafe(
      normalizedEmail,
      token,
      company.name,
      inviterName,
    );
  } else {
    await sendInviteEmailSafe(
      normalizedEmail,
      token,
      company.name,
      inviterName,
    );
  }

  // Return token in development for testing
  if (process.env['NODE_ENV'] === 'development') {
    return {
      success: true,
      invite,
      token,
      isExistingUserInvite: !!existingUser,
    };
  }

  return { success: true, invite, isExistingUserInvite: !!existingUser };
}

/**
 * Validate office fields for invite creation
 */
function validateOfficeFields(
  currentOfficeId: string | undefined,
  allowedOfficeIds: string[] | undefined,
): CreateInviteResult {
  if (!currentOfficeId) {
    return { success: false, error: 'Current office is required' };
  }

  if (!allowedOfficeIds || allowedOfficeIds.length === 0) {
    return { success: false, error: 'At least one allowed office is required' };
  }

  if (!allowedOfficeIds.includes(currentOfficeId)) {
    return {
      success: false,
      error: 'Current office must be one of the allowed offices',
    };
  }

  return { success: true };
}

/**
 * Check if company has available seats
 */
async function checkSeatLimit(
  em: EntityManager,
  company: Company,
): Promise<CreateInviteResult> {
  const userCount = await em.count(User, { company: company.id });
  const pendingInvites = await em.count(UserInvite, {
    company: company.id,
    status: InviteStatus.PENDING,
  });

  if (userCount + pendingInvites >= company.maxSeats) {
    return {
      success: false,
      error: `Company has reached maximum seats (${company.maxSeats})`,
    };
  }

  return { success: true };
}

/**
 * Create a UserInvite entity with the given options
 */
function createInviteEntity(
  em: EntityManager,
  opts: {
    email: string;
    tokenHash: string;
    company: Company;
    invitedById: string;
    roles: string[];
    currentOffice: Office;
    allowedOfficeIds: string[];
    existingUser?: User;
  },
): UserInvite {
  const invite = new UserInvite();
  invite.email = opts.email;
  invite.tokenHash = opts.tokenHash;
  invite.company = opts.company;
  invite.invitedBy = em.getReference(User, opts.invitedById);
  invite.roles = opts.roles;
  invite.currentOffice = opts.currentOffice;
  invite.allowedOffices = opts.allowedOfficeIds;
  invite.expiresAt = new Date(
    Date.now() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
  );
  invite.status = InviteStatus.PENDING;

  // Set existing user fields for multi-company invites
  if (opts.existingUser) {
    invite.isExistingUserInvite = true;
    invite.existingUser = opts.existingUser;
  }

  return invite;
}

/**
 * Log invite sent event
 */
async function logInviteSentEvent(
  em: EntityManager,
  inviter: User,
  inviteeEmail: string,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  await logLoginEvent(em, inviter, LoginEventType.INVITE_SENT, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
    metadata: { inviteeEmail },
  });
}

/**
 * Send invite email with error handling
 */
async function sendInviteEmailSafe(
  email: string,
  token: string,
  companyName: string,
  inviterName: string,
): Promise<void> {
  if (!emailService.isConfigured()) {
    return;
  }

  try {
    await emailService.sendInviteEmail({
      email,
      token,
      companyName,
      inviterName,
      expiresInDays: INVITE_EXPIRATION_DAYS,
    });
  } catch (error) {
    handleEmailError(error, email);
  }
}

/**
 * Send invite email to an existing user (for joining an additional company)
 */
async function sendExistingUserInviteEmailSafe(
  email: string,
  token: string,
  companyName: string,
  inviterName: string,
): Promise<void> {
  if (!emailService.isConfigured()) {
    return;
  }

  try {
    // Use the same email template but with different subject/content indicating
    // they're being invited to an additional company (not creating a new account)
    await emailService.sendInviteEmail({
      email,
      token,
      companyName,
      inviterName,
      expiresInDays: INVITE_EXPIRATION_DAYS,
      // Pass additional context for existing users
      isExistingUser: true,
    });
  } catch (error) {
    handleEmailError(error, email);
  }
}

/**
 * Handle email sending errors with helpful error messages
 */
function handleEmailError(error: unknown, email: string): void {
  // Detect AWS SES sandbox mode errors and provide helpful guidance
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isSandboxError =
    errorMessage.includes('not verified') ||
    errorMessage.includes('MessageRejected') ||
    errorMessage.includes('failed the check');

  if (isSandboxError) {
    console.error(
      'AWS SES Error: Email addresses must be verified in SES sandbox mode.',
      '\nSender:',
      env.SES_FROM_EMAIL,
      '\nRecipient:',
      email,
      '\nError:',
      errorMessage,
      '\n\nTo fix:',
      '\n1. Verify both sender and recipient emails in AWS SES Console',
      '\n2. Or request production access from AWS SES to exit sandbox mode',
    );
  } else {
    console.error('Failed to send invite email:', error);
  }
}

/**
 * Validate an invite token
 */
export async function validateInviteToken(
  em: EntityManager,
  token: string,
): Promise<ValidateInviteResult> {
  const tokenHash = hashToken(token);
  const invite = await em.findOne(
    UserInvite,
    { tokenHash },
    { populate: ['company', 'currentOffice', 'invitedBy', 'existingUser'] },
  );

  if (!invite) {
    return { valid: false, error: 'Invalid invitation token' };
  }

  if (!invite.isValid) {
    if (invite.status === InviteStatus.ACCEPTED) {
      return { valid: false, error: 'This invitation has already been used' };
    }
    if (invite.status === InviteStatus.REVOKED) {
      return { valid: false, error: 'This invitation has been revoked' };
    }
    if (invite.isExpired) {
      return { valid: false, error: 'This invitation has expired' };
    }
    return { valid: false, error: 'Invalid invitation' };
  }

  return {
    valid: true,
    invite,
    companyName: invite.company.name,
    email: invite.email,
    isExistingUserInvite: invite.isExistingUserInvite,
  };
}

/**
 * Accept an invite and create the user account or add to company.
 * Handles two scenarios:
 * 1. New user invite: Creates new user account + UserCompany + roles + offices
 * 2. Existing user invite: Creates UserCompany + roles + offices (no new user)
 */
export async function acceptInvite(
  em: EntityManager,
  options: AcceptInviteOptions,
): Promise<AcceptInviteResult> {
  const { token, password, nameFirst, nameLast, ipAddress, userAgent } =
    options;

  // Validate token
  const validation = await validateInviteToken(em, token);
  if (!validation.valid || !validation.invite) {
    return { success: false, error: validation.error };
  }

  const invite = validation.invite;
  let user: User;

  if (invite.isExistingUserInvite) {
    // Existing user invite: Add user to new company
    if (!invite.existingUser) {
      return {
        success: false,
        error: 'Invalid invite: missing existing user reference',
      };
    }

    // Verify the user still exists and is active
    const existingUser = await em.findOne(User, {
      id: invite.existingUser.id,
      deletedAt: null,
    });

    if (!existingUser) {
      return { success: false, error: 'User account no longer exists' };
    }

    if (!existingUser.isActive) {
      return { success: false, error: 'User account is deactivated' };
    }

    // Create UserCompany record for the new company membership
    const userCompany = new UserCompany();
    userCompany.user = existingUser;
    userCompany.company = invite.company;
    userCompany.joinedAt = new Date();
    userCompany.lastAccessedAt = new Date();
    em.persist(userCompany);

    // Assign roles for the new company
    await assignInviteRoles(em, existingUser, invite);

    // Assign office access for the new company
    assignInviteOfficeAccess(em, existingUser, invite);

    user = existingUser;
  } else {
    // New user invite: Create account
    // Double-check user doesn't exist
    const existingUser = await em.findOne(User, { email: invite.email });
    if (existingUser) {
      return { success: false, error: 'A user with this email already exists' };
    }

    // Create user
    user = await createUserFromInvite(em, invite, password, {
      nameFirst,
      nameLast,
    });

    // Assign roles
    await assignInviteRoles(em, user, invite);

    // Assign office access
    assignInviteOfficeAccess(em, user, invite);

    // Create UserCompany record for the initial company membership
    const userCompany = new UserCompany();
    userCompany.user = user;
    userCompany.company = invite.company;
    userCompany.joinedAt = new Date();
    userCompany.lastAccessedAt = new Date();
    em.persist(userCompany);
  }

  // Mark invite as accepted
  invite.status = InviteStatus.ACCEPTED;
  invite.acceptedAt = new Date();

  // Log the event
  await logLoginEvent(em, user, LoginEventType.INVITE_ACCEPTED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
    metadata: {
      companyId: invite.company.id,
      companyName: invite.company.name,
      isExistingUserInvite: invite.isExistingUserInvite,
    },
  });

  await em.flush();

  return { success: true, user };
}

/**
 * Create a user from an invite
 */
async function createUserFromInvite(
  em: EntityManager,
  invite: UserInvite,
  password: string,
  names: { nameFirst?: string; nameLast?: string },
): Promise<User> {
  const user = new User();
  user.email = invite.email;
  user.passwordHash = await hashPassword(password);
  user.company = invite.company;
  user.nameFirst = names.nameFirst;
  user.nameLast = names.nameLast;
  user.emailVerified = true; // Email is verified via invite
  user.emailVerifiedAt = new Date();

  // Set the current office from the invite
  user.currentOffice = invite.currentOffice;

  em.persist(user);
  return user;
}

/**
 * Assign office access from the invite to the user
 */
function assignInviteOfficeAccess(
  em: EntityManager,
  user: User,
  invite: UserInvite,
): void {
  // Create UserOffice records for each allowed office
  for (const officeId of invite.allowedOffices) {
    const userOffice = new UserOffice();
    userOffice.user = user;
    userOffice.office = em.getReference(Office, officeId);
    userOffice.assignedBy = invite.invitedBy;
    em.persist(userOffice);
  }
}

/**
 * Assign roles from the invite to the user
 */
async function assignInviteRoles(
  em: EntityManager,
  user: User,
  invite: UserInvite,
): Promise<void> {
  const permissionService = new PermissionService(em);

  for (const roleId of invite.roles) {
    await permissionService.assignRole(
      user.id,
      roleId,
      invite.company.id,
      invite.invitedBy.id,
    );
  }
}

/** Options for updating an invite */
export type UpdateInviteOptions = {
  roles?: string[];
  currentOfficeId?: string;
  allowedOfficeIds?: string[];
};

/**
 * Update a pending invite's roles and/or offices
 */
export async function updateInvite(
  em: EntityManager,
  inviteId: string,
  companyId: string,
  options: UpdateInviteOptions,
): Promise<CreateInviteResult> {
  const { roles, currentOfficeId, allowedOfficeIds } = options;

  const invite = await em.findOne(
    UserInvite,
    { id: inviteId, company: companyId, status: InviteStatus.PENDING },
    { populate: ['company', 'currentOffice'] },
  );

  if (!invite) {
    return { success: false, error: 'Invite not found or already processed' };
  }

  // Validate and update roles if provided
  if (roles !== undefined) {
    if (roles.length === 0) {
      return { success: false, error: 'At least one role is required' };
    }
    invite.roles = roles;
  }

  // Validate and update offices if provided
  if (allowedOfficeIds !== undefined) {
    if (allowedOfficeIds.length === 0) {
      return {
        success: false,
        error: 'At least one allowed office is required',
      };
    }

    // Validate all allowed offices exist and belong to company
    const allowedOffices = await em.find(Office, {
      id: { $in: allowedOfficeIds },
      company: companyId,
      isActive: true,
    });
    if (allowedOffices.length !== allowedOfficeIds.length) {
      return {
        success: false,
        error:
          'One or more allowed offices not found or do not belong to this company',
      };
    }

    invite.allowedOffices = allowedOfficeIds;
  }

  // Validate and update current office if provided
  if (currentOfficeId !== undefined) {
    // Ensure current office is in allowed offices
    const effectiveAllowedOffices = allowedOfficeIds ?? invite.allowedOffices;
    if (!effectiveAllowedOffices.includes(currentOfficeId)) {
      return {
        success: false,
        error: 'Current office must be one of the allowed offices',
      };
    }

    // Validate current office exists and belongs to company
    const currentOffice = await em.findOne(Office, {
      id: currentOfficeId,
      company: companyId,
      isActive: true,
    });
    if (!currentOffice) {
      return {
        success: false,
        error: 'Current office not found or does not belong to this company',
      };
    }

    invite.currentOffice = currentOffice;
  }

  await em.flush();

  return { success: true, invite };
}

/**
 * Revoke a pending invite
 */
export async function revokeInvite(
  em: EntityManager,
  inviteId: string,
  companyId: string,
): Promise<{ success: boolean; error?: string }> {
  const invite = await em.findOne(UserInvite, {
    id: inviteId,
    company: companyId,
    status: InviteStatus.PENDING,
  });

  if (!invite) {
    return { success: false, error: 'Invite not found or already processed' };
  }

  invite.status = InviteStatus.REVOKED;
  await em.flush();

  return { success: true };
}

/**
 * Resend an invite with a new token
 */
export async function resendInvite(
  em: EntityManager,
  inviteId: string,
  companyId: string,
  inviterName: string,
): Promise<CreateInviteResult> {
  const invite = await em.findOne(
    UserInvite,
    { id: inviteId, company: companyId },
    { populate: ['company'] },
  );

  if (!invite) {
    return { success: false, error: 'Invite not found' };
  }

  if (invite.status !== InviteStatus.PENDING) {
    return { success: false, error: 'Can only resend pending invites' };
  }

  // Generate new token and extend expiration
  const token = generateSecureToken(32);
  invite.tokenHash = hashToken(token);
  invite.expiresAt = new Date(
    Date.now() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
  );

  await em.flush();

  // Send email
  await sendInviteEmailSafe(
    invite.email,
    token,
    invite.company.name,
    inviterName,
  );

  if (process.env['NODE_ENV'] === 'development') {
    return { success: true, invite, token };
  }

  return { success: true, invite };
}

/**
 * List pending invites for a company
 */
export async function listPendingInvites(
  em: EntityManager,
  companyId: string,
  options: { page?: number; limit?: number } = {},
): Promise<{ invites: UserInvite[]; total: number }> {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const [invites, total] = await em.findAndCount(
    UserInvite,
    { company: companyId, status: InviteStatus.PENDING },
    {
      populate: ['invitedBy', 'currentOffice'],
      orderBy: { createdAt: 'DESC' },
      limit,
      offset,
    },
  );

  return { invites, total };
}

/**
 * Invite service error for failed invite operations
 */
export class InviteServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, ErrorCode.BAD_REQUEST, message, details);
    this.name = 'InviteServiceError';
  }
}
