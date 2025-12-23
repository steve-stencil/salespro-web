/**
 * Import Progress Step Component
 *
 * Step 3 of the import wizard - shows import progress and results.
 */

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import type { FC } from 'react';

type ImportProgressStepProps = {
  readonly isImporting: boolean;
  readonly progress: number;
  readonly importedCount: number;
  readonly skippedCount: number;
  readonly errorCount: number;
  readonly totalCount: number;
  readonly errors: Array<{ templateId: string; error: string }>;
  readonly isComplete: boolean;
  readonly onDone: () => void;
  readonly onRetry: () => void;
};

/**
 * Import Progress Step Component.
 */
export const ImportProgressStep: FC<ImportProgressStepProps> = ({
  isImporting: _isImporting,
  progress,
  importedCount,
  skippedCount,
  errorCount,
  totalCount,
  errors,
  isComplete,
  onDone,
  onRetry,
}) => {
  const [showErrors, setShowErrors] = useState(false);

  const processedCount = importedCount + skippedCount + errorCount;
  const hasErrors = errorCount > 0;
  const allFailed = errorCount === processedCount && processedCount > 0;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {isComplete ? 'Import Complete' : 'Importing Templates...'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isComplete
            ? 'Your document templates have been imported.'
            : 'Please wait while we import your templates. This may take a few minutes.'}
        </Typography>
      </Box>

      {/* Progress Section */}
      {!isComplete && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography variant="body1">Importing...</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4, mb: 1 }}
            data-testid="import-progress-bar"
          />
          <Typography variant="caption" color="text.secondary">
            {Math.round(progress)}% complete ({processedCount} of {totalCount})
          </Typography>
        </Paper>
      )}

      {/* Results Section */}
      {isComplete && (
        <Box data-testid="import-complete">
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 3,
              backgroundColor: allFailed ? 'error.light' : 'success.light',
              borderColor: allFailed ? 'error.main' : 'success.main',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {allFailed ? (
                <ErrorIcon color="error" sx={{ mr: 1, fontSize: 32 }} />
              ) : (
                <CheckCircleIcon color="success" sx={{ mr: 1, fontSize: 32 }} />
              )}
              <Typography variant="h6">
                {allFailed ? 'Import Failed' : 'Import Complete!'}
              </Typography>
            </Box>

            <List dense>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckCircleIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`${importedCount} templates imported successfully`}
                />
              </ListItem>
              {skippedCount > 0 && (
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <WarningIcon color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${skippedCount} templates skipped (already exist)`}
                  />
                </ListItem>
              )}
              {errorCount > 0 && (
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <ErrorIcon color="error" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={`${errorCount} templates failed`} />
                </ListItem>
              )}
            </List>
          </Paper>

          {/* Error Details */}
          {hasErrors && (
            <Box sx={{ mb: 3 }}>
              <Button
                variant="text"
                onClick={() => setShowErrors(!showErrors)}
                sx={{ mb: 1 }}
              >
                {showErrors ? 'Hide Error Details' : 'Show Error Details'}
              </Button>
              <Collapse in={showErrors}>
                <Alert
                  severity="error"
                  sx={{ maxHeight: 300, overflow: 'auto' }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Failed Templates:
                  </Typography>
                  <List dense>
                    {errors.map((err, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                        <ListItemText
                          primary={err.templateId}
                          secondary={err.error}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              </Collapse>
            </Box>
          )}
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        {isComplete ? (
          <>
            {hasErrors && (
              <Button variant="outlined" onClick={onRetry}>
                Retry Import
              </Button>
            )}
            <Button variant="contained" color="primary" onClick={onDone}>
              Done
            </Button>
          </>
        ) : (
          <Button variant="outlined" disabled>
            Importing...
          </Button>
        )}
      </Box>
    </Box>
  );
};
