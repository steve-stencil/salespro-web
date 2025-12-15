/**
 * Shared types and enums for authentication entities
 */

/** Subscription tier levels for companies */
export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

/** Strategy for handling session limits when exceeded */
export enum SessionLimitStrategy {
  /** Reject new login attempts */
  BLOCK_NEW = 'block_new',
  /** Revoke the oldest session (FIFO) */
  REVOKE_OLDEST = 'revoke_oldest',
  /** Revoke the least recently used session */
  REVOKE_LRU = 'revoke_lru',
  /** Prompt user to choose which session to end */
  PROMPT_USER = 'prompt_user',
}

/** Source/platform of a session */
export enum SessionSource {
  WEB = 'web',
  IOS = 'ios',
  ANDROID = 'android',
  /** OAuth/API token sessions */
  API = 'api',
}

/** Types of login-related events for audit logging */
export enum LoginEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  SESSION_EXPIRED = 'session_expired',
  SESSION_REVOKED = 'session_revoked',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  ACCOUNT_DEACTIVATED = 'account_deactivated',
  ACCOUNT_REACTIVATED = 'account_reactivated',
  INVITE_SENT = 'invite_sent',
  INVITE_ACCEPTED = 'invite_accepted',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_BACKUP_CODE_USED = 'mfa_backup_code_used',
  TRUSTED_DEVICE_ADDED = 'trusted_device_added',
  TRUSTED_DEVICE_REMOVED = 'trusted_device_removed',
  API_KEY_CREATED = 'api_key_created',
  API_KEY_REVOKED = 'api_key_revoked',
}

/** Status of a user invitation */
export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/** OAuth client type (confidential vs public) */
export enum OAuthClientType {
  /** Server-side apps with client_secret */
  CONFIDENTIAL = 'confidential',
  /** Mobile/SPA apps without client_secret (PKCE required) */
  PUBLIC = 'public',
}

/** Company-configurable password policy */
export interface PasswordPolicy {
  /** Minimum password length */
  minLength: number;
  /** Require at least one uppercase letter */
  requireUppercase: boolean;
  /** Require at least one lowercase letter */
  requireLowercase: boolean;
  /** Require at least one number */
  requireNumbers: boolean;
  /** Require at least one special character */
  requireSpecialChars: boolean;
  /** Days until password expires (0 = no expiration) */
  maxAgeDays: number;
  /** Number of previous passwords to prevent reuse */
  historyCount: number;
}

/** Default password policy for new companies */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  maxAgeDays: 0,
  historyCount: 5,
};
