import { describe, it, expect } from 'vitest';

import {
  passwordResetTemplate,
  mfaCodeTemplate,
} from '../../lib/email-templates';

describe('passwordResetTemplate', () => {
  const resetUrl = 'https://example.com/reset-password?token=abc123';

  it('should generate correct subject', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.subject).toBe('Reset your SalesPro password');
  });

  it('should include reset URL in HTML', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.html).toContain(resetUrl);
  });

  it('should include reset URL in plain text', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.text).toContain(resetUrl);
  });

  it('should include default expiration time of 1 hour', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.html).toContain('1 hour');
    expect(template.text).toContain('1 hour');
  });

  it('should include custom expiration time in minutes', () => {
    const template = passwordResetTemplate(resetUrl, 30);
    expect(template.html).toContain('30 minutes');
    expect(template.text).toContain('30 minutes');
  });

  it('should include custom expiration time in hours', () => {
    const template = passwordResetTemplate(resetUrl, 120);
    expect(template.html).toContain('2 hours');
    expect(template.text).toContain('2 hours');
  });

  it('should handle singular minute correctly', () => {
    const template = passwordResetTemplate(resetUrl, 1);
    expect(template.html).toContain('1 minute');
    expect(template.text).toContain('1 minute');
  });

  it('should contain security notice about ignoring email', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.html).toContain('safely ignore this email');
    expect(template.text).toContain('safely ignore this email');
  });

  it('should contain SalesPro branding', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.html).toContain('SalesPro');
    expect(template.text).toContain('SalesPro');
  });

  it('should be valid HTML', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.html).toContain('<!DOCTYPE html>');
    expect(template.html).toContain('</html>');
    expect(template.html).toContain('<body');
    expect(template.html).toContain('</body>');
  });

  it('should include clickable button in HTML', () => {
    const template = passwordResetTemplate(resetUrl);
    expect(template.html).toContain('Reset Password');
    expect(template.html).toContain(`href="${resetUrl}"`);
  });
});

describe('mfaCodeTemplate', () => {
  const code = '123456';

  it('should generate correct subject', () => {
    const template = mfaCodeTemplate(code);
    expect(template.subject).toBe('Your SalesPro verification code');
  });

  it('should include code in HTML', () => {
    const template = mfaCodeTemplate(code);
    expect(template.html).toContain(code);
  });

  it('should include code in plain text', () => {
    const template = mfaCodeTemplate(code);
    expect(template.text).toContain(code);
  });

  it('should include default expiration time of 5 minutes', () => {
    const template = mfaCodeTemplate(code);
    expect(template.html).toContain('5 minutes');
    expect(template.text).toContain('5 minutes');
  });

  it('should include custom expiration time', () => {
    const template = mfaCodeTemplate(code, 10);
    expect(template.html).toContain('10 minutes');
    expect(template.text).toContain('10 minutes');
  });

  it('should handle singular minute correctly', () => {
    const template = mfaCodeTemplate(code, 1);
    expect(template.html).toContain('1 minute');
    expect(template.text).toContain('1 minute');
  });

  it('should contain security warning', () => {
    const template = mfaCodeTemplate(code);
    expect(template.html).toContain('never share this code');
    expect(template.text).toContain('never share this code');
  });

  it('should contain warning about unauthorized access', () => {
    const template = mfaCodeTemplate(code);
    expect(template.html).toContain('trying to access your account');
    expect(template.text).toContain('trying to access your account');
  });

  it('should contain SalesPro branding', () => {
    const template = mfaCodeTemplate(code);
    expect(template.html).toContain('SalesPro');
    expect(template.text).toContain('SalesPro');
  });

  it('should be valid HTML', () => {
    const template = mfaCodeTemplate(code);
    expect(template.html).toContain('<!DOCTYPE html>');
    expect(template.html).toContain('</html>');
    expect(template.html).toContain('<body');
    expect(template.html).toContain('</body>');
  });

  it('should display code prominently with styling', () => {
    const template = mfaCodeTemplate(code);
    // Check that the code appears in a styled container
    expect(template.html).toContain('font-size: 36px');
    expect(template.html).toContain('letter-spacing');
    expect(template.html).toContain(code);
  });
});
