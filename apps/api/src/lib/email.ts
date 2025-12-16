import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { fromIni } from '@aws-sdk/credential-providers';

import { env } from '../config/env.js';

import {
  inviteUserTemplate,
  mfaCodeTemplate,
  passwordResetTemplate,
} from './email-templates.js';
import { AppError, ErrorCode } from './errors.js';

/**
 * Email sending result type
 */
type SendEmailResult = {
  messageId: string;
  success: boolean;
};

/**
 * Email send options
 */
type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/**
 * Email service error for failed email operations
 */
export class EmailServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(503, ErrorCode.SERVICE_UNAVAILABLE, message, details);
    this.name = 'EmailServiceError';
  }
}

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  return Boolean(env.SES_FROM_EMAIL);
}

/**
 * Create SES client with configuration from environment
 * AWS credentials are loaded automatically from the environment via the AWS SDK
 * default credential chain (environment variables, IAM roles, etc.)
 */
function createSESClient(): SESClient {
  const clientConfig: {
    region: string;
    credentials?: ReturnType<typeof fromIni>;
  } = {
    region: env.AWS_REGION,
  };

  // Use AWS profile if specified
  if (env.AWS_PROFILE) {
    clientConfig.credentials = fromIni({ profile: env.AWS_PROFILE });
  }

  return new SESClient(clientConfig);
}

// Singleton SES client instance
let sesClient: SESClient | null = null;

/**
 * Get or create the SES client instance
 */
function getSESClient(): SESClient {
  sesClient ??= createSESClient();
  return sesClient;
}

/**
 * Reset the SES client (useful for testing)
 */
export function resetSESClient(): void {
  sesClient = null;
}

/**
 * Set a custom SES client (useful for testing with mocks)
 */
export function setSESClient(client: SESClient): void {
  sesClient = client;
}

/**
 * Send an email using AWS SES
 */
async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!env.SES_FROM_EMAIL) {
    throw new EmailServiceError('Email service is not configured', {
      reason: 'SES_FROM_EMAIL environment variable is not set',
    });
  }

  const { to, subject, html, text, replyTo } = options;
  const toAddresses = Array.isArray(to) ? to : [to];

  const client = getSESClient();

  const command = new SendEmailCommand({
    Source: env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: html,
        },
        Text: {
          Charset: 'UTF-8',
          Data: text,
        },
      },
    },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
  });

  try {
    const response = await client.send(command);
    return {
      messageId: response.MessageId ?? 'unknown',
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new EmailServiceError(`Failed to send email: ${errorMessage}`, {
      recipients: toAddresses,
      subject,
      originalError: errorMessage,
    });
  }
}

/**
 * Send a password reset email
 * @param email - Recipient email address
 * @param token - Password reset token
 * @param expiresInMinutes - Token expiration time in minutes (default: 60)
 */
async function sendPasswordResetEmail(
  email: string,
  token: string,
  expiresInMinutes: number = 60,
): Promise<SendEmailResult> {
  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const template = passwordResetTemplate(resetUrl, expiresInMinutes);

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send an MFA verification code email
 * @param email - Recipient email address
 * @param code - 6-digit verification code
 * @param expiresInMinutes - Code expiration time in minutes (default: 5)
 */
async function sendMfaCodeEmail(
  email: string,
  code: string,
  expiresInMinutes: number = 5,
): Promise<SendEmailResult> {
  const template = mfaCodeTemplate(code, expiresInMinutes);

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Options for sending user invite email
 */
type SendInviteEmailOptions = {
  /** Recipient email address */
  email: string;
  /** Invite token (will be appended to invite URL) */
  token: string;
  /** Name of the company the user is being invited to */
  companyName: string;
  /** Name of the person who sent the invite */
  inviterName: string;
  /** Expiration time in days (default: 7) */
  expiresInDays?: number;
};

/**
 * Send a user invitation email
 * @param options - Email options including recipient, token, company name, and inviter name
 */
async function sendInviteEmail(
  options: SendInviteEmailOptions,
): Promise<SendEmailResult> {
  const { email, token, companyName, inviterName, expiresInDays = 7 } = options;
  const inviteUrl = `${env.APP_URL}/accept-invite?token=${encodeURIComponent(token)}`;
  const template = inviteUserTemplate({
    inviteUrl,
    companyName,
    inviterName,
    expiresInDays,
  });

  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Email service with methods for sending different types of emails
 */
export const emailService = {
  sendEmail,
  sendPasswordResetEmail,
  sendMfaCodeEmail,
  sendInviteEmail,
  isConfigured: isEmailServiceConfigured,
};
