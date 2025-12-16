/**
 * Email templates for password reset and MFA verification.
 * Uses Leap brand design tokens for consistent styling.
 * @see https://leap.atlassian.net/wiki/spaces/PROD/pages/38141995/Color+Tokens
 * @see https://leap.atlassian.net/wiki/spaces/PROD/pages/41123934/Typography+Tokens
 */

type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Leap Brand Design Tokens for Email Templates.
 * These values match the web app theme configuration.
 */
const LEAP_TOKENS = {
  colors: {
    primary: '#26D07C', // Leap Green - for primary CTAs
    primaryDark: '#1FBC6F', // Leap Green Dark - for hover states
    secondary: '#4779FF', // Leap Blue - for links
    textPrimary: '#2E2E2E', // Primary text color
    textSecondary: 'rgba(46, 46, 46, 0.6)', // Secondary text color
    textMuted: 'rgba(46, 46, 46, 0.5)', // Muted text color
    background: '#FFFFFF', // White background
    backgroundMuted: '#F5F5F5', // Light gray background for code blocks
    divider: 'rgba(46, 46, 46, 0.12)', // Divider color
    white: '#FFFFFF',
  },
  fonts: {
    headline: "'Poppins', Arial, sans-serif", // Headlines and buttons
    body: 'Arial, sans-serif', // Body copy
  },
  borderRadius: '8px',
} as const;

/**
 * Format minutes into a human-readable expiration string
 */
function formatExpiration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Generate password reset email template
 * @param resetUrl - The full URL for resetting the password
 * @param expiresInMinutes - Token expiration time in minutes (default: 60)
 */
export function passwordResetTemplate(
  resetUrl: string,
  expiresInMinutes: number = 60,
): EmailTemplate {
  const expirationText = formatExpiration(expiresInMinutes);
  const { colors, fonts, borderRadius } = LEAP_TOKENS;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${fonts.body}; background-color: ${colors.backgroundMuted};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${colors.background}; border-radius: ${borderRadius}; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; font-family: ${fonts.headline}; color: ${colors.textPrimary};">Reset Your Password</h1>
              
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 21px; font-family: ${fonts.body}; color: ${colors.textPrimary};">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0; width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; font-family: ${fonts.headline}; color: ${colors.white}; text-decoration: none; background-color: ${colors.primary}; border-radius: ${borderRadius};">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 12px; line-height: 18px; font-family: ${fonts.body}; color: ${colors.textSecondary};">
                This link will expire in <strong>${expirationText}</strong>.
              </p>
              
              <p style="margin: 0 0 16px; font-size: 12px; line-height: 18px; font-family: ${fonts.body}; color: ${colors.textSecondary};">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              
              <hr style="margin: 32px 0; border: none; border-top: 1px solid ${colors.divider};">
              
              <p style="margin: 0; font-size: 12px; line-height: 16px; font-family: ${fonts.body}; color: ${colors.textMuted};">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: ${colors.secondary}; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        
        <p style="margin: 24px 0 0; font-size: 12px; line-height: 16px; font-family: ${fonts.body}; color: ${colors.textMuted}; text-align: center;">
          This is an automated message from SalesPro. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = `
Reset Your Password

We received a request to reset your password.

Click the link below to choose a new password:
${resetUrl}

This link will expire in ${expirationText}.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This is an automated message from SalesPro. Please do not reply to this email.
`.trim();

  return {
    subject: 'Reset your SalesPro password',
    html,
    text,
  };
}

/**
 * Options for the user invite email template
 */
type InviteTemplateOptions = {
  /** The full URL for accepting the invitation */
  inviteUrl: string;
  /** Name of the company the user is being invited to */
  companyName: string;
  /** Name of the person who sent the invite */
  inviterName: string;
  /** Expiration time in days (default: 7) */
  expiresInDays?: number;
};

/**
 * Generate user invitation email template
 * @param options - Template options including invite URL, company name, and inviter name
 */
