/**
 * Price Guide Migration Wizard Component
 *
 * Multi-step wizard for importing price guide data from legacy MongoDB.
 * Follows the plan in price-guide-import-ui.plan.md
 */

import AssignmentIcon from '@mui/icons-material/Assignment';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorIcon from '@mui/icons-material/Error';
import SettingsIcon from '@mui/icons-material/Settings';
import SyncIcon from '@mui/icons-material/Sync';
import WarningIcon from '@mui/icons-material/Warning';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
  Stack,
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
  useOfficeMappings,
  usePriceGuideImport,
  usePriceGuideSourceCounts,
  useSourceConnection,
} from '../hooks/usePriceGuideImport';
import {
  estimateImportTime,
  formatElapsedTime,
} from '../utils/time-estimation';

import type { PriceGuideImportConfig, PriceGuideSourceCounts } from '../types';
import type { FC } from 'react';

// =============================================================================
// Constants
// =============================================================================

const WIZARD_STEPS = [
  'Prerequisites',
  'Office Mapping',
  'Price Type',
  'Configuration',
  'Preview',
  'Import',
  'Results',
];

// =============================================================================
// Types
// =============================================================================

type PriceGuideMigrationWizardProps = {
  readonly onComplete: () => void;
  readonly onCancel: () => void;
};

// =============================================================================
// Step Components
// =============================================================================

/**
 * Step 1: Prerequisites Check
 */
