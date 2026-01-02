/**
 * Import Dialog Component.
 * Allows importing MSIs from CSV/Excel or legacy format.
 */

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
import { useState, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

type ImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<ImportResult>;
};

export type ImportResult = {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
};

type ImportError = {
  row: number;
  field: string;
  message: string;
};

type ImportWarning = {
  row: number;
  field: string;
  message: string;
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

export function ImportDialog({
  open,
  onClose,
  onImport,
}: ImportDialogProps): React.ReactElement {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        // Validate file type
        const validTypes = [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const hasValidExtension = validExtensions.some(ext =>
          selectedFile.name.toLowerCase().endsWith(ext),
        );

        if (!validTypes.includes(selectedFile.type) && !hasValidExtension) {
          setError('Please select a CSV or Excel file.');
          return;
        }

        setFile(selectedFile);
        setError(null);
        setStep('preview');
      }
    },
    [],
  );

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const hasValidExtension = validExtensions.some(ext =>
        droppedFile.name.toLowerCase().endsWith(ext),
      );

      if (!hasValidExtension) {
        setError('Please select a CSV or Excel file.');
        return;
      }

      setFile(droppedFile);
      setError(null);
      setStep('preview');
    }
  }, []);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    [],
  );

  const handleImport = useCallback(async () => {
    if (!file) return;

    setStep('importing');
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const importResult = await onImport(file);
      clearInterval(progressInterval);
      setProgress(100);
      setResult(importResult);
      setStep('complete');
    } catch (err) {
      clearInterval(progressInterval);
      setError('Import failed. Please check your file and try again.');
      setStep('preview');
      console.error('Import failed:', err);
    }
  }, [file, onImport]);

  const handleClose = useCallback(() => {
    if (step === 'importing') return;
    setStep('upload');
    setFile(null);
    setResult(null);
    setProgress(0);
    setError(null);
    onClose();
  }, [step, onClose]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setResult(null);
    setProgress(0);
    setError(null);
  }, []);

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
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <CloudUploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Drop file here or click to upload
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Supported formats: CSV, Excel (.xlsx, .xls)
      </Typography>
    </Box>
  );

  const renderPreviewStep = () => (
    <Stack spacing={3}>
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

      <Alert severity="info">
        The import will validate your data and show any errors before committing
        changes. You can review and cancel if needed.
      </Alert>
    </Stack>
  );

  const renderImportingStep = () => (
    <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
      <CircularProgress size={48} />
      <Typography variant="h6">Importing...</Typography>
      <Box sx={{ width: '100%' }}>
        <LinearProgress variant="determinate" value={progress} />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {progress}% complete
        </Typography>
      </Box>
    </Stack>
  );

  const renderCompleteStep = () => (
    <Stack spacing={3}>
      {result?.success ? (
        <Alert severity="success">
          Import completed successfully! {result.imported} item(s) imported.
        </Alert>
      ) : (
        <Alert severity="error">
          Import completed with errors. Please review the results below.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Chip
          label={`${result?.imported ?? 0} imported`}
          color="success"
          variant="outlined"
        />
        <Chip
          label={`${result?.skipped ?? 0} skipped`}
          color="warning"
          variant="outlined"
        />
        <Chip
          label={`${result?.errors.length ?? 0} errors`}
          color="error"
          variant="outlined"
        />
      </Box>

      {result?.errors && result.errors.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Errors
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
            {result.errors.slice(0, 10).map((err, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ErrorIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`Row ${err.row}: ${err.field}`}
                  secondary={err.message}
                />
              </ListItem>
            ))}
            {result.errors.length > 10 && (
              <ListItem>
                <ListItemText
                  secondary={`...and ${result.errors.length - 10} more errors`}
                />
              </ListItem>
            )}
          </List>
        </Box>
      )}

      {result?.warnings && result.warnings.length > 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Warnings
          </Typography>
          <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
            {result.warnings.slice(0, 5).map((warn, index) => (
              <ListItem key={index}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <WarningIcon color="warning" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={`Row ${warn.row}: ${warn.field}`}
                  secondary={warn.message}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Stack>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudUploadIcon color="primary" />
        Import Catalog Items
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 'upload' && renderUploadStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>

      <DialogActions>
        {step === 'upload' && <Button onClick={handleClose}>Cancel</Button>}
        {step === 'preview' && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => void handleImport()}
              startIcon={<CloudUploadIcon />}
            >
              Start Import
            </Button>
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
