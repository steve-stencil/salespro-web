import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { env } from '../../config/env';
import {
  emailService,
  EmailServiceError,
  isEmailServiceConfigured,
  resetSESClient,
  setSESClient,
} from '../../lib/email';

import type { SESClient, SendEmailCommandOutput } from '@aws-sdk/client-ses';

// Type for mock call arguments
interface MockCallArg {
  input: {
    Source: string;
    Destination: {
      ToAddresses: string[];
    };
    Message: {
      Subject: { Charset: string; Data: string };
      Body: {
        Html: { Charset: string; Data: string };
        Text: { Charset: string; Data: string };
      };
    };
    ReplyToAddresses?: string[];
  };
}

// Mock the env module
vi.mock('../../config/env', () => ({
  env: {
    AWS_REGION: 'us-east-1',
    SES_FROM_EMAIL: 'noreply@example.com',
    APP_URL: 'http://localhost:5173',
  },
}));

describe('emailService', () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let mockClient: SESClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSESClient();

    // Create a mock send function
    mockSend = vi.fn().mockResolvedValue({
      MessageId: 'test-message-id',
      $metadata: {},
    } as SendEmailCommandOutput);

    // Create a mock SES client
    mockClient = {
      send: mockSend,
    } as unknown as SESClient;

    // Inject the mock client
    setSESClient(mockClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
    resetSESClient();
  });

  describe('isEmailServiceConfigured', () => {
    it('should return true when SES_FROM_EMAIL is configured', () => {
      expect(isEmailServiceConfigured()).toBe(true);
    });

    it('should return false when SES_FROM_EMAIL is not configured', () => {
      // Temporarily modify env
      const originalEmail = env['SES_FROM_EMAIL'];
      (env as Record<string, unknown>)['SES_FROM_EMAIL'] = undefined;

      expect(isEmailServiceConfigured()).toBe(false);

      // Restore
      (env as Record<string, unknown>)['SES_FROM_EMAIL'] = originalEmail;
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const result = await emailService.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Check the command was created with correct parameters
      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      expect(callArg?.input).toEqual({
        Source: 'noreply@example.com',
        Destination: {
          ToAddresses: ['user@example.com'],
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: 'Test Subject',
          },
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: '<p>Test HTML</p>',
            },
            Text: {
              Charset: 'UTF-8',
              Data: 'Test Text',
            },
          },
        },
        ReplyToAddresses: undefined,
      });
    });

    it('should send email to multiple recipients', async () => {
      const result = await emailService.sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      expect(callArg?.input.Destination.ToAddresses).toEqual([
        'user1@example.com',
        'user2@example.com',
      ]);
    });

    it('should include reply-to address when provided', async () => {
      await emailService.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        replyTo: 'support@example.com',
      });

      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      expect(callArg?.input.ReplyToAddresses).toEqual(['support@example.com']);
    });

    it('should throw EmailServiceError when SES fails', async () => {
      mockSend.mockRejectedValue(new Error('SES Error'));

      await expect(
        emailService.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }),
      ).rejects.toThrow(EmailServiceError);
    });

    it('should throw EmailServiceError when SES_FROM_EMAIL is not configured', async () => {
      const originalEmail = env['SES_FROM_EMAIL'];
      (env as Record<string, unknown>)['SES_FROM_EMAIL'] = undefined;

      await expect(
        emailService.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        }),
      ).rejects.toThrow(EmailServiceError);

      (env as Record<string, unknown>)['SES_FROM_EMAIL'] = originalEmail;
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct URL', async () => {
      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        'reset-token-123',
      );

      expect(result.success).toBe(true);
      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      expect(callArg?.input.Destination.ToAddresses).toEqual([
        'user@example.com',
      ]);
      expect(callArg?.input.Message.Subject.Data).toBe(
        'Reset your SalesPro password',
      );
    });

    it('should encode token in reset URL', async () => {
      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token with spaces',
      );

      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      const htmlBody = callArg?.input.Message.Body.Html.Data ?? '';
      const textBody = callArg?.input.Message.Body.Text.Data ?? '';

      // Should contain encoded URL
      expect(htmlBody).toContain('token%20with%20spaces');
      expect(textBody).toContain('token%20with%20spaces');
    });

    it('should include custom expiration time', async () => {
      await emailService.sendPasswordResetEmail(
        'user@example.com',
        'token',
        30,
      );

      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      const htmlBody = callArg?.input.Message.Body.Html.Data ?? '';

      expect(htmlBody).toContain('30 minutes');
    });
  });

  describe('sendMfaCodeEmail', () => {
    it('should send MFA code email with correct code', async () => {
      const result = await emailService.sendMfaCodeEmail(
        'user@example.com',
        '123456',
      );

      expect(result.success).toBe(true);
      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      expect(callArg?.input.Destination.ToAddresses).toEqual([
        'user@example.com',
      ]);
      expect(callArg?.input.Message.Subject.Data).toBe(
        'Your SalesPro verification code',
      );
    });

    it('should include MFA code in email body', async () => {
      await emailService.sendMfaCodeEmail('user@example.com', '987654');

      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      const htmlBody = callArg?.input.Message.Body.Html.Data ?? '';
      const textBody = callArg?.input.Message.Body.Text.Data ?? '';

      expect(htmlBody).toContain('987654');
      expect(textBody).toContain('987654');
    });

    it('should include custom expiration time', async () => {
      await emailService.sendMfaCodeEmail('user@example.com', '123456', 10);

      const callArg = mockSend.mock.calls[0]?.[0] as MockCallArg | undefined;
      const htmlBody = callArg?.input.Message.Body.Html.Data ?? '';

      expect(htmlBody).toContain('10 minutes');
    });
  });

  describe('EmailServiceError', () => {
    it('should be an instance of AppError', async () => {
      mockSend.mockRejectedValue(new Error('Test error'));

      try {
        await emailService.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        });
        // If we get here, the test should fail
        expect.fail('Expected EmailServiceError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EmailServiceError);
        expect((error as EmailServiceError).status).toBe(503);
        expect((error as EmailServiceError).code).toBe('SERVICE_UNAVAILABLE');
      }
    });
  });
});