const PrerequisitesStep: FC<{
  sourceCounts: PriceGuideSourceCounts | undefined;
  isLoading: boolean;
  connectionStatus: { connected: boolean; message?: string } | undefined;
  officeMappings:
    | Array<{
        sourceId: string;
        sourceName: string;
        targetId: string | null;
        msiCount: number;
      }>
    | undefined;
}> = ({ sourceCounts, isLoading, connectionStatus, officeMappings }) => {
  const allOfficesMapped = useMemo(() => {
    if (!officeMappings) return false;
    return officeMappings.every(o => o.targetId !== null);
  }, [officeMappings]);

  const unmappedCount = useMemo(() => {
    if (!officeMappings) return 0;
    return officeMappings.filter(o => o.targetId === null).length;
  }, [officeMappings]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Database Connection */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {connectionStatus?.connected ? (
            <CheckCircleIcon color="success" />
          ) : (
            <ErrorIcon color="error" />
          )}
          <Box>
            <Typography variant="subtitle1" fontWeight="medium">
              Legacy database connection:{' '}
              {connectionStatus?.connected ? 'Connected' : 'Not Connected'}
            </Typography>
            {connectionStatus?.connected && sourceCounts && (
              <Stack component="ul" sx={{ m: 0, pl: 3, mt: 1 }} spacing={0.5}>
                <Typography
                  component="li"
                  variant="body2"
                  color="text.secondary"
                >
                  Found {sourceCounts.msis.toLocaleString()} Measure Sheet Items
                </Typography>
                <Typography
                  component="li"
                  variant="body2"
                  color="text.secondary"
                >
                  Found {sourceCounts.options.toLocaleString()} Options
                </Typography>
                <Typography
                  component="li"
                  variant="body2"
                  color="text.secondary"
                >
                  Found {sourceCounts.upCharges.toLocaleString()} UpCharges
                </Typography>
              </Stack>
            )}
            {connectionStatus?.message && (
              <Typography variant="body2" color="error">
                {connectionStatus.message}
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Office Mapping Status */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {allOfficesMapped ? (
            <CheckCircleIcon color="success" />
          ) : (
            <WarningIcon color="warning" />
          )}
          <Box>
            <Typography variant="subtitle1" fontWeight="medium">
              Offices imported:{' '}
              {allOfficesMapped
                ? `${officeMappings?.length ?? 0} of ${officeMappings?.length ?? 0} mapped`
                : `${unmappedCount} unmapped`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {allOfficesMapped
                ? 'All legacy offices have been imported'
                : 'Some offices need to be imported first'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Prerequisites Summary */}
      {connectionStatus?.connected && allOfficesMapped && (
        <Alert severity="info" icon={<CheckCircleIcon />}>
          All prerequisites met. You can proceed with the import.
        </Alert>
      )}

      {!connectionStatus?.connected && (
        <Alert severity="error">
          Cannot connect to legacy database. Please check your configuration.
        </Alert>
      )}

      {connectionStatus?.connected && !allOfficesMapped && (
        <Alert severity="warning">
          Please import all offices before importing price guide data.
        </Alert>
      )}
    </Stack>
  );
};

/**
 * Step 2: Office Mapping Display
 */
const OfficeMappingStep: FC<{
  officeMappings:
    | Array<{
        sourceId: string;
        sourceName: string;
        targetId: string | null;
        targetName: string | null;
        msiCount: number;
      }>
    | undefined;
  isLoading: boolean;
}> = ({ officeMappings, isLoading }) => {
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalMsis =
    officeMappings?.reduce((sum, o) => sum + o.msiCount, 0) ?? 0;
  const unassignedMsis =
    officeMappings
      ?.filter(o => !o.targetId)
      .reduce((sum, o) => sum + o.msiCount, 0) ?? 0;

  return (
    <Stack spacing={3}>
      <Typography variant="body1" color="text.secondary">
        The following offices will receive imported pricing:
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Legacy Office</TableCell>
              <TableCell sx={{ width: 50, textAlign: 'center' }}>→</TableCell>
              <TableCell>New Office</TableCell>
              <TableCell align="right">MSI Count</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {officeMappings?.map(office => (
              <TableRow key={office.sourceId}>
                <TableCell>
                  <Typography variant="body2">{office.sourceName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {office.sourceId.slice(0, 8)}...
                  </Typography>
                </TableCell>
                <TableCell sx={{ textAlign: 'center' }}>→</TableCell>
                <TableCell>
                  {office.targetName ? (
                    <>
                      <Typography variant="body2">
                        {office.targetName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {office.targetId?.slice(0, 8)}...
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Not mapped
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{office.msiCount}</TableCell>
                <TableCell>
                  {office.targetId ? (
                    <Chip
                      label="Mapped"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  ) : (
                    <Chip
                      label="Unmapped"
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" color="text.secondary">
        📊 Summary: {totalMsis.toLocaleString()} MSIs total
        {unassignedMsis > 0 && (
          <>
            {' '}
            • {unassignedMsis.toLocaleString()} MSIs have no office assignment
            (will import as-is)
          </>
        )}
      </Typography>
    </Stack>
  );
};

/**
 * Step 3: Price Type Selection
 */
const PriceTypeStep: FC<{
  config: PriceGuideImportConfig;
  onConfigChange: (updates: Partial<PriceGuideImportConfig>) => void;
}> = ({ config, onConfigChange }) => {
  return (
    <Stack spacing={3}>
      <Typography variant="body1" color="text.secondary">
        Legacy prices are stored as a single "total" per office. Select how to
        import these prices:
      </Typography>

      <FormControl>
        <FormLabel>Price Type Strategy</FormLabel>
        <RadioGroup
          value={config.priceTypeStrategy}
          onChange={e =>
            onConfigChange({
              priceTypeStrategy: e.target
                .value as PriceGuideImportConfig['priceTypeStrategy'],
            })
          }
        >
          <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
            <FormControlLabel
              value="materials"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">Materials Only</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Import all prices as "Materials"
                  </Typography>
                </Box>
              }
            />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
            <FormControlLabel
              value="labor"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">Labor Only</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Import all prices as "Labor"
                  </Typography>
                </Box>
              }
            />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, mb: 1 }}>
            <FormControlLabel
              value="combined"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">Materials + Labor</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Import as combined "Materials & Labor" (recommended)
                  </Typography>
                </Box>
              }
            />
          </Paper>
        </RadioGroup>
      </FormControl>

      <Alert severity="info">
        ℹ️ You can split prices by type later using the Price Guide editor.
      </Alert>
    </Stack>
  );
};

/**
 * Step 4: Import Configuration
 */
const ConfigurationStep: FC<{
  config: PriceGuideImportConfig;
  onConfigChange: (updates: Partial<PriceGuideImportConfig>) => void;
  sourceCounts: PriceGuideSourceCounts | undefined;
}> = ({ config, onConfigChange, sourceCounts }) => {
  return (
    <Stack spacing={3}>
      {/* Category Handling */}
      <Box>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          <CategoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Category Handling
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <RadioGroup
            value={config.autoCreateCategories ? 'auto' : 'manual'}
            onChange={e =>
              onConfigChange({
                autoCreateCategories: e.target.value === 'auto',
              })
            }
          >
            <FormControlLabel
              value="auto"
              control={<Radio />}
              label="Auto-create categories from legacy category/subCategory fields"
            />
            <FormControlLabel
              value="manual"
              control={<Radio />}
              label="Map to existing categories (requires manual mapping)"
            />
          </RadioGroup>
        </Paper>
      </Box>

      {/* Duplicate Handling */}
      <Box>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          <SyncIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Duplicate Handling (items with matching sourceId)
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <RadioGroup
            value={config.duplicateHandling}
            onChange={e =>
              onConfigChange({
                duplicateHandling: e.target.value as
                  | 'skip'
                  | 'update'
                  | 'create',
              })
            }
          >
            <FormControlLabel
              value="skip"
              control={<Radio />}
              label="Skip duplicates - Don't import items that already exist"
            />
            <FormControlLabel
              value="update"
              control={<Radio />}
              label="Update existing - Overwrite existing items with legacy data"
            />
            <FormControlLabel
              value="create"
              control={<Radio />}
              label="Create new - Import as new items (may create duplicates)"
            />
          </RadioGroup>
        </Paper>
      </Box>

      {/* Image Migration */}
      <Box>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          🖼️ Image Migration
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={config.includeImages}
                onChange={e =>
                  onConfigChange({ includeImages: e.target.checked })
                }
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  Migrate product images (recommended)
                </Typography>
                {sourceCounts?.images && (
                  <Typography variant="body2" color="text.secondary">
                    {sourceCounts.images.toLocaleString()} unique images to
                    download
                  </Typography>
                )}
              </Box>
            }
          />
          {config.includeImages && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              ⚠️ May add 10-15 minutes to import time
            </Alert>
          )}
        </Paper>
      </Box>
    </Stack>
  );
};

/**
 * Step 5: Preview & Warnings
 */
const PreviewStep: FC<{
  sourceCounts: PriceGuideSourceCounts | undefined;
  config: PriceGuideImportConfig;
}> = ({ sourceCounts, config }) => {
  const [showWarningDetails, setShowWarningDetails] = useState(false);

  const timeEstimate = useMemo(() => {
    if (!sourceCounts) return null;
    return estimateImportTime(sourceCounts, {
      includeImages: config.includeImages,
    });
  }, [sourceCounts, config.includeImages]);

  if (!sourceCounts) {
    return <CircularProgress />;
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Ready to import:</Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Categories</TableCell>
              <TableCell align="right">
                {sourceCounts.categories.toLocaleString()} will be created
              </TableCell>
            </TableRow>
            {sourceCounts.additionalDetails && (
              <TableRow>
                <TableCell>Additional Details</TableCell>
                <TableCell align="right">
                  {sourceCounts.additionalDetails.toLocaleString()} will be
                  imported
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell>Options</TableCell>
              <TableCell align="right">
                {sourceCounts.options.toLocaleString()} will be imported
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>UpCharges</TableCell>
              <TableCell align="right">
                {sourceCounts.upCharges.toLocaleString()} will be imported
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Measure Sheet Items</TableCell>
              <TableCell align="right">
                {sourceCounts.msis.toLocaleString()} will be imported
              </TableCell>
            </TableRow>
            {config.includeImages && sourceCounts.images && (
              <TableRow>
                <TableCell>Images</TableCell>
                <TableCell align="right">
                  {sourceCounts.images.toLocaleString()} unique images to
                  download
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {timeEstimate && (
        <Alert severity="info" icon={<AssignmentIcon />}>
          ⏱️ Estimated time: {timeEstimate.displayText}
        </Alert>
      )}

      {/* Warnings Section */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Button
          onClick={() => setShowWarningDetails(!showWarningDetails)}
          startIcon={<WarningIcon color="warning" />}
          sx={{ mb: showWarningDetails ? 2 : 0 }}
        >
          ⚠️ Warnings (click to expand)
        </Button>
        <Collapse in={showWarningDetails}>
          <Stack spacing={1}>
            <Typography variant="body2">
              • Some additional detail fields may use unsupported input types →
              will be converted to TEXT
            </Typography>
            <Typography variant="body2">
              • MSIs with empty category → will use "Uncategorized"
            </Typography>
            <Typography variant="body2">
              • MSIs with no includedOffices → will be imported without office
              assignment
            </Typography>
            <Typography variant="body2">
              • Formula references that cannot be resolved will remain as
              placeholders
            </Typography>
          </Stack>
        </Collapse>
      </Paper>
    </Stack>
  );
};

/**
 * Step 6: Import Progress
 */
const ProgressStep: FC<{
  progress: {
    phase: string;
    overallProgress: number;
    categories: { done: number; total: number };
    additionalDetails: { done: number; total: number };
    options: { done: number; total: number };
    upCharges: { done: number; total: number };
    msis: { done: number; total: number };
    images: { done: number; total: number };
    elapsedTime: number;
    estimatedRemaining: number;
  };
}> = ({ progress }) => {
  const getStatusIcon = (
    phase: string,
    currentPhase: string,
    done: number,
    total: number,
  ) => {
    if (done === total && total > 0)
      return <CheckCircleIcon color="success" fontSize="small" />;
    if (phase === currentPhase)
      return <CircularProgress size={16} sx={{ mr: 0.5 }} />;
    return <Box sx={{ width: 20 }} />;
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          🔄 Importing Price Guide...
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress.overallProgress}
          sx={{ height: 10, borderRadius: 5 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {progress.overallProgress}% complete
        </Typography>
      </Box>

      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          {getStatusIcon(
            'categories',
            progress.phase,
            progress.categories.done,
            progress.categories.total,
          )}
          <Typography>
            Categories: {progress.categories.done}/{progress.categories.total}
          </Typography>
        </Stack>

        {progress.additionalDetails.total > 0 && (
          <Stack direction="row" spacing={1} alignItems="center">
            {getStatusIcon(
              'additional_details',
              progress.phase,
              progress.additionalDetails.done,
              progress.additionalDetails.total,
            )}
            <Typography>
              Additional Details: {progress.additionalDetails.done}/
              {progress.additionalDetails.total}
            </Typography>
          </Stack>
        )}

        <Stack direction="row" spacing={1} alignItems="center">
          {getStatusIcon(
            'options',
            progress.phase,
            progress.options.done,
            progress.options.total,
          )}
          <Typography>
            Options: {progress.options.done}/{progress.options.total}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {getStatusIcon(
            'upcharges',
            progress.phase,
            progress.upCharges.done,
            progress.upCharges.total,
          )}
          <Typography>
            UpCharges: {progress.upCharges.done}/{progress.upCharges.total}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {getStatusIcon(
            'msis',
            progress.phase,
            progress.msis.done,
            progress.msis.total,
          )}
          <Typography>
            MSIs: {progress.msis.done}/{progress.msis.total}
          </Typography>
        </Stack>

        {progress.images.total > 0 && (
          <Stack direction="row" spacing={1} alignItems="center">
            {getStatusIcon(
              'images',
              progress.phase,
              progress.images.done,
              progress.images.total,
            )}
            <Typography>
              Images: {progress.images.done}/{progress.images.total}
            </Typography>
          </Stack>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Elapsed: {formatElapsedTime(progress.elapsedTime)} • Est. remaining: ~
        {formatElapsedTime(progress.estimatedRemaining)}
      </Typography>

      <Alert severity="info">
        ℹ️ You can leave this page open and continue working. We'll notify you
        when the import is complete.
      </Alert>
    </Stack>
  );
};

/**
 * Step 7: Results Summary
 */
const ResultsStep: FC<{
  results: {
    success: boolean;
    duration: number;
    summary: {
      categories: { imported: number; skipped: number; errors: number };
      options: { imported: number; skipped: number; errors: number };
      upCharges: { imported: number; skipped: number; errors: number };
      msis: { imported: number; skipped: number; errors: number };
      images: { imported: number; skipped: number; errors: number };
    };
    actionItems: Array<{ type: string; message: string; count: number }>;
    formulaWarnings: Array<{ msiSourceId: string; unresolvedRefs: string[] }>;
  } | null;
  onViewPriceGuide: () => void;
  onDownloadReport: () => void;
}> = ({ results, onViewPriceGuide, onDownloadReport }) => {
  if (!results) {
    return <CircularProgress />;
  }

  const totalImported =
    results.summary.categories.imported +
    results.summary.options.imported +
    results.summary.upCharges.imported +
    results.summary.msis.imported;

  return (
    <Stack spacing={3}>
      <Alert
        severity={results.success ? 'success' : 'warning'}
        icon={results.success ? <CheckCircleIcon /> : <WarningIcon />}
      >
        <Typography variant="h6">
          {results.success
            ? '🎉 Import Complete!'
            : 'Import completed with issues'}
        </Typography>
        <Typography variant="body2">
          Imported {totalImported.toLocaleString()} items in{' '}
          {formatElapsedTime(results.duration)}
        </Typography>
      </Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Entity</TableCell>
              <TableCell align="right">Imported</TableCell>
              <TableCell align="right">Skipped</TableCell>
              <TableCell align="right">Errors</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Categories</TableCell>
              <TableCell align="right">
                {results.summary.categories.imported}
              </TableCell>
              <TableCell align="right">
                {results.summary.categories.skipped}
              </TableCell>
              <TableCell align="right">
                {results.summary.categories.errors}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Options</TableCell>
              <TableCell align="right">
                {results.summary.options.imported}
              </TableCell>
              <TableCell align="right">
                {results.summary.options.skipped}
              </TableCell>
              <TableCell align="right">
                {results.summary.options.errors}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>UpCharges</TableCell>
              <TableCell align="right">
                {results.summary.upCharges.imported}
              </TableCell>
              <TableCell align="right">
                {results.summary.upCharges.skipped}
              </TableCell>
              <TableCell align="right">
                {results.summary.upCharges.errors}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>MSIs</TableCell>
              <TableCell align="right">
                {results.summary.msis.imported}
              </TableCell>
              <TableCell align="right">
                {results.summary.msis.skipped}
              </TableCell>
              <TableCell align="right">{results.summary.msis.errors}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Images</TableCell>
              <TableCell align="right">
                {results.summary.images.imported}
              </TableCell>
              <TableCell align="right">
                {results.summary.images.skipped}
              </TableCell>
              <TableCell align="right">
                {results.summary.images.errors}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action Items */}
      {results.actionItems.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            ⚠️ Action Items:
          </Typography>
          <Stack component="ul" sx={{ m: 0, pl: 3 }} spacing={0.5}>
            {results.actionItems.map((item, idx) => (
              <Typography component="li" variant="body2" key={idx}>
                {item.count} {item.message}
              </Typography>
            ))}
          </Stack>
        </Paper>
      )}

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={onDownloadReport}
        >
          Download Report
        </Button>
        <Button
          variant="contained"
          startIcon={<BusinessIcon />}
          onClick={onViewPriceGuide}
        >
          View Price Guide
        </Button>
      </Stack>
    </Stack>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * Price Guide Migration Wizard Component.
 *
 * Multi-step wizard for importing price guide data from legacy MongoDB.
 */
export const PriceGuideMigrationWizard: FC<PriceGuideMigrationWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  // Data fetching hooks
  const { data: connectionStatus, isLoading: isLoadingConnection } =
    useSourceConnection();
  const { data: sourceCounts, isLoading: isLoadingCounts } =
    usePriceGuideSourceCounts();
  const { data: officeMappings, isLoading: isLoadingMappings } =
    useOfficeMappings();

  // Import state management
  const {
    isImporting,
    config,
    progress,
    results,
    importError,
    hasFailed,
    isComplete,
    updateConfig,
    startImport,
    reset,
  } = usePriceGuideImport();

  const isLoading = isLoadingConnection || isLoadingCounts || isLoadingMappings;

  // Check if prerequisites are met
  const prerequisitesMet = useMemo(() => {
    if (!connectionStatus?.connected) return false;
    if (!officeMappings) return false;
    return officeMappings.every(o => o.targetId !== null);
  }, [connectionStatus, officeMappings]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (activeStep === 4) {
      // Preview step - start import
      setActiveStep(5);
      if (sourceCounts) {
        void startImport(sourceCounts);
      }
    } else if (activeStep < WIZARD_STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  }, [activeStep, sourceCounts, startImport]);

  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  }, [activeStep]);

  const handleRetry = useCallback(() => {
    reset();
    setActiveStep(0);
  }, [reset]);

  const handleViewPriceGuide = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleDownloadReport = useCallback(() => {
    // TODO: Implement report download
    console.log('Download report');
  }, []);

  // Move to results step when import completes
  if (activeStep === 5 && isComplete && !hasFailed) {
    setActiveStep(6);
  }

  // Determine if Next button should be disabled
  const isNextDisabled = useMemo(() => {
    if (isLoading) return true;
    if (activeStep === 0 && !prerequisitesMet) return true;
    if (activeStep === 5 && isImporting) return true;
    return false;
  }, [isLoading, activeStep, prerequisitesMet, isImporting]);

  return (
    <Box>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Import Price Guide
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Import price guide data from your legacy system.
          {sourceCounts && (
            <>
              {' '}
              Found{' '}
              <strong>
                {(
                  sourceCounts.msis +
                  sourceCounts.options +
                  sourceCounts.upCharges
                ).toLocaleString()}
              </strong>{' '}
              total items.
            </>
          )}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          {WIZARD_STEPS.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Divider sx={{ mb: 3 }} />

        {/* Error Display */}
        {hasFailed && importError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Import Failed
            </Typography>
            <Typography variant="body2">{importError}</Typography>
          </Alert>
        )}

        {/* Step Content */}
        <Box sx={{ minHeight: 300 }}>
          {activeStep === 0 && (
            <PrerequisitesStep
              sourceCounts={sourceCounts}
              isLoading={isLoading}
              connectionStatus={connectionStatus}
              officeMappings={officeMappings}
            />
          )}

          {activeStep === 1 && (
            <OfficeMappingStep
              officeMappings={officeMappings}
              isLoading={isLoadingMappings}
            />
          )}

          {activeStep === 2 && (
            <PriceTypeStep config={config} onConfigChange={updateConfig} />
          )}

          {activeStep === 3 && (
            <ConfigurationStep
              config={config}
              onConfigChange={updateConfig}
              sourceCounts={sourceCounts}
            />
          )}

          {activeStep === 4 && (
            <PreviewStep sourceCounts={sourceCounts} config={config} />
          )}

          {activeStep === 5 && <ProgressStep progress={progress} />}

          {activeStep === 6 && (
            <ResultsStep
              results={results}
              onViewPriceGuide={handleViewPriceGuide}
              onDownloadReport={handleDownloadReport}
            />
          )}
        </Box>

        <Divider sx={{ mt: 3, mb: 2 }} />

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          {activeStep < 5 && <Button onClick={onCancel}>Cancel</Button>}

          {activeStep > 0 && activeStep < 5 && (
            <Button onClick={handleBack}>Back</Button>
          )}

          {activeStep === 5 && hasFailed && (
            <>
              <Button onClick={handleRetry}>Try Again</Button>
              <Button variant="outlined" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}

          {activeStep < 5 && (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={isNextDisabled}
            >
              {activeStep === 4 ? '🚀 Start Import' : 'Next'}
            </Button>
          )}

          {activeStep === 6 && (
            <Button variant="contained" onClick={onComplete}>
              Done
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
};
