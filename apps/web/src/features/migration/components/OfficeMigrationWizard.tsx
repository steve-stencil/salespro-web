/**
 * Office Migration Wizard Component
 *
 * Multi-step wizard for importing offices from legacy database.
 * Supports selective import with checkboxes and shows import status.
 */

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';

import {
  useSourceCount,
  useSourceItems,
  useImportedStatus,
  useImportBatches,
} from '../hooks';

import type { SourceItem } from '../types';
import type { FC } from 'react';

const STEPS = ['Preview', 'Import'];

type OfficeMigrationWizardProps = {
  readonly onComplete: () => void;
  readonly onCancel: () => void;
};

/**
 * Office Migration Wizard Component.
 */
export const OfficeMigrationWizard: FC<OfficeMigrationWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch source data
  const {
    data: sourceCount,
    isLoading: isLoadingCount,
    error: countError,
  } = useSourceCount();
  const {
    data: sourceData,
    isLoading: isLoadingItems,
    error: itemsError,
  } = useSourceItems(0, 100);

  // Get IDs of all source items for checking import status
  const sourceIds = useMemo(
    () => sourceData?.data.map(item => item.objectId) ?? [],
    [sourceData],
  );

  // Check which items are already imported
  const { data: importedIds, isLoading: isLoadingStatus } =
    useImportedStatus(sourceIds);

  const importedSet = useMemo(() => new Set(importedIds ?? []), [importedIds]);

  // Import batches hook
  const {
    isImporting,
    progress,
    importedCount,
    skippedCount,
    errorCount,
    totalCount,
    errors,
    importError,
    hasFailed,
    isComplete,
    startSelectiveImport,
    reset,
  } = useImportBatches();

  // Get items that are NOT imported yet
  const availableItems = useMemo(() => {
    if (!sourceData) return [];
    return sourceData.data.filter(item => !importedSet.has(item.objectId));
  }, [sourceData, importedSet]);

  // Handle select all toggle
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === availableItems.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all available (not imported)
      setSelectedIds(new Set(availableItems.map(item => item.objectId)));
    }
  }, [selectedIds.size, availableItems]);

  // Handle individual checkbox toggle
  const handleToggleItem = useCallback((objectId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(objectId)) {
        next.delete(objectId);
      } else {
        next.add(objectId);
      }
      return next;
    });
  }, []);

  // Start selective import
  const handleStartImport = useCallback(async () => {
    setActiveStep(1);
    await startSelectiveImport(Array.from(selectedIds));
  }, [startSelectiveImport, selectedIds]);

  // Retry handler
  const handleRetry = useCallback(() => {
    reset();
    setActiveStep(0);
  }, [reset]);

  const isLoading = isLoadingCount || isLoadingItems || isLoadingStatus;
  const fetchError = countError ?? itemsError;

  // Extract error message from various error types
  const getErrorMessage = (error: unknown): string => {
    if (!error) return 'An unknown error occurred';
    if (error instanceof Error) return error.message;
    if (typeof error === 'object') {
      const err = error as Record<string, unknown>;
      // Handle axios error response
      if (err['response'] && typeof err['response'] === 'object') {
        const response = err['response'] as Record<string, unknown>;
        if (response['data'] && typeof response['data'] === 'object') {
          const data = response['data'] as Record<string, unknown>;
          if (typeof data['message'] === 'string') return data['message'];
          if (typeof data['error'] === 'string') return data['error'];
        }
      }
      if (typeof err['message'] === 'string') return err['message'];
    }
    return 'An unexpected error occurred';
  };

  // Render office row with checkbox and status
  const renderOfficeRow = (office: SourceItem) => {
    const isImportedItem = importedSet.has(office.objectId);
    const isSelected = selectedIds.has(office.objectId);

    return (
      <TableRow
        key={office.objectId}
        sx={{
          bgcolor: isImportedItem ? 'action.disabledBackground' : 'inherit',
          '&:hover': {
            bgcolor: isImportedItem
              ? 'action.disabledBackground'
              : 'action.hover',
          },
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox
            checked={isSelected}
            onChange={() => handleToggleItem(office.objectId)}
            disabled={isImportedItem}
          />
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {office.name}
            {isImportedItem && (
              <Chip
                label="Imported"
                size="small"
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Box>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Import Offices
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Import office data from your legacy system.
          {sourceCount !== undefined && (
            <>
              {' '}
              Found <strong>{sourceCount}</strong> offices.
              {importedSet.size > 0 && (
                <>
                  {' '}
                  <strong>{importedSet.size}</strong> already imported.
                </>
              )}
            </>
          )}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEPS.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Preview Step */}
        {activeStep === 0 && (
          <Box>
            {/* Error Display */}
            {fetchError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Failed to load source data
                </Typography>
                <Typography variant="body2">
                  {getErrorMessage(fetchError)}
                </Typography>
              </Alert>
            )}

            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : fetchError ? (
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={onCancel}>Cancel</Button>
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="subtitle1">
                    Select Offices to Import
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedIds.size} of {availableItems.length} selected
                  </Typography>
                </Box>

                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ mb: 3, maxHeight: 400 }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={
                              availableItems.length > 0 &&
                              selectedIds.size === availableItems.length
                            }
                            indeterminate={
                              selectedIds.size > 0 &&
                              selectedIds.size < availableItems.length
                            }
                            onChange={handleSelectAll}
                            disabled={availableItems.length === 0}
                          />
                        </TableCell>
                        <TableCell>Office Name</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sourceData?.data.map(renderOfficeRow)}
                      {sourceData?.data.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} align="center">
                            No offices found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {sourceData &&
                  sourceData.meta.total > sourceData.data.length && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      Showing {sourceData.data.length} of{' '}
                      {sourceData.meta.total} offices
                    </Typography>
                  )}

                <Box
                  sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}
                >
                  <Button onClick={onCancel}>Cancel</Button>
                  <Button
                    variant="contained"
                    onClick={() => void handleStartImport()}
                    disabled={selectedIds.size === 0}
                  >
                    Import {selectedIds.size} Office
                    {selectedIds.size !== 1 ? 's' : ''}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}

        {/* Import Step */}
        {activeStep === 1 && (
          <Box>
            {isImporting ? (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Importing offices...
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 10, borderRadius: 5, mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {progress}% complete (
                  {importedCount + skippedCount + errorCount} of {totalCount})
                </Typography>
              </Box>
            ) : isComplete ? (
              <Box>
                <Alert
                  severity={errorCount > 0 ? 'warning' : 'success'}
                  icon={errorCount > 0 ? <ErrorIcon /> : <CheckCircleIcon />}
                  sx={{ mb: 3 }}
                >
                  {errorCount > 0
                    ? `Import completed with ${errorCount} errors`
                    : 'Import completed successfully!'}
                </Alert>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 2,
                    mb: 3,
                  }}
                >
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {importedCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Imported
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {skippedCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Skipped (existing)
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {errorCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Errors
                    </Typography>
                  </Paper>
                </Box>

                {errors.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Error Details
                    </Typography>
                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ maxHeight: 200 }}
                    >
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Source ID</TableCell>
                            <TableCell>Error</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {errors.map((err, idx) => (
                            <TableRow key={idx}>
                              <TableCell sx={{ fontFamily: 'monospace' }}>
                                {err.sourceId}
                              </TableCell>
                              <TableCell>{err.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}

                <Box
                  sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}
                >
                  <Button onClick={handleRetry}>Import More</Button>
                  <Button variant="contained" onClick={onComplete}>
                    Done
                  </Button>
                </Box>
              </Box>
            ) : hasFailed ? (
              <Box>
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Import Failed
                  </Typography>
                  <Typography variant="body2">
                    {importError ??
                      'An unexpected error occurred during import'}
                  </Typography>
                </Alert>

                <Box
                  sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}
                >
                  <Button onClick={handleRetry}>Try Again</Button>
                  <Button variant="outlined" onClick={onCancel}>
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={24} sx={{ mb: 2 }} />
                <Typography color="text.secondary">
                  Preparing import...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};
