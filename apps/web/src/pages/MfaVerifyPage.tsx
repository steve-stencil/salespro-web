/**
 * MFA verification page component.
 * Displays a 6-digit code input after login when MFA is required.
 * The code is sent via email for security.
 */

import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

import { LeapLogo } from '../components/LeapLogo';
import { useAuth } from '../hooks/useAuth';
import { apiClient, ApiClientError } from '../lib/api-client';

import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function MfaVerifyPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyMfa, isAuthenticated, requiresMfa, clearMfaState } = useAuth();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [trustDevice, setTrustDevice] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get the intended destination and canSwitchCompanies from navigation state
  const locationState = location.state as {
    from?: string;
    canSwitchCompanies?: boolean;
  } | null;
  const from = locationState?.from ?? '/dashboard';
  const canSwitchCompanies = locationState?.canSwitchCompanies ?? false;

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // If user has multiple companies, redirect to company selection
      if (canSwitchCompanies) {
        void navigate('/select-company', { state: { from }, replace: true });
      } else {
        void navigate(from, { replace: true });
      }
    }
  }, [isAuthenticated, navigate, from, canSwitchCompanies]);

  // Redirect if MFA is not required (user navigated directly to this page)
  useEffect(() => {
    if (!requiresMfa && !isAuthenticated) {
      void navigate('/login', { replace: true });
    }
  }, [requiresMfa, isAuthenticated, navigate]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCooldown]);

  /**
   * Handles resending the MFA code via email.
   */
  async function handleResendCode(): Promise<void> {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiClient.post('/auth/mfa/send');
      setSuccessMessage('A new code has been sent to your email.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      // Clear existing code inputs
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to resend code. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  }

  /**
   * Handles input change for a single digit.
   */
  function handleInputChange(index: number, value: string): void {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);
    setSuccessMessage(null);

    // Move to next input if digit entered
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH) {
        void handleSubmit(undefined, fullCode);
      }
    }
  }

  /**
   * Handles keyboard navigation between inputs.
   */
  function handleKeyDown(
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
      } else {
        // Clear current input
        const newCode = [...code];
        newCode[index] = '';
        setCode(newCode);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  /**
   * Handles paste event to fill all inputs.
   */
  function handlePaste(e: ClipboardEvent<HTMLInputElement>): void {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    const digits = pastedData.slice(0, CODE_LENGTH).split('');

    const newCode = [...code];
    digits.forEach((digit, index) => {
      newCode[index] = digit;
    });
    setCode(newCode);

    // Focus the next empty input or last input
    const nextEmptyIndex = newCode.findIndex(d => !d);
    const focusIndex = nextEmptyIndex === -1 ? CODE_LENGTH - 1 : nextEmptyIndex;
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if all digits are pasted
    if (digits.length === CODE_LENGTH) {
      void handleSubmit(undefined, digits.join(''));
    }
  }

  /**
   * Handles form submission.
   */
  async function handleSubmit(
    e?: FormEvent<HTMLFormElement>,
    submittedCode?: string,
  ): Promise<void> {
    e?.preventDefault();

    const codeToVerify = submittedCode ?? code.join('');

    if (codeToVerify.length !== CODE_LENGTH) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await verifyMfa(codeToVerify, trustDevice);
      // Success - redirect handled by useEffect
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Unable to verify code. Please try again.');
      }
      // Clear the code and focus first input
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Form submit handler wrapper for void return.
   */
  function onFormSubmit(e: FormEvent<HTMLFormElement>): void {
    void handleSubmit(e);
  }

  /**
   * Handles going back to login.
   */
  function handleBackToLogin(): void {
    clearMfaState();
    void navigate('/login');
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
        bgcolor: 'primary.main',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <LeapLogo size="medium" color="primary" />
            </Box>

            <Typography variant="h2" component="h1" gutterBottom>
              Check Your Email
            </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                mb: 1,
              }}
            >
              <EmailOutlinedIcon color="action" />
              <Typography variant="body1" color="text.secondary">
                We&apos;ve sent a 6-digit code to your email
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Enter the code below to complete your login
            </Typography>
          </Box>

          <Box
            component="form"
            onSubmit={onFormSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {error && (
              <Alert severity="error" role="alert" aria-live="polite">
                {error}
              </Alert>
            )}

            {successMessage && (
              <Alert severity="success" role="status" aria-live="polite">
                {successMessage}
              </Alert>
            )}

            <Box
              role="group"
              aria-label="Verification code"
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              {code.map((digit, index) => (
                <TextField
                  key={index}
                  inputRef={(el: HTMLInputElement | null) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={digit}
                  onChange={e => handleInputChange(index, e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                    handleKeyDown(index, e)
                  }
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isSubmitting}
                  slotProps={{
                    input: {
                      'aria-label': `Digit ${index + 1}`,
                      sx: {
                        width: 48,
                        height: 56,
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        '& input': {
                          textAlign: 'center',
                          padding: '8px',
                        },
                      },
                    },
                    htmlInput: {
                      maxLength: 1,
                    },
                  }}
                />
              ))}
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={trustDevice}
                  onChange={e => setTrustDevice(e.target.checked)}
                  disabled={isSubmitting}
                  color="primary"
                />
              }
              label="Trust this device for 30 days"
              sx={{ justifyContent: 'center' }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={isSubmitting || code.join('').length !== CODE_LENGTH}
            >
              {isSubmitting ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Verifying...
                </Box>
              ) : (
                'Verify'
              )}
            </Button>
          </Box>

          {/* Resend Code Section */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Didn&apos;t receive the code?
            </Typography>
            <Button
              variant="text"
              color="primary"
              size="small"
              onClick={() => void handleResendCode()}
              disabled={isResending || resendCooldown > 0}
            >
              {isResending ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={14} color="inherit" />
                  Sending...
                </Box>
              ) : resendCooldown > 0 ? (
                `Resend code in ${resendCooldown}s`
              ) : (
                'Resend Code'
              )}
            </Button>
          </Box>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              mt: 2,
            }}
          >
            <Button
              variant="text"
              color="secondary"
              size="small"
              onClick={handleBackToLogin}
            >
              Back to Login
            </Button>

            <Typography variant="body2" color="text.disabled">
              |
            </Typography>

            <Link
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              color="secondary"
            >
              Need Help?
            </Link>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
