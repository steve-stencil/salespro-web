/**
 * Conflict Resolution Modal Component.
 * Handles concurrent edit conflicts with optimistic locking.
 */

import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type ConflictResolutionModalProps = {
  open: boolean;
  entityType: 'msi' | 'option' | 'upcharge' | 'category';
  entityName: string;
  currentVersion: number;
  serverVersion: number;
  modifiedBy: {
    name: string;
    email: string;
    modifiedAt: Date;
  };
  changes: ConflictChange[];
  onDiscard: () => void;
  onReload: () => Promise<void>;
  onForceSave: () => Promise<void>;
  onClose: () => void;
};

export type ConflictChange = {
  field: string;
  label: string;
  yourValue: string | number | boolean | null;
  serverValue: string | number | boolean | null;
};

type ConflictResolution = 'discard' | 'reload' | 'force';

// ============================================================================
// Helper Functions
// ============================================================================

function formatValue(value: string | number | boolean | null): string {
  if (value === null) return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// ============================================================================
// Change Comparison Row
// ============================================================================

type ChangeRowProps = {
  change: ConflictChange;
};

function ChangeRow({ change }: ChangeRowProps): React.ReactElement {
  const hasConflict = change.yourValue !== change.serverValue;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '150px 1fr 24px 1fr',
        gap: 1,
        alignItems: 'center',
        py: 1.5,
        px: 2,
        bgcolor: hasConflict ? 'warning.lighter' : 'grey.50',
        borderRadius: 1,
        mb: 1,
      }}
    >
      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {change.label}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          bgcolor: hasConflict ? 'error.lighter' : 'background.paper',
          borderColor: hasConflict ? 'error.light' : 'divider',
        }}
      >
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {formatValue(change.yourValue)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Your changes
        </Typography>
      </Paper>
      <CompareArrowsIcon color="action" fontSize="small" />
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          bgcolor: hasConflict ? 'success.lighter' : 'background.paper',
          borderColor: hasConflict ? 'success.light' : 'divider',
        }}
      >
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {formatValue(change.serverValue)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Server version
        </Typography>
      </Paper>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConflictResolutionModal({
  open,
  entityType,
  entityName,
  currentVersion,
  serverVersion,
  modifiedBy,
  changes,
  onDiscard,
  onReload,
  onForceSave,
  onClose,
}: ConflictResolutionModalProps): React.ReactElement {
  const conflictCount = changes.filter(
    c => c.yourValue !== c.serverValue,
  ).length;

  const handleAction = useCallback(
    async (action: ConflictResolution) => {
      switch (action) {
        case 'discard':
          onDiscard();
          onClose();
          break;
        case 'reload':
          await onReload();
          onClose();
          break;
        case 'force':
          await onForceSave();
          onClose();
          break;
      }
    },
    [onDiscard, onReload, onForceSave, onClose],
  );

  const entityLabel = {
    msi: 'Measure Sheet Item',
    option: 'Option',
    upcharge: 'UpCharge',
    category: 'Category',
  }[entityType];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Edit Conflict Detected
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Conflict Description */}
          <Alert severity="warning">
            The {entityLabel.toLowerCase()} <strong>"{entityName}"</strong> has
            been modified by another user since you started editing. Please
            choose how to resolve this conflict.
          </Alert>

          {/* Modification Info */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <PersonIcon color="action" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">{modifiedBy.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {modifiedBy.email}
                </Typography>
              </Box>
              <Chip
                label={formatTimeAgo(modifiedBy.modifiedAt)}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`v${currentVersion} → v${serverVersion}`}
                size="small"
                color="warning"
              />
            </Stack>
          </Paper>

          {/* Changes Comparison */}
          {changes.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Changes ({conflictCount} conflict
                {conflictCount !== 1 ? 's' : ''})
              </Typography>
              <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                {changes.map((change, index) => (
                  <ChangeRow key={index} change={change} />
                ))}
              </Box>
            </Box>
          )}

          <Divider />

          {/* Resolution Options */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Resolution Options
            </Typography>
            <Stack spacing={2}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => void handleAction('discard')}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <UndoIcon color="action" />
                  <Box>
                    <Typography variant="subtitle2">
                      Discard My Changes
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Abandon your edits and close without saving.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => void handleAction('reload')}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <RefreshIcon color="info" />
                  <Box>
                    <Typography variant="subtitle2">
                      Reload Latest Version
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Load the latest data from the server and re-apply your
                      changes manually.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderColor: 'warning.light',
                  '&:hover': {
                    borderColor: 'warning.main',
                    bgcolor: 'warning.lighter',
                  },
                }}
                onClick={() => void handleAction('force')}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <SaveIcon color="warning" />
                  <Box>
                    <Typography variant="subtitle2" color="warning.dark">
                      Force Save (Overwrite)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save your changes and overwrite the other user's edits.
                      This may cause data loss.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
