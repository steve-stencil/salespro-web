import { createHash, randomBytes } from 'crypto';

/**
 * PKCE (Proof Key for Code Exchange) validation helpers
 * RFC 7636: https://tools.ietf.org/html/rfc7636
 */

/** PKCE code challenge methods */
export type CodeChallengeMethod = 'S256' | 'plain';

/**
 * Generate a cryptographically secure code verifier
 * Must be 43-128 characters using unreserved URI characters
 */
export function generateCodeVerifier(length: number = 43): string {
  // Generate enough random bytes and convert to base64url
  const bytes = Math.ceil((length * 3) / 4);
  return randomBytes(bytes).toString('base64url').slice(0, length);
}

/**
 * Validate a PKCE code verifier against a code challenge
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: CodeChallengeMethod = 'S256',
): boolean {
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }

  // S256: BASE64URL(SHA256(code_verifier)) == code_challenge
  const hash = createHash('sha256').update(codeVerifier).digest('base64url');

  return hash === codeChallenge;
}

/**
 * Generate a code challenge from a code verifier
 * (For testing purposes - clients should generate their own)
 */
export function generateCodeChallenge(
  codeVerifier: string,
  method: CodeChallengeMethod = 'S256',
): string {
  if (method === 'plain') {
    return codeVerifier;
  }

  return createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Validate that a code verifier meets PKCE requirements
 * Must be 43-128 characters, using [A-Z], [a-z], [0-9], "-", ".", "_", "~"
 */
export function isValidCodeVerifier(codeVerifier: string): boolean {
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    return false;
  }

  // Check for valid characters (unreserved URI characters)
  const validPattern = /^[A-Za-z0-9\-._~]+$/;
  return validPattern.test(codeVerifier);
}

/**
 * Validate that a code challenge method is supported
 */
export function isValidChallengeMethod(
  method: string,
): method is CodeChallengeMethod {
  return method === 'S256' || method === 'plain';
}