export function inviteUserTemplate(
  options: InviteTemplateOptions,
): EmailTemplate {
  const { inviteUrl, companyName, inviterName, expiresInDays = 7 } = options;
  const { colors, fonts, borderRadius } = LEAP_TOKENS;

  const expirationText = `${expiresInDays} day${expiresInDays === 1 ? '' : 's'}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${fonts.body}; background-color: ${colors.backgroundMuted};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${colors.background}; border-radius: ${borderRadius}; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; font-family: ${fonts.headline}; color: ${colors.textPrimary};">You're Invited!</h1>
              
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 21px; font-family: ${fonts.body}; color: ${colors.textPrimary};">
                <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on SalesPro.
              </p>
              
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; font-family: ${fonts.body}; color: ${colors.textPrimary};">
                Click the button below to create your account and get started.
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0; width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; font-family: ${fonts.headline}; color: ${colors.white}; text-decoration: none; background-color: ${colors.primary}; border-radius: ${borderRadius};">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 12px; line-height: 18px; font-family: ${fonts.body}; color: ${colors.textSecondary};">
                This invitation will expire in <strong>${expirationText}</strong>.
              </p>
              
              <p style="margin: 0 0 16px; font-size: 12px; line-height: 18px; font-family: ${fonts.body}; color: ${colors.textSecondary};">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
              
              <hr style="margin: 32px 0; border: none; border-top: 1px solid ${colors.divider};">
              
              <p style="margin: 0; font-size: 12px; line-height: 16px; font-family: ${fonts.body}; color: ${colors.textMuted};">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: ${colors.secondary}; word-break: break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        
        <p style="margin: 24px 0 0; font-size: 12px; line-height: 16px; font-family: ${fonts.body}; color: ${colors.textMuted}; text-align: center;">
          This is an automated message from SalesPro. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = `
You're Invited to Join ${companyName}!

${inviterName} has invited you to join ${companyName} on SalesPro.

Click the link below to create your account and get started:
${inviteUrl}

This invitation will expire in ${expirationText}.

If you weren't expecting this invitation, you can safely ignore this email.

---
This is an automated message from SalesPro. Please do not reply to this email.
`.trim();

  return {
    subject: `You're invited to join ${companyName} on SalesPro`,
    html,
    text,
  };
}

/**
 * Generate MFA verification code email template
 * @param code - The 6-digit verification code
 * @param expiresInMinutes - Code expiration time in minutes (default: 5)
 */
export function mfaCodeTemplate(
  code: string,
  expiresInMinutes: number = 5,
): EmailTemplate {
  const expirationText = formatExpiration(expiresInMinutes);
  const { colors, fonts, borderRadius } = LEAP_TOKENS;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${fonts.body}; background-color: ${colors.backgroundMuted};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${colors.background}; border-radius: ${borderRadius}; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; font-family: ${fonts.headline}; color: ${colors.textPrimary};">Your Verification Code</h1>
              
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 21px; font-family: ${fonts.body}; color: ${colors.textPrimary};">
                Use this code to verify your identity:
              </p>
              
              <div style="margin: 32px 0; padding: 24px; background-color: ${colors.backgroundMuted}; border-radius: ${borderRadius}; text-align: center;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: ${colors.textPrimary}; font-family: 'Courier New', Courier, monospace;">
                  ${code}
                </span>
              </div>
              
              <p style="margin: 0 0 16px; font-size: 12px; line-height: 18px; font-family: ${fonts.body}; color: ${colors.textSecondary};">
                This code will expire in <strong>${expirationText}</strong>.
              </p>
              
              <p style="margin: 0 0 16px; font-size: 12px; line-height: 18px; font-family: ${fonts.body}; color: ${colors.textSecondary};">
                If you didn't request this code, someone may be trying to access your account. Please secure your account by changing your password immediately.
              </p>
              
              <hr style="margin: 32px 0; border: none; border-top: 1px solid ${colors.divider};">
              
              <p style="margin: 0; font-size: 12px; line-height: 16px; font-family: ${fonts.body}; color: ${colors.textMuted};">
                For your security, never share this code with anyone. SalesPro will never ask you for your verification code.
              </p>
            </td>
          </tr>
        </table>
        
        <p style="margin: 24px 0 0; font-size: 12px; line-height: 16px; font-family: ${fonts.body}; color: ${colors.textMuted}; text-align: center;">
          This is an automated message from SalesPro. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = `
Your Verification Code

Use this code to verify your identity:

${code}

This code will expire in ${expirationText}.

If you didn't request this code, someone may be trying to access your account. Please secure your account by changing your password immediately.

---
For your security, never share this code with anyone. SalesPro will never ask you for your verification code.

This is an automated message from SalesPro. Please do not reply to this email.
`.trim();

  return {
    subject: 'Your SalesPro verification code',
    html,
    text,
  };
}
