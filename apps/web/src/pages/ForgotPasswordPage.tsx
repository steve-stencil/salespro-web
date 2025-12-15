/**
 * Forgot password page component.
 * Allows users to request a password reset email.
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import { LeapLogo } from '../components/LeapLogo';
import { ApiClientError } from '../lib/api-client';
import { authApi } from '../services/auth';

import type { ChangeEvent, FormEvent } from 'react';

/**
 * Validates email format.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function ForgotPasswordPage(): React.ReactElement {
  const location = useLocation();
  const initialEmail =
    (location.state as { email?: string } | null)?.email ?? '';

  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * Handles email input change.
   */
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    setEmail(e.target.value);
    setEmailError(null);
    setSubmitError(null);
  }

  /**
   * Validates the email field.
   */
  function validateEmail(): boolean {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    return true;
  }

  /**
   * Handles form submission.
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitError(null);

    if (!validateEmail()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.forgotPassword(email);
      setIsSuccess(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Unable to send reset email. Please try again.');
      }
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

  // Show success state
  if (isSuccess) {
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
              textAlign: 'center',
            }}
          >
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

            <Typography variant="body1" sx={{ mb: 2 }}>
              If an account exists with <strong>{email}</strong>, you will
              receive a password reset link shortly.
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Don&apos;t see the email? Check your spam folder or try again.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                color="primary"
                fullWidth
              >
                Back to Login
              </Button>

              <Button
                variant="text"
                color="secondary"
                onClick={() => setIsSuccess(false)}
              >
                Try Another Email
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
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
              Forgot Your Password?
            </Typography>

            <Typography variant="body1" color="text.secondary">
              Enter your email address and we&apos;ll send you a link to reset
              your password.
            </Typography>
          </Box>

          <Box
            component="form"
            onSubmit={onFormSubmit}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            {submitError && (
              <Alert severity="error" role="alert" aria-live="polite">
                {submitError}
              </Alert>
            )}

            <TextField
              id="email"
              name="email"
              type="email"
              label="Email Address"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={handleChange}
              error={!!emailError}
              helperText={emailError}
              placeholder="you@example.com"
              disabled={isSubmitting}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Sending...
                </Box>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Link
              component={RouterLink}
              to="/login"
              color="secondary"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: 500,
              }}
            >
              <ArrowBackIcon fontSize="small" />
              Back to Login
            </Link>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
