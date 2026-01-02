/**
 * Job Progress Modal Component.
 * Displays progress and status of background jobs.
 */

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PendingIcon from '@mui/icons-material/Pending';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobStep = {
  id: string;
  name: string;
  status: JobStatus;
  message?: string;
  itemsProcessed?: number;
  totalItems?: number;
};

export type Job = {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  steps: JobStep[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    successCount: number;
    errorCount: number;
    skippedCount: number;
  };
};

type JobProgressModalProps = {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  onCancel?: () => Promise<void>;
  onRetry?: () => Promise<void>;
};

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusIcon(status: JobStatus): React.ReactElement {
  switch (status) {
    case 'pending':
      return <PendingIcon color="disabled" />;
    case 'running':
      return <CircularProgress size={20} />;
    case 'completed':
      return <CheckCircleIcon color="success" />;
    case 'failed':
      return <ErrorIcon color="error" />;
    case 'cancelled':
      return <CancelIcon color="warning" />;
  }
}

function getStatusColor(
  status: JobStatus,
): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'pending':
      return 'default';
    case 'running':
      return 'primary';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'warning';
  }
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end ?? new Date();
  const seconds = Math.floor((endTime.getTime() - start.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ============================================================================
// Main Component
// ============================================================================

export function JobProgressModal({
  open,
  job,
  onClose,
  onCancel,
  onRetry,
}: JobProgressModalProps): React.ReactElement {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Auto-refresh while job is running
  useEffect(() => {
    if (!job || job.status !== 'running') return;

    const interval = setInterval(() => {
      // In real implementation, this would fetch updated job status
      console.log('Refreshing job status...');
    }, 2000);

    return () => clearInterval(interval);
  }, [job]);

  const handleCancel = useCallback(async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel();
    } finally {
      setIsCancelling(false);
    }
  }, [onCancel]);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  const canClose = job?.status !== 'running';
  const canCancel = job?.status === 'running' && onCancel;
  const canRetry = job?.status === 'failed' && onRetry;

  if (!job) return <></>;

  return (
    <Dialog
      open={open}
      onClose={canClose ? onClose : undefined}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {getStatusIcon(job.status)}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">{job.type}</Typography>
          <Typography variant="caption" color="text.secondary">
            Job ID: {job.id}
          </Typography>
        </Box>
        <Chip
          label={job.status}
          color={getStatusColor(job.status)}
          size="small"
        />
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Progress Bar */}
          {job.status === 'running' && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {job.currentStep ?? 'Processing...'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {job.progress}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={job.progress} />
            </Box>
          )}

          {/* Duration */}
          {job.startedAt && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HourglassEmptyIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Duration: {formatDuration(job.startedAt, job.completedAt)}
              </Typography>
            </Box>
          )}

          {/* Error Message */}
          {job.error && (
            <Box
              sx={{
                p: 2,
                bgcolor: 'error.lighter',
                borderRadius: 1,
                borderLeft: 4,
                borderColor: 'error.main',
              }}
            >
              <Typography variant="body2" color="error.dark">
                {job.error}
              </Typography>
            </Box>
          )}

          {/* Result Summary */}
          {job.result && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                icon={<CheckCircleIcon />}
                label={`${job.result.successCount} succeeded`}
                color="success"
                variant="outlined"
              />
              {job.result.errorCount > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${job.result.errorCount} failed`}
                  color="error"
                  variant="outlined"
                />
              )}
              {job.result.skippedCount > 0 && (
                <Chip
                  label={`${job.result.skippedCount} skipped`}
                  variant="outlined"
                />
              )}
            </Box>
          )}

          <Divider />

          {/* Steps */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Steps
            </Typography>
            <List dense>
              {job.steps.map(step => (
                <ListItem key={step.id}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getStatusIcon(step.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={step.name}
                    secondary={
                      step.itemsProcessed !== undefined &&
                      step.totalItems !== undefined
                        ? `${step.itemsProcessed} / ${step.totalItems} items`
                        : step.message
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        {canCancel && (
          <Button
            onClick={() => void handleCancel()}
            disabled={isCancelling}
            color="warning"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Job'}
          </Button>
        )}
        {canRetry && (
          <Button
            onClick={() => void handleRetry()}
            disabled={isRetrying}
            variant="outlined"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Button>
        )}
        <Button
          onClick={onClose}
          disabled={!canClose}
          variant={canClose ? 'contained' : 'text'}
        >
          {canClose ? 'Close' : 'Running...'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
