/**
 * Login page component with form validation and error handling.
 * Supports MFA flow, account lockout, and password expiration scenarios.
 */

import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

import { LeapLogo } from '../components/LeapLogo';
import { useAuth } from '../hooks/useAuth';
import { ApiClientError } from '../lib/api-client';

import type { ChangeEvent, FormEvent } from 'react';

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
}

/**
 * Maps API error codes to user-friendly messages.
 */
function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    invalid_credentials: 'Invalid email or password. Please try again.',
    account_locked:
      'Your account is temporarily locked due to too many failed attempts. Please try again later or reset your password.',
    account_inactive:
      'Your account has been deactivated. Please contact support for assistance.',
    email_not_verified:
      'Please verify your email address before logging in. Check your inbox for the verification link.',
    password_expired:
      'Your password has expired and must be reset. Please use the forgot password link below.',
  };

  return (
    errorMessages[errorCode] ?? 'An error occurred. Please try again later.'
  );
}

/**
 * Validates email format.
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Get the intended destination from navigation state
  const from =
    (location.state as { from?: Location } | null)?.from?.pathname ??
    '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      void navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, from]);

  /**
   * Handles input field changes.
   */
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear field error when user starts typing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
    // Clear submit error when user modifies form
    if (submitError) {
      setSubmitError(null);
    }
  }

  /**
   * Validates form fields before submission.
   */
  function validateForm(): boolean {
    const errors: FormErrors = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Handles form submission.
   */
  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(
        formData.email,
        formData.password,
        formData.rememberMe,
      );

      if (result.requiresMfa) {
        void navigate('/mfa-verify', { state: { from } });
        return;
      }

      // Login successful - redirect handled by useEffect
    } catch (error) {
      if (error instanceof ApiClientError) {
        const errorData = error.apiError.details as
          | { errorCode?: string }
          | undefined;
        const errorCode = errorData?.errorCode;

        if (errorCode) {
          setSubmitError(getErrorMessage(errorCode));

          // Redirect to forgot password for expired passwords
          if (errorCode === 'password_expired') {
            void setTimeout(() => {
              void navigate('/forgot-password', {
                state: { email: formData.email },
              });
            }, 3000);
          }
        } else {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError('Unable to connect to the server. Please try again.');
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

  /**
   * Toggle password visibility.
   */
  function handleTogglePassword(): void {
    setShowPassword(prev => !prev);
  }

  // Show loading while checking initial auth state
  if (authLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={48} aria-label="Loading" />
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
              Welcome Back
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in to your account to continue
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
              value={formData.email}
              onChange={handleChange}
              error={!!formErrors.email}
              helperText={formErrors.email}
              placeholder="you@example.com"
              disabled={isSubmitting}
              slotProps={{
                input: {
                  'aria-invalid': !!formErrors.email,
                },
              }}
            />

            <TextField
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              error={!!formErrors.password}
              helperText={formErrors.password}
              placeholder="Enter your password"
              disabled={isSubmitting}
              slotProps={{
                input: {
                  'aria-invalid': !!formErrors.password,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        onClick={handleTogglePassword}
                        edge="end"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2">
                    Remember me for 30 days
                  </Typography>
                }
              />

              <Link
                component={RouterLink}
                to="/forgot-password"
                variant="body2"
                color="secondary"
                sx={{ fontWeight: 500 }}
              >
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={isSubmitting}
              sx={{ mt: 1 }}
            >
              {isSubmitting ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  Signing in...
                </Box>
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
