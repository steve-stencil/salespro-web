/**
 * Price Guide Migration Wizard Page.
 * Guides users through migrating legacy price guide data.
 */

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CategoryIcon from '@mui/icons-material/Category';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InventoryIcon from '@mui/icons-material/Inventory';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import LinkIcon from '@mui/icons-material/Link';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import StorageIcon from '@mui/icons-material/Storage';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningIcon from '@mui/icons-material/Warning';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type StepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

type MigrationStep = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  itemsToMigrate?: number;
  itemsMigrated?: number;
  errors?: string[];
  warnings?: string[];
};

// ============================================================================
// Step Content Components
// ============================================================================

type StepContentProps = {
  step: MigrationStep;
  onRun: () => Promise<void>;
  isRunning: boolean;
};

function StepContent({
  step,
  onRun,
  isRunning,
}: StepContentProps): React.ReactElement {
  const hasErrors = step.errors && step.errors.length > 0;
  const hasWarnings = step.warnings && step.warnings.length > 0;

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          {/* Step Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'primary.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
              }}
            >
              {step.icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">{step.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                {step.description}
              </Typography>
            </Box>
            <Chip
              label={step.status}
              color={
                step.status === 'completed'
                  ? 'success'
                  : step.status === 'error'
                    ? 'error'
                    : step.status === 'running'
                      ? 'primary'
                      : 'default'
              }
              size="small"
            />
          </Box>

          <Divider />

          {/* Preview/Stats */}
          {step.itemsToMigrate !== undefined && (
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Paper
                variant="outlined"
                sx={{ p: 2, flex: 1, textAlign: 'center' }}
              >
                <Typography variant="h4" color="primary">
                  {step.itemsToMigrate}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Items to Migrate
                </Typography>
              </Paper>
              {step.status !== 'pending' && (
                <Paper
                  variant="outlined"
                  sx={{ p: 2, flex: 1, textAlign: 'center' }}
                >
                  <Typography variant="h4" color="success.main">
                    {step.itemsMigrated ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Items Migrated
                  </Typography>
                </Paper>
              )}
            </Box>
          )}

          {/* Progress */}
          {step.status === 'running' && step.itemsToMigrate && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Migrating...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(
                    ((step.itemsMigrated ?? 0) / step.itemsToMigrate) * 100,
                  )}
                  %
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={((step.itemsMigrated ?? 0) / step.itemsToMigrate) * 100}
              />
            </Box>
          )}

          {/* Errors */}
          {hasErrors && (
            <Alert severity="error">
              <Typography variant="subtitle2" gutterBottom>
                Errors ({step.errors?.length})
              </Typography>
              <List dense>
                {step.errors?.slice(0, 5).map((error, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <ErrorIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText primary={error} />
                  </ListItem>
                ))}
                {(step.errors?.length ?? 0) > 5 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    ...and {(step.errors?.length ?? 0) - 5} more errors
                  </Typography>
                )}
              </List>
            </Alert>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <Alert severity="warning">
              <Typography variant="subtitle2" gutterBottom>
                Warnings ({step.warnings?.length})
              </Typography>
              <List dense>
                {step.warnings?.slice(0, 3).map((warning, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <WarningIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    <ListItemText primary={warning} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {/* Action */}
          {step.status === 'pending' && (
            <Button
              variant="contained"
              startIcon={
                isRunning ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <PlayArrowIcon />
                )
              }
              onClick={() => void onRun()}
              disabled={isRunning}
            >
              {isRunning ? 'Running...' : `Migrate ${step.label}`}
            </Button>
          )}

          {step.status === 'completed' && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              Migration completed successfully!
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const INITIAL_STEPS: MigrationStep[] = [
  {
    id: 'price-types',
    label: 'Price Types',
    description: 'Initialize global and custom price type codes',
    icon: <LocalOfferIcon />,
    status: 'pending',
    itemsToMigrate: 4,
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Migrate category hierarchy from legacy system',
    icon: <CategoryIcon />,
    status: 'pending',
    itemsToMigrate: 24,
  },
  {
    id: 'libraries',
    label: 'Shared Libraries',
    description: 'Migrate options, upcharges, and additional details',
    icon: <LibraryBooksIcon />,
    status: 'pending',
    itemsToMigrate: 156,
  },
  {
    id: 'msis',
    label: 'Measure Sheet Items',
    description: 'Migrate all MSI definitions and tag fields',
    icon: <InventoryIcon />,
    status: 'pending',
    itemsToMigrate: 342,
  },
  {
    id: 'pricing',
    label: 'Pricing',
    description: 'Migrate all pricing data for options and upcharges',
    icon: <PriceChangeIcon />,
    status: 'pending',
    itemsToMigrate: 2840,
  },
  {
    id: 'relationships',
    label: 'Relationships',
    description: 'Link MSIs to options, upcharges, and offices',
    icon: <LinkIcon />,
    status: 'pending',
    itemsToMigrate: 1250,
  },
  {
    id: 'validation',
    label: 'Validation',
    description: 'Verify migrated data integrity and completeness',
    icon: <VerifiedIcon />,
    status: 'pending',
  },
];

export function MigrationWizardPage(): React.ReactElement {
  const [activeStep, setActiveStep] = useState(0);
  const [steps, setSteps] = useState<MigrationStep[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);

  // Safe to assert: activeStep is always valid within steps.length bounds
  const currentStep = steps[activeStep] as MigrationStep;

  const handleRunStep = useCallback(async () => {
    const step = steps[activeStep];
    if (!step) return;

    setIsRunning(true);

    // Update step to running
    setSteps(prev =>
      prev.map((s, i) =>
        i === activeStep
          ? { ...s, status: 'running' as StepStatus, itemsMigrated: 0 }
          : s,
      ),
    );

    // Simulate migration progress
    const totalItems = step.itemsToMigrate ?? 10;
    for (let i = 0; i <= totalItems; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      setSteps(prev =>
        prev.map((s, idx) =>
          idx === activeStep ? { ...s, itemsMigrated: i } : s,
        ),
      );
    }

    // Complete the step (with some random warnings for demo)
    const hasWarnings = Math.random() > 0.7;
    setSteps(prev =>
      prev.map((s, i) =>
        i === activeStep
          ? {
              ...s,
              status: 'completed' as StepStatus,
              itemsMigrated: s.itemsToMigrate,
              warnings: hasWarnings
                ? ['Some items had duplicate names and were merged']
                : undefined,
            }
          : s,
      ),
    );

    setIsRunning(false);
  }, [activeStep, steps]);

  const handleNext = useCallback(() => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  }, [activeStep, steps.length]);

  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  }, [activeStep]);

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const allComplete = completedCount === steps.length;

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <StorageIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" component="h1">
              Migration Wizard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Migrate your legacy price guide data to the new system
            </Typography>
          </Box>
        </Box>
        <Chip
          label={`${completedCount} / ${steps.length} Complete`}
          color={allComplete ? 'success' : 'primary'}
          variant="outlined"
        />
      </Box>

      {/* Stepper */}
      <Box sx={{ mb: 4 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((step, index) => (
            <Step
              key={step.id}
              completed={step.status === 'completed'}
              sx={{ cursor: 'pointer' }}
              onClick={() => setActiveStep(index)}
            >
              <StepLabel
                error={step.status === 'error'}
                icon={
                  step.status === 'completed' ? (
                    <CheckCircleIcon color="success" />
                  ) : step.status === 'error' ? (
                    <ErrorIcon color="error" />
                  ) : undefined
                }
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Current Step Content */}
      <StepContent
        step={currentStep}
        onRun={handleRunStep}
        isRunning={isRunning}
      />

      {/* Navigation */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 4,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          disabled={activeStep === 0 || isRunning}
        >
          Previous
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={handleNext}
            disabled={currentStep.status !== 'completed' || isRunning}
          >
            Next Step
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            disabled={!allComplete}
            endIcon={<CheckCircleIcon />}
          >
            Complete Migration
          </Button>
        )}
      </Box>

      {/* All Complete Banner */}
      {allComplete && (
        <Alert severity="success" sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Migration Complete!
          </Typography>
          <Typography variant="body2">
            All data has been successfully migrated to the new price guide
            system. You can now access your catalog, library, and pricing tools.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
