/**
 * Invite service for managing user invitations.
 * Handles creating, validating, accepting, revoking, and resending invites.
 */
import {
  User,
  UserInvite,
  Company,
  InviteStatus,
  LoginEventType,
  SessionSource,
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
};

/** Options for creating an invite */
export type CreateInviteOptions = {
  email: string;
  companyId: string;
  invitedById: string;
  roles: string[];
  inviterName: string;
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
 * Create and send a user invitation
 */
export async function createInvite(
  em: EntityManager,
  options: CreateInviteOptions,
): Promise<CreateInviteResult> {
  const { email, companyId, invitedById, roles, inviterName } = options;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await em.findOne(User, { email: normalizedEmail });
  if (existingUser) {
    return { success: false, error: 'A user with this email already exists' };
  }

  // Check for existing pending invite
  const existingInvite = await em.findOne(UserInvite, {
    email: normalizedEmail,
    status: InviteStatus.PENDING,
  });
  if (existingInvite && existingInvite.isValid) {
    return {
      success: false,
      error: 'A pending invitation already exists for this email',
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

  // Generate token and create invite
  const token = generateSecureToken(32);
  const invite = createInviteEntity(em, {
    email: normalizedEmail,
    tokenHash: hashToken(token),
    company,
    invitedById,
    roles,
  });

  await em.persistAndFlush(invite);

  // Log the event
  const inviter = await em.findOne(User, { id: invitedById });
  if (inviter) {
    await logInviteSentEvent(em, inviter, normalizedEmail);
  }

  // Send email
  await sendInviteEmailSafe(normalizedEmail, token, company.name, inviterName);

  // Return token in development for testing
  if (process.env['NODE_ENV'] === 'development') {
    return { success: true, invite, token };
  }

  return { success: true, invite };
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
  },
): UserInvite {
  const invite = new UserInvite();
  invite.email = opts.email;
  invite.tokenHash = opts.tokenHash;
  invite.company = opts.company;
  invite.invitedBy = em.getReference(User, opts.invitedById);
  invite.roles = opts.roles;
  invite.expiresAt = new Date(
    Date.now() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
  );
  invite.status = InviteStatus.PENDING;
  return invite;
}

/**
 * Log invite sent event
 */
async function logInviteSentEvent(
  em: EntityManager,
  inviter: User,
  inviteeEmail: string,
): Promise<void> {
  await logLoginEvent(em, inviter, LoginEventType.INVITE_SENT, {
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
    { populate: ['company'] },
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
  };
}

/**
 * Accept an invite and create the user account
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

  // Double-check user doesn't exist
  const existingUser = await em.findOne(User, { email: invite.email });
  if (existingUser) {
    return { success: false, error: 'A user with this email already exists' };
  }

  // Create user
  const user = await createUserFromInvite(em, invite, password, {
    nameFirst,
    nameLast,
  });

  // Assign roles
  await assignInviteRoles(em, user, invite);

  // Mark invite as accepted
  invite.status = InviteStatus.ACCEPTED;
  invite.acceptedAt = new Date();

  // Log the event
  await logLoginEvent(em, user, LoginEventType.INVITE_ACCEPTED, {
    ipAddress,
    userAgent,
    source: SessionSource.WEB,
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

  em.persist(user);
  return user;
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
      populate: ['invitedBy'],
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
