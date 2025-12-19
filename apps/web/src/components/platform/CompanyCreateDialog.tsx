/**
 * Company Create Dialog Component
 *
 * Dialog for creating new companies in the platform.
 * Collects company name, subscription tier, and other settings.
 */
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useEffect } from 'react';

import { useCreateCompany } from '../../hooks/usePlatform';
import { handleApiError } from '../../lib/api-client';

import type {
  SessionLimitStrategy,
  SubscriptionTier,
} from '../../types/platform';
import type { SelectChangeEvent } from '@mui/material/Select';

type CompanyCreateDialogProps = {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when company is created successfully */
  onSuccess: () => void;
};

type FormErrors = {
  name?: string;
  maxUsers?: string;
  maxSessions?: string;
};

/** Subscription tier options */
const SUBSCRIPTION_TIERS: { value: SubscriptionTier; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

/** Session limit strategy options */
const SESSION_STRATEGIES: {
  value: SessionLimitStrategy;
  label: string;
  description: string;
}[] = [
  {
    value: 'revoke_oldest',
    label: 'Revoke Oldest',
    description: 'Automatically log out the oldest session',
  },
  {
    value: 'revoke_lru',
    label: 'Revoke Least Recently Used',
    description: 'Automatically log out the least recently used session',
  },
  {
    value: 'block_new',
    label: 'Block New',
    description: 'Prevent new logins until an existing session ends',
  },
  {
    value: 'prompt_user',
    label: 'Prompt User',
    description: 'Ask the user to choose which session to end',
  },
];

/**
 * Dialog for creating a new company in the platform.
 */
export function CompanyCreateDialog({
  open,
  onClose,
  onSuccess,
}: CompanyCreateDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [subscriptionTier, setSubscriptionTier] =
    useState<SubscriptionTier>('free');
  const [maxUsers, setMaxUsers] = useState('5');
  const [maxSessions, setMaxSessions] = useState('2');
  const [sessionLimitStrategy, setSessionLimitStrategy] =
    useState<SessionLimitStrategy>('revoke_oldest');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createCompanyMutation = useCreateCompany();

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setName('');
      setSubscriptionTier('free');
      setMaxUsers('5');
      setMaxSessions('2');
      setSessionLimitStrategy('revoke_oldest');
      setMfaRequired(false);
      setErrors({});
      setSubmitError(null);
    }
  }, [open]);

  /**
   * Validate form fields.
   */
  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Company name is required';
    } else if (name.length > 255) {
      newErrors.name = 'Company name must be 255 characters or less';
    }

    const maxUsersNum = parseInt(maxUsers, 10);
    if (isNaN(maxUsersNum) || maxUsersNum < 1) {
      newErrors.maxUsers = 'Must be at least 1';
    } else if (maxUsersNum > 10000) {
      newErrors.maxUsers = 'Cannot exceed 10,000';
    }

    const maxSessionsNum = parseInt(maxSessions, 10);
    if (isNaN(maxSessionsNum) || maxSessionsNum < 1) {
      newErrors.maxSessions = 'Must be at least 1';
    } else if (maxSessionsNum > 100) {
      newErrors.maxSessions = 'Cannot exceed 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  /**
   * Handle form submission.
   */
  async function handleSubmit(): Promise<void> {
    if (!validateForm()) return;

    setSubmitError(null);
    try {
      await createCompanyMutation.mutateAsync({
        name: name.trim(),
        subscriptionTier,
        maxUsers: parseInt(maxUsers, 10),
        maxSessions: parseInt(maxSessions, 10),
        sessionLimitStrategy,
        mfaRequired,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(handleApiError(err));
    }
  }

  const isSubmitting = createCompanyMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1 }}>Create Company</Box>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create a new company in the platform. Companies are isolated tenants
          with their own users, offices, and settings.
        </Typography>

        {submitError && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setSubmitError(null)}
          >
            {submitError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Company Name"
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (errors.name)
                setErrors(prev => ({ ...prev, name: undefined }));
            }}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
            autoFocus
            disabled={isSubmitting}
          />

          <FormControl fullWidth>
            <InputLabel id="tier-label">Subscription Tier</InputLabel>
            <Select
              labelId="tier-label"
              value={subscriptionTier}
              label="Subscription Tier"
              onChange={(e: SelectChangeEvent) =>
                setSubscriptionTier(e.target.value as SubscriptionTier)
              }
              disabled={isSubmitting}
            >
              {SUBSCRIPTION_TIERS.map(tier => (
                <MenuItem key={tier.value} value={tier.value}>
                  {tier.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Max Users"
              type="number"
              value={maxUsers}
              onChange={e => {
                setMaxUsers(e.target.value);
                if (errors.maxUsers)
                  setErrors(prev => ({ ...prev, maxUsers: undefined }));
              }}
              error={!!errors.maxUsers}
              helperText={errors.maxUsers ?? 'Maximum user seats'}
              fullWidth
              required
              disabled={isSubmitting}
              inputProps={{ min: 1, max: 10000 }}
            />
            <TextField
              label="Max Sessions per User"
              type="number"
              value={maxSessions}
              onChange={e => {
                setMaxSessions(e.target.value);
                if (errors.maxSessions)
                  setErrors(prev => ({ ...prev, maxSessions: undefined }));
              }}
              error={!!errors.maxSessions}
              helperText={errors.maxSessions ?? 'Concurrent sessions allowed'}
              fullWidth
              required
              disabled={isSubmitting}
              inputProps={{ min: 1, max: 100 }}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel id="session-strategy-label">
              Session Limit Strategy
            </InputLabel>
            <Select
              labelId="session-strategy-label"
              value={sessionLimitStrategy}
              label="Session Limit Strategy"
              onChange={(e: SelectChangeEvent) =>
                setSessionLimitStrategy(e.target.value as SessionLimitStrategy)
              }
              disabled={isSubmitting}
            >
              {SESSION_STRATEGIES.map(strategy => (
                <MenuItem key={strategy.value} value={strategy.value}>
                  <Box>
                    <Typography variant="body2">{strategy.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {strategy.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              What happens when a user exceeds their session limit
            </FormHelperText>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={mfaRequired}
                onChange={e => setMfaRequired(e.target.checked)}
                disabled={isSubmitting}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Require MFA</Typography>
                <Typography variant="caption" color="text.secondary">
                  All users must enable two-factor authentication
                </Typography>
              </Box>
            }
          />
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          Create Company
        </Button>
      </DialogActions>
    </Dialog>
  );
}
