/**
 * OAuth scope definitions for the OAuth 2.0 provider
 */

/** Scope definition with description and category */
export interface ScopeDefinition {
  description: string;
  category: string;
}

/**
 * All available OAuth scopes and their descriptions.
 * Used for scope validation and consent screen display.
 */
export const OAUTH_SCOPES: Record<string, ScopeDefinition> = {
  // Profile scopes
  'read:profile': {
    description: 'Read basic profile information',
    category: 'profile',
  },
  'write:profile': {
    description: 'Update profile information',
    category: 'profile',
  },

  // Data scopes
  'read:data': {
    description: 'Read application data',
    category: 'data',
  },
  'write:data': {
    description: 'Create and modify application data',
    category: 'data',
  },
  'delete:data': {
    description: 'Delete application data',
    category: 'data',
  },

  // Company scopes
  'read:company': {
    description: 'Read company information',
    category: 'company',
  },
  'manage:company': {
    description: 'Manage company settings',
    category: 'company',
  },

  // User management scopes
  'read:users': {
    description: 'Read user list in your company',
    category: 'users',
  },
  'manage:users': {
    description: 'Invite and manage users',
    category: 'users',
  },

  // Offline access
  offline_access: {
    description: 'Access your data when you are not present',
    category: 'access',
  },
};

export type OAuthScope = keyof typeof OAUTH_SCOPES;

/**
 * Validates that all requested scopes are valid and allowed for the client.
 */
export function validateScopes(
  requestedScopes: string[],
  allowedScopes: string[],
): { valid: boolean; invalidScopes: string[] } {
  const allValidScopes = Object.keys(OAUTH_SCOPES);
  const invalidScopes = requestedScopes.filter(
    scope => !allValidScopes.includes(scope) || !allowedScopes.includes(scope),
  );

  return {
    valid: invalidScopes.length === 0,
    invalidScopes,
  };
}

/**
 * Parse space-separated scope string into array
 */
export function parseScopes(scopeString: string | undefined): string[] {
  if (!scopeString) return [];
  return scopeString.split(' ').filter(Boolean);
}

/**
 * Format scope array into space-separated string
 */
export function formatScopes(scopes: string[]): string {
  return scopes.join(' ');
}
