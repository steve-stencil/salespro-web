/**
 * Reset password page component.
 * Allows users to set a new password using a token from email.
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { LeapLogo } from '../components/LeapLogo';
import { ApiClientError } from '../lib/api-client';
import { authApi } from '../services/auth';

import type { ChangeEvent, FormEvent } from 'react';

interface FormData {
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  password?: string;
  confirmPassword?: string;
}

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState<FormData>({
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirect to forgot password if no token
  useEffect(() => {
    if (!token) {
      void navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate]);

  /**
   * Handles input field changes.
   */
  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear field error when user starts typing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (submitError) {
      setSubmitError(null);
    }
  }

  /**
   * Validates form fields.
   */
  function validateForm(): boolean {
    const errors: FormErrors = {};

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
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

    if (!validateForm() || !token) {
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.resetPassword(token, formData.password);
      setIsSuccess(true);
    } catch (error) {
      if (error instanceof ApiClientError) {
        // Check for specific error messages
        if (error.message.toLowerCase().includes('expired')) {
          setSubmitError(
            'This reset link has expired. Please request a new one.',
          );
        } else if (error.message.toLowerCase().includes('invalid')) {
          setSubmitError(
            'This reset link is invalid. Please request a new one.',
          );
        } else {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError('Unable to reset password. Please try again.');
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

  // No token state
  if (!token) {
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
              Invalid Reset Link
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }}>
              This password reset link is invalid or has expired.
            </Typography>

            <Button
              component={RouterLink}
              to="/forgot-password"
              variant="contained"
              color="primary"
              fullWidth
            >
              Request a New Link
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  // Success state
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
              Password Reset Successful
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }}>
              Your password has been reset successfully. You can now sign in
              with your new password.
            </Typography>

            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              color="primary"
              fullWidth
            >
              Sign In
            </Button>
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
              Set New Password
            </Typography>

            <Typography variant="body1" color="text.secondary">
              Enter your new password below. Make sure it&apos;s at least{' '}
              {MIN_PASSWORD_LENGTH} characters.
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
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              label="New Password"
              autoComplete="new-password"
              autoFocus
              value={formData.password}
              onChange={handleChange}
              error={!!formErrors.password}
              helperText={formErrors.password}
              placeholder="Enter new password"
              disabled={isSubmitting}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        onClick={() => setShowPassword(!showPassword)}
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

            <TextField
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              label="Confirm Password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={!!formErrors.confirmPassword}
              helperText={formErrors.confirmPassword}
              placeholder="Confirm new password"
              disabled={isSubmitting}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showConfirmPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        edge="end"
                        disabled={isSubmitting}
                      >
                        {showConfirmPassword ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

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
                  Resetting...
                </Box>
              ) : (
                'Reset Password'
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
