/**
 * Auth module - handles authentication, sessions, and password management
 * @module services/auth
 */

// Types
export { LoginErrorCode } from './types';
export type {
  LoginParams,
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
} from './types';

// Config
export { LOCKOUT_CONFIG } from './config';

// Login operations
export { login, handleSuccessfulLogin, handleFailedLogin } from './login';

// Password operations
export {
  requestPasswordReset,
  resetPassword,
  changePassword,
  validatePassword,
} from './password';

// Session operations
export {
  logout,
  logoutAllSessions,
  getUserSessions,
  revokeSession,
} from './session';

// Event logging
export { logLoginEvent } from './events';
