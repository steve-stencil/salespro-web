/**
 * Pricing Import Dialog Component.
 * Allows importing option prices from Excel with preview and validation.
 */

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useRef, useEffect } from 'react';

import { priceGuideApi } from '../../services/price-guide';

import type {
  PricingImportPreview,
  PricingImportResult,
  PricingImportJobStatus,
} from '@shared/core';

// ============================================================================
// Types
// ============================================================================

type PricingImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type ImportStep =
  | 'upload'
  | 'validating'
  | 'preview'
  | 'importing'
  | 'complete';

// ============================================================================
// Main Component
// ============================================================================

export function PricingImportDialog({
  open,
  onClose,
  onSuccess,
}: PricingImportDialogProps): React.ReactElement {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PricingImportPreview | null>(null);
  const [result, setResult] = useState<PricingImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<PricingImportJobStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount or dialog close
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setPreview(null);
      setResult(null);
      setJobId(null);
      setJobStatus(null);
      setError(null);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [open]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) return;

      // Validate file type
      const validExtensions = ['.xlsx', '.xls'];
      const hasValidExtension = validExtensions.some(ext =>
        selectedFile.name.toLowerCase().endsWith(ext),
      );

      if (!hasValidExtension) {
        setError('Please select an Excel file (.xlsx or .xls)');
        return;
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setError('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setStep('validating');

      // Call preview endpoint
      try {
        const previewResult =
          await priceGuideApi.previewOptionPricesImport(selectedFile);
        setPreview(previewResult);
        setStep('preview');
      } catch (err) {
        console.error('Preview failed:', err);
        // Try to get error message from API response
        type ApiErrorType = { response?: { data?: { message?: string } } };
        const apiError = err as ApiErrorType;
        const errorMessage =
          apiError.response?.data?.message ??
          'Failed to validate file. Please check the format and try again.';
        setError(errorMessage);
        setStep('upload');
      }
    },
    [],
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      // Create a fake change event
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(droppedFile);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        const changeEvent = new Event('change', { bubbles: true });
        fileInputRef.current.dispatchEvent(changeEvent);
      }
    }
  }, []);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    [],
  );

  const handleImport = useCallback(
    async (skipErrors = false) => {
      if (!file) return;

      setStep('importing');
      setError(null);

      try {
        const importResult = await priceGuideApi.importOptionPrices(file, {
          skipErrors,
        });

        // Check if it's an async job
        if ('jobId' in importResult) {
          setJobId(importResult.jobId);
          // Start polling for status
          const pollStatus = async () => {
            try {
              const status = await priceGuideApi.getImportJobStatus(
                importResult.jobId,
              );
              setJobStatus(status);

              if (status.status === 'completed' || status.status === 'failed') {
                if (pollingRef.current) {
                  clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
                // Convert job status to result format
                setResult({
                  success: status.status === 'completed',
                  created: status.createdCount,
                  updated: status.updatedCount,
                  skipped: status.skippedCount,
                  errors: status.errors ?? [],
                });
                setStep('complete');
                if (status.status === 'completed') {
                  onSuccess?.();
                }
              }
            } catch (pollErr) {
              console.error('Failed to poll job status:', pollErr);
            }
          };
          pollingRef.current = setInterval(() => void pollStatus(), 2000);
        } else {
          // Synchronous result
          setResult(importResult);
          setStep('complete');
          if (importResult.success) {
            onSuccess?.();
          }
        }
      } catch (err) {
        console.error('Import failed:', err);
        setError('Import failed. Please try again.');
        setStep('preview');
      }
    },
    [file, onSuccess],
  );

  const handleClose = useCallback(() => {
    if (step === 'importing' || step === 'validating') return;
    onClose();
  }, [step, onClose]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setResult(null);
    setJobId(null);
    setJobStatus(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ============================================================================
  // Render Steps
  // ============================================================================

  const renderUploadStep = () => (
    <Box
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      sx={{
        border: 2,
        borderStyle: 'dashed',
        borderColor: 'divider',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
        },
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={e => void handleFileSelect(e)}
        style={{ display: 'none' }}
      />
      <CloudUploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Drop file here or click to upload
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Supported formats: Excel (.xlsx)
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block' }}
      >
        Maximum file size: 10MB
      </Typography>
    </Box>
  );

  const renderValidatingStep = () => (
    <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
      <CircularProgress size={48} />
      <Typography variant="h6">Validating file...</Typography>
      <Typography variant="body2" color="text.secondary">
        Checking file format and data integrity
      </Typography>
    </Stack>
  );

  const renderPreviewStep = () => (
    <Stack spacing={3}>
      {/* File Info */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <DescriptionIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2">{file?.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {file && (file.size / 1024).toFixed(1)} KB
          </Typography>
        </Box>
        <Button size="small" onClick={handleReset}>
          Change File
        </Button>
      </Box>

      {/* Preview Summary */}
      {preview && (
        <>
          {preview.valid ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              File validation passed. Ready to import.
            </Alert>
          ) : (
            <Alert severity="error" icon={<ErrorIcon />}>
              File has validation errors. Please fix the errors and try again.
            </Alert>
          )}

          {/* Summary Chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${preview.summary.totalRows} total rows`}
              variant="outlined"
            />
            <Chip
              label={`${preview.summary.toCreate} new prices`}
              color="success"
              variant="outlined"
            />
            <Chip
              label={`${preview.summary.toUpdate} updates`}
              color="info"
              variant="outlined"
            />
            <Chip
              label={`${preview.summary.toSkip} no changes`}
              variant="outlined"
            />
            {preview.summary.errors > 0 && (
              <Chip
                label={`${preview.summary.errors} errors`}
                color="error"
                variant="outlined"
              />
            )}
          </Box>

          {/* Errors List */}
          {preview.errors.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Errors
              </Typography>
              <List
                dense
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  bgcolor: 'background.paper',
                }}
              >
                {preview.errors.slice(0, 20).map((err, index) => (
                  <ListItem key={index}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <ErrorIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Row ${err.row}${err.column ? `: ${err.column}` : ''}`}
                      secondary={err.message}
                    />
                  </ListItem>
                ))}
                {preview.errors.length > 20 && (
                  <ListItem>
                    <ListItemText
                      secondary={`...and ${preview.errors.length - 20} more errors`}
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          )}

          {/* Sample Changes */}
          {preview.preview.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Sample Changes (first 10)
              </Typography>
              <List
                dense
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  bgcolor: 'background.paper',
                }}
              >
                {preview.preview.slice(0, 10).map((item, index) => (
                  <ListItem key={index}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {item.action === 'create' && (
                        <CheckCircleIcon color="success" fontSize="small" />
                      )}
                      {item.action === 'update' && (
                        <WarningIcon color="info" fontSize="small" />
                      )}
                      {item.action === 'skip' && (
                        <DescriptionIcon color="disabled" fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${item.optionName} - ${item.officeName}`}
                      secondary={
                        item.action === 'create'
                          ? 'New price'
                          : item.action === 'update'
                            ? 'Will update'
                            : 'No changes'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </>
      )}

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );

  const renderImportingStep = () => (
    <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
      <CircularProgress size={48} />
      <Typography variant="h6">
        {jobId ? 'Processing import...' : 'Importing...'}
      </Typography>
      {jobStatus && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress
            variant="determinate"
            value={
              jobStatus.totalRows
                ? (jobStatus.processedRows / jobStatus.totalRows) * 100
                : 0
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            {jobStatus.processedRows} / {jobStatus.totalRows ?? '?'} rows
            processed
          </Typography>
        </Box>
      )}
      {jobId && (
        <Typography variant="body2" color="text.secondary">
          Large file detected. Processing in background. You&apos;ll receive an
          email when complete.
        </Typography>
      )}
    </Stack>
  );

  const renderCompleteStep = () => (
    <Stack spacing={3}>
      {result?.success ? (
        <Alert severity="success" icon={<CheckCircleIcon />}>
          Import completed successfully!
        </Alert>
      ) : (
        <Alert severity="error" icon={<ErrorIcon />}>
          Import completed with errors.
        </Alert>
      )}

      {/* Result Summary */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Chip
          label={`${result?.created ?? 0} created`}
          color="success"
          variant="outlined"
        />
        <Chip
          label={`${result?.updated ?? 0} updated`}
          color="info"
          variant="outlined"
        />
        <Chip label={`${result?.skipped ?? 0} skipped`} variant="outlined" />
        {(result?.errors.length ?? 0) > 0 && (
          <Chip
            label={`${result?.errors.length ?? 0} errors`}
            color="error"
            variant="outlined"
          />
        )}
      </Box>

      {/* Errors */}
      {result?.errors && result.errors.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Errors
          </Typography>
          <List
            dense
            sx={{
              maxHeight: 200,
              overflow: 'auto',
              bgcolor: 'background.paper',
            }}
          >
            {result.errors.slice(0, 20).map((err, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ErrorIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`Row ${err.row}${err.column ? `: ${err.column}` : ''}`}
                  secondary={err.message}
                />
              </ListItem>
            ))}
            {result.errors.length > 20 && (
              <ListItem>
                <ListItemText
                  secondary={`...and ${result.errors.length - 20} more errors`}
                />
              </ListItem>
            )}
          </List>
        </Box>
      )}
    </Stack>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudUploadIcon color="primary" />
        Import Option Prices
      </DialogTitle>

      <DialogContent>
        {error && step === 'upload' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 'upload' && renderUploadStep()}
        {step === 'validating' && renderValidatingStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>

      <DialogActions>
        {step === 'upload' && <Button onClick={handleClose}>Cancel</Button>}
        {step === 'preview' && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            {preview?.valid && (
              <Button
                variant="contained"
                onClick={() => void handleImport(false)}
                startIcon={<CloudUploadIcon />}
              >
                Import
              </Button>
            )}
            {!preview?.valid &&
              preview &&
              preview.summary.errors < preview.summary.totalRows && (
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => void handleImport(true)}
                  startIcon={<WarningIcon />}
                >
                  Import Valid Rows (
                  {preview.summary.totalRows - preview.summary.errors})
                </Button>
              )}
          </>
        )}
        {step === 'complete' && (
          <>
            <Button onClick={handleReset}>Import Another</Button>
            <Button variant="contained" onClick={handleClose}>
              Done
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
