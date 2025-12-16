/**
 * Accept invitation page component.
 * Allows invited users to create their account.
 */
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
import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';

import { LeapLogo } from '../components/LeapLogo';
import { useValidateInviteToken, useAcceptInvite } from '../hooks/useUsers';
import { handleApiError } from '../lib/api-client';

import type { ChangeEvent, FormEvent } from 'react';

type FormData = {
  nameFirst: string;
  nameLast: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = {
  nameFirst?: string;
  nameLast?: string;
  password?: string;
  confirmPassword?: string;
};

const MIN_PASSWORD_LENGTH = 8;

/**
 * Page for accepting an invitation and creating a user account.
 */
export function AcceptInvitePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [formData, setFormData] = useState<FormData>({
    nameFirst: '',
    nameLast: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    data: inviteData,
    isLoading: validating,
    error: validateError,
  } = useValidateInviteToken(token);
  const acceptInviteMutation = useAcceptInvite();

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

    try {
      await acceptInviteMutation.mutateAsync({
        token,
        password: formData.password,
        ...(formData.nameFirst && { nameFirst: formData.nameFirst }),
        ...(formData.nameLast && { nameLast: formData.nameLast }),
      });
      setIsSuccess(true);
    } catch (error) {
      setSubmitError(handleApiError(error));
    }
  }

  /**
   * Form submit handler wrapper for void return.
   */
  function onFormSubmit(e: FormEvent<HTMLFormElement>): void {
    void handleSubmit(e);
  }

  const isSubmitting = acceptInviteMutation.isPending;

  // Loading state
  if (validating) {
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
            <CircularProgress size={48} />
            <Typography variant="body1" sx={{ mt: 2 }}>
              Validating invitation...
            </Typography>
          </Paper>
        </Container>
      </Box>
    );
  }

  // Invalid or missing token state
  if (!token || validateError || !inviteData?.valid) {
    const errorMessage = validateError
      ? handleApiError(validateError)
      : 'Invalid or expired invitation link';

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
              Invalid Invitation
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }} color="text.secondary">
              {errorMessage}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please contact your administrator to receive a new invitation.
            </Typography>

            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              color="primary"
              fullWidth
            >
              Go to Login
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
              Welcome to {inviteData.companyName}!
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }}>
              Your account has been created successfully. You can now sign in
              with your email and password.
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

  // Main form
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
            maxWidth: 450,
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
              Join {inviteData.companyName}
            </Typography>

            <Typography variant="body1" color="text.secondary">
              You&apos;ve been invited to join{' '}
              <strong>{inviteData.companyName}</strong>. Create your account to
              get started.
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Account email: <strong>{inviteData.email}</strong>
            </Typography>
          </Box>

          <Box
            component="form"
            onSubmit={onFormSubmit}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {submitError && (
              <Alert severity="error" role="alert" aria-live="polite">
                {submitError}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                id="nameFirst"
                name="nameFirst"
                label="First Name"
                autoComplete="given-name"
                autoFocus
                value={formData.nameFirst}
                onChange={handleChange}
                error={!!formErrors.nameFirst}
                helperText={formErrors.nameFirst}
                placeholder="John"
                disabled={isSubmitting}
                fullWidth
              />

              <TextField
                id="nameLast"
                name="nameLast"
                label="Last Name"
                autoComplete="family-name"
                value={formData.nameLast}
                onChange={handleChange}
                error={!!formErrors.nameLast}
                helperText={formErrors.nameLast}
                placeholder="Doe"
                disabled={isSubmitting}
                fullWidth
              />
            </Box>

            <TextField
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              error={!!formErrors.password}
              helperText={
                formErrors.password ??
                `At least ${MIN_PASSWORD_LENGTH} characters`
              }
              placeholder="Enter password"
              disabled={isSubmitting}
              required
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
              placeholder="Confirm password"
              disabled={isSubmitting}
              required
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
                  Creating Account...
                </Box>
              ) : (
                'Create Account'
              )}
            </Button>
          </Box>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link
                component={RouterLink}
                to="/login"
                color="secondary"
                sx={{ fontWeight: 500 }}
              >
                Sign In
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
