/**
 * Export Dialog Component.
 * Allows exporting selected or all MSIs to CSV/Excel.
 */

import DownloadIcon from '@mui/icons-material/Download';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type ExportFormat = 'csv' | 'xlsx';

type ExportDialogProps = {
  open: boolean;
  selectedIds: string[];
  totalCount: number;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
};

export type ExportOptions = {
  format: ExportFormat;
  scope: 'selected' | 'all' | 'filtered';
  includeOptions: boolean;
  includeUpcharges: boolean;
  includeAdditionalDetails: boolean;
  includePricing: boolean;
};

// ============================================================================
// Main Component
// ============================================================================

export function ExportDialog({
  open,
  selectedIds,
  totalCount,
  onClose,
  onExport,
}: ExportDialogProps): React.ReactElement {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<'selected' | 'all' | 'filtered'>(
    selectedIds.length > 0 ? 'selected' : 'all',
  );
  const [includeOptions, setIncludeOptions] = useState(true);
  const [includeUpcharges, setIncludeUpcharges] = useState(true);
  const [includeAdditionalDetails, setIncludeAdditionalDetails] =
    useState(true);
  const [includePricing, setIncludePricing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      await onExport({
        format,
        scope,
        includeOptions,
        includeUpcharges,
        includeAdditionalDetails,
        includePricing,
      });
      onClose();
    } catch (err) {
      setError('Failed to export. Please try again.');
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [
    format,
    scope,
    includeOptions,
    includeUpcharges,
    includeAdditionalDetails,
    includePricing,
    onExport,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (isExporting) return;
    onClose();
  }, [isExporting, onClose]);

  const getExportCount = () => {
    switch (scope) {
      case 'selected':
        return selectedIds.length;
      case 'all':
      case 'filtered':
        return totalCount;
      default:
        return 0;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DownloadIcon color="primary" />
        Export Catalog Items
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Format Selection */}
          <FormControl>
            <FormLabel>Export Format</FormLabel>
            <RadioGroup
              row
              value={format}
              onChange={e => setFormat(e.target.value as ExportFormat)}
            >
              <FormControlLabel
                value="csv"
                control={<Radio />}
                label="CSV (.csv)"
                disabled={isExporting}
              />
              <FormControlLabel
                value="xlsx"
                control={<Radio />}
                label="Excel (.xlsx)"
                disabled={isExporting}
              />
            </RadioGroup>
          </FormControl>

          {/* Scope Selection */}
          <FormControl>
            <FormLabel>Export Scope</FormLabel>
            <RadioGroup
              value={scope}
              onChange={e =>
                setScope(e.target.value as 'selected' | 'all' | 'filtered')
              }
            >
              {selectedIds.length > 0 && (
                <FormControlLabel
                  value="selected"
                  control={<Radio />}
                  label={`Selected items (${selectedIds.length})`}
                  disabled={isExporting}
                />
              )}
              <FormControlLabel
                value="filtered"
                control={<Radio />}
                label={`Current filter results (${totalCount})`}
                disabled={isExporting}
              />
              <FormControlLabel
                value="all"
                control={<Radio />}
                label="All items"
                disabled={isExporting}
              />
            </RadioGroup>
          </FormControl>

          {/* Include Options */}
          <FormControl component="fieldset">
            <FormLabel component="legend">Include Data</FormLabel>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeOptions}
                    onChange={e => setIncludeOptions(e.target.checked)}
                    disabled={isExporting}
                  />
                }
                label="Options"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeUpcharges}
                    onChange={e => setIncludeUpcharges(e.target.checked)}
                    disabled={isExporting}
                  />
                }
                label="UpCharges"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeAdditionalDetails}
                    onChange={e =>
                      setIncludeAdditionalDetails(e.target.checked)
                    }
                    disabled={isExporting}
                  />
                }
                label="Additional Details"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includePricing}
                    onChange={e => setIncludePricing(e.target.checked)}
                    disabled={isExporting}
                  />
                }
                label="Pricing Data"
              />
            </FormGroup>
          </FormControl>

          {/* Summary */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.100',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">
              Ready to export <strong>{getExportCount()}</strong> item(s) as{' '}
              <strong>{format.toUpperCase()}</strong>
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleExport()}
          disabled={isExporting || getExportCount() === 0}
          startIcon={
            isExporting ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DownloadIcon />
            )
          }
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
