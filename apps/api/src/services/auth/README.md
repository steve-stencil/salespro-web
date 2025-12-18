# Auth Services

Authentication and authorization services for the API.

## Purpose

This folder contains all authentication-related business logic including login, session management, MFA, password management, and trusted devices.

## Structure

| File                | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `index.ts`          | Public exports for the auth module                    |
| `types.ts`          | TypeScript types for auth operations                  |
| `config.ts`         | Configuration constants (lockout settings, etc.)      |
| `login.ts`          | Login authentication and account lockout logic        |
| `session.ts`        | Session management (logout, revoke, list sessions)    |
| `password.ts`       | Password reset, change, and validation                |
| `mfa.ts`            | MFA code generation, verification, and recovery codes |
| `trusted-device.ts` | Trusted device management for MFA bypass              |
| `events.ts`         | Login event logging for audit trails                  |

## Key Patterns

### Login Flow

```typescript
import { login, handleSuccessfulLogin } from './auth';

const result = await login(em, {
  email,
  password,
  source: SessionSource.WEB,
  ipAddress,
  userAgent,
  sessionId,
  deviceTrustToken, // Optional: For MFA bypass on trusted devices
});

if (result.requiresMfa) {
  // Redirect to MFA verification
}
```

### MFA Verification with Device Trust

```typescript
import { verifyMfaCode, createTrustedDevice } from './auth';

// Verify MFA code
const result = await verifyMfaCode(em, userId, code, sessionId, ip, userAgent);

if (result.success && trustDevice) {
  // Create trusted device to skip MFA on subsequent logins
  const { device, token } = await createTrustedDevice(
    em,
    userId,
    userAgent,
    ip,
  );
  // Set device_trust cookie with token
}
```

### Trusted Device Verification

```typescript
import { verifyTrustedDevice, updateTrustedDeviceLastSeen } from './auth';

const trustResult = await verifyTrustedDevice(em, userId, deviceTrustToken);

if (trustResult.trusted) {
  // Skip MFA - device is trusted
  await updateTrustedDeviceLastSeen(em, trustResult.device!, ipAddress);
}
```

## Configuration

### Lockout Settings (`config.ts`)

- **First lockout:** 5 failed attempts → 5 minute lockout
- **Second lockout:** 10 failed attempts → 15 minute lockout
- **Long lockout:** 15+ failed attempts → 60 minute lockout

### MFA Settings (`mfa.ts`)

- **Code length:** 6 digits
- **Code expiry:** 5 minutes
- **Max attempts:** 5 per code
- **Recovery codes:** 10 codes per user

### Trusted Device Settings (`trusted-device.ts`)

- **Trust duration:** 30 days
- **Token length:** 64 bytes (128 hex chars)
- **Cookie name:** `device_trust`

## Security Considerations

1. **Password Hashing:** Uses Argon2id with secure parameters
2. **Token Storage:** Device tokens are hashed (SHA-256) before storage
3. **Session Fixation:** Sessions are regenerated on login
4. **Brute Force Protection:** Progressive account lockout
5. **MFA Rate Limiting:** Max 5 attempts per code, then invalidated

## Dependencies

- `../../entities` - User, Session, TrustedDevice entities
- `../../lib/crypto` - Password hashing, token generation
- `../../lib/email` - Sending MFA codes via email

## Related

- `../../routes/auth/` - Auth route handlers
- `../../middleware/requireAuth.ts` - Authentication middleware
- `docs/FRONTEND_AUTH_API.md` - Frontend API documentation
