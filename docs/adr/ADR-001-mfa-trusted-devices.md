# ADR-001: MFA Trusted Devices

## Status

Accepted

## Context

Users with MFA enabled must enter a verification code on every login. While this improves security, it creates friction for users who frequently log in from the same device (e.g., their work computer or personal laptop).

We needed a way to reduce this friction while maintaining security. The key requirements were:

1. Allow users to opt-in to "trust" a device
2. Trusted devices should skip MFA for a limited time
3. The solution must be secure against token theft
4. Users should be able to manage/revoke trusted devices

## Decision

We implemented a "Trust this device for 30 days" feature that uses HTTP-only cookies to identify trusted devices.

### Implementation Details

1. **Device Token Generation**
   - Generate a 64-byte cryptographically secure random token
   - Hash the token with SHA-256 before storing in the database
   - Store the raw token in an HTTP-only cookie

2. **Cookie Configuration**
   - Name: `device_trust`
   - Max-Age: 30 days
   - HttpOnly: true (prevents JavaScript access)
   - Secure: true in production (HTTPS only)
   - SameSite: lax (CSRF protection)

3. **Verification Flow**
   - On login, check for `device_trust` cookie before requiring MFA
   - Hash the cookie value and compare against stored `deviceFingerprint`
   - Verify the device belongs to the logging-in user
   - Check `trustExpiresAt` has not passed
   - Update `lastSeenAt` on successful verification

4. **Storage Schema**
   - Uses existing `TrustedDevice` entity
   - Stores: user reference, hashed token, device name, last IP, timestamps

## Consequences

### Positive

- **Improved UX**: Users on trusted devices skip MFA, reducing friction
- **Secure by design**: Tokens are hashed before storage, HTTP-only cookies prevent XSS
- **Time-limited**: 30-day expiration provides balance between convenience and security
- **Auditable**: `lastSeenAt` and IP tracking enables security auditing
- **User control**: Users can manage trusted devices through account settings

### Negative

- **Cookie dependence**: Users who clear cookies must re-verify MFA
- **Device-bound**: Cannot transfer trust between devices
- **Storage overhead**: Each trusted device creates a database record

### Neutral

- Device name is parsed from User-Agent (best effort, not guaranteed accurate)
- Trust is per-user, not shared across accounts on same device

## Alternatives Considered

### Alternative 1: Browser Fingerprinting

Use browser characteristics (screen size, plugins, fonts) to identify devices.

**Not chosen because:**

- Fingerprinting is fragile and can change
- Privacy concerns with collecting detailed browser data
- More complex to implement reliably
- Some browsers actively fight fingerprinting

### Alternative 2: Refresh Token with MFA Flag

Issue a long-lived refresh token that includes an "MFA verified" flag.

**Not chosen because:**

- Tokens would need to be stored client-side (localStorage)
- Vulnerable to XSS attacks
- Harder to revoke compared to cookies with server-side validation

### Alternative 3: IP-based Trust

Trust users from previously-seen IP addresses.

**Not chosen because:**

- IP addresses change (mobile, VPN, ISP reassignment)
- Shared IPs (office, coffee shops) would trust all users
- Easy to spoof

## Related

- `apps/api/src/services/auth/trusted-device.ts` - Implementation
- `apps/api/src/entities/TrustedDevice.entity.ts` - Database entity
- `docs/FRONTEND_AUTH_API.md` - API documentation
- `apps/api/src/__tests__/services/auth/trusted-device.test.ts` - Unit tests
- `apps/api/src/__tests__/integration/mfa.test.ts` - Integration tests (Trusted Device Flow section)
