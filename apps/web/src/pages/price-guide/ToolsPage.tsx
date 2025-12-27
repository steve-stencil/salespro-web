/**
 * Price Guide Tools Page.
 * Provides mass operations and management tools for the price guide.
 */

import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
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
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type TabValue = 'mass-price' | 'price-types' | 'validation';

type PriceChangeType = 'percentage' | 'fixed';
type PriceChangeScope = 'all' | 'category' | 'office';

type ValidationResult = {
  category: string;
  issues: ValidationIssue[];
};

type ValidationIssue = {
  type: 'error' | 'warning';
  message: string;
  affectedCount: number;
};

type PriceType = {
  id: string;
  code: string;
  name: string;
  isGlobal: boolean;
  usageCount: number;
};

// ============================================================================
// Tab Panel Component
// ============================================================================

type TabPanelProps = {
  children: React.ReactNode;
  value: TabValue;
  current: TabValue;
};

function TabPanel({
  children,
  value,
  current,
}: TabPanelProps): React.ReactElement | null {
  if (value !== current) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

// ============================================================================
// Mass Price Change Component
// ============================================================================

function MassPriceChange(): React.ReactElement {
  const [changeType, setChangeType] = useState<PriceChangeType>('percentage');
  const [scope, setScope] = useState<PriceChangeScope>('all');
  const [amount, setAmount] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    updated: number;
    errors: number;
  } | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);
    setResult(null);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 5000));
    clearInterval(interval);
    setProgress(100);

    setResult({
      success: true,
      updated: 156,
      errors: 0,
    });
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    setAmount('');
    setResult(null);
    setProgress(0);
  }, []);

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PriceChangeIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h6">Mass Price Change</Typography>
              <Typography variant="body2" color="text.secondary">
                Apply price adjustments across multiple items at once
              </Typography>
            </Box>
          </Box>

          <Divider />

          {result ? (
            <Alert
              severity={result.success ? 'success' : 'error'}
              action={
                <Button color="inherit" size="small" onClick={handleReset}>
                  Start New
                </Button>
              }
            >
              {result.success
                ? `Successfully updated ${result.updated} prices.`
                : `Price change failed with ${result.errors} errors.`}
            </Alert>
          ) : (
            <>
              <FormControl>
                <FormLabel>Change Type</FormLabel>
                <RadioGroup
                  row
                  value={changeType}
                  onChange={e =>
                    setChangeType(e.target.value as PriceChangeType)
                  }
                >
                  <FormControlLabel
                    value="percentage"
                    control={<Radio />}
                    label="Percentage"
                    disabled={isRunning}
                  />
                  <FormControlLabel
                    value="fixed"
                    control={<Radio />}
                    label="Fixed Amount"
                    disabled={isRunning}
                  />
                </RadioGroup>
              </FormControl>

              <FormControl>
                <FormLabel>Scope</FormLabel>
                <RadioGroup
                  row
                  value={scope}
                  onChange={e => setScope(e.target.value as PriceChangeScope)}
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio />}
                    label="All Items"
                    disabled={isRunning}
                  />
                  <FormControlLabel
                    value="category"
                    control={<Radio />}
                    label="By Category"
                    disabled={isRunning}
                  />
                  <FormControlLabel
                    value="office"
                    control={<Radio />}
                    label="By Office"
                    disabled={isRunning}
                  />
                </RadioGroup>
              </FormControl>

              <TextField
                label={
                  changeType === 'percentage'
                    ? 'Percentage Change'
                    : 'Amount Change'
                }
                value={amount}
                onChange={e => setAmount(e.target.value)}
                type="number"
                disabled={isRunning}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {changeType === 'percentage' ? '%' : '$'}
                    </InputAdornment>
                  ),
                }}
                helperText={
                  changeType === 'percentage'
                    ? 'Use positive values to increase, negative to decrease'
                    : 'Amount will be added to current prices'
                }
                sx={{ maxWidth: 300 }}
              />

              {isRunning && (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Applying price changes... {progress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={
                    isRunning ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <PlayArrowIcon />
                    )
                  }
                  onClick={() => void handleRun()}
                  disabled={!amount || isRunning}
                >
                  {isRunning ? 'Running...' : 'Apply Changes'}
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Custom Price Types Component
// ============================================================================

function CustomPriceTypes(): React.ReactElement {
  const [priceTypes] = useState<PriceType[]>([
    {
      id: '1',
      code: 'RETAIL',
      name: 'Retail Price',
      isGlobal: true,
      usageCount: 450,
    },
    {
      id: '2',
      code: 'WHOLESALE',
      name: 'Wholesale Price',
      isGlobal: true,
      usageCount: 320,
    },
    {
      id: '3',
      code: 'CONTRACTOR',
      name: 'Contractor Price',
      isGlobal: false,
      usageCount: 180,
    },
    {
      id: '4',
      code: 'PREMIUM',
      name: 'Premium Price',
      isGlobal: false,
      usageCount: 95,
    },
  ]);
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeName, setNewTypeName] = useState('');

  const handleAdd = useCallback(() => {
    // TODO: Implement add price type
    console.log('Add price type:', newTypeCode, newTypeName);
    setNewTypeCode('');
    setNewTypeName('');
  }, [newTypeCode, newTypeName]);

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LocalOfferIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h6">Custom Price Types</Typography>
              <Typography variant="body2" color="text.secondary">
                Manage price type codes used across the catalog
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Add New Price Type */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              label="Code"
              value={newTypeCode}
              onChange={e => setNewTypeCode(e.target.value.toUpperCase())}
              size="small"
              sx={{ width: 150 }}
              inputProps={{ maxLength: 20 }}
            />
            <TextField
              label="Display Name"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              size="small"
              sx={{ flex: 1, maxWidth: 300 }}
            />
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!newTypeCode || !newTypeName}
            >
              Add Type
            </Button>
          </Box>

          {/* Existing Price Types */}
          <List>
            {priceTypes.map(pt => (
              <ListItem
                key={pt.id}
                secondaryAction={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={`${pt.usageCount} uses`}
                      size="small"
                      variant="outlined"
                    />
                    {!pt.isGlobal && (
                      <Button size="small" color="error">
                        Delete
                      </Button>
                    )}
                  </Stack>
                }
              >
                <ListItemIcon>
                  <LocalOfferIcon color={pt.isGlobal ? 'primary' : 'action'} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">{pt.code}</Typography>
                      {pt.isGlobal && (
                        <Chip label="Global" size="small" color="primary" />
                      )}
                    </Box>
                  }
                  secondary={pt.name}
                />
              </ListItem>
            ))}
          </List>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Data Validation Component
// ============================================================================

function DataValidation(): React.ReactElement {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ValidationResult[] | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setResults(null);

    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 3000));

    setResults([
      {
        category: 'Missing Prices',
        issues: [
          {
            type: 'error',
            message: 'Options without any pricing configured',
            affectedCount: 12,
          },
          {
            type: 'warning',
            message: 'Options with pricing for only some offices',
            affectedCount: 34,
          },
        ],
      },
      {
        category: 'Orphaned Items',
        issues: [
          {
            type: 'warning',
            message: 'Options not linked to any MSI',
            affectedCount: 8,
          },
          {
            type: 'warning',
            message: 'UpCharges not linked to any MSI',
            affectedCount: 3,
          },
        ],
      },
      {
        category: 'Data Integrity',
        issues: [
          {
            type: 'error',
            message: 'MSIs with invalid category references',
            affectedCount: 0,
          },
        ],
      },
    ]);
    setIsRunning(false);
  }, []);

  const totalErrors =
    results?.reduce(
      (sum, r) =>
        sum +
        r.issues
          .filter(i => i.type === 'error')
          .reduce((s, i) => s + i.affectedCount, 0),
      0,
    ) ?? 0;

  const totalWarnings =
    results?.reduce(
      (sum, r) =>
        sum +
        r.issues
          .filter(i => i.type === 'warning')
          .reduce((s, i) => s + i.affectedCount, 0),
      0,
    ) ?? 0;

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <VerifiedIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h6">Data Validation</Typography>
              <Typography variant="body2" color="text.secondary">
                Check catalog data for issues and inconsistencies
              </Typography>
            </Box>
          </Box>

          <Divider />

          {!results ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              {isRunning ? (
                <>
                  <CircularProgress size={48} sx={{ mb: 2 }} />
                  <Typography variant="body1">
                    Running validation checks...
                  </Typography>
                </>
              ) : (
                <>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Run validation to check for data issues
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => void handleRun()}
                  >
                    Run Validation
                  </Button>
                </>
              )}
            </Box>
          ) : (
            <>
              {/* Summary */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Chip
                  icon={<ErrorIcon />}
                  label={`${totalErrors} Errors`}
                  color={totalErrors > 0 ? 'error' : 'default'}
                />
                <Chip
                  icon={<WarningIcon />}
                  label={`${totalWarnings} Warnings`}
                  color={totalWarnings > 0 ? 'warning' : 'default'}
                />
                {totalErrors === 0 && totalWarnings === 0 && (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="All Checks Passed"
                    color="success"
                  />
                )}
              </Box>

              {/* Results */}
              <Stack spacing={2}>
                {results.map(result => (
                  <Box key={result.category}>
                    <Typography variant="subtitle2" gutterBottom>
                      {result.category}
                    </Typography>
                    <List dense>
                      {result.issues.map((issue, index) => (
                        <ListItem key={index}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {issue.type === 'error' ? (
                              <ErrorIcon color="error" fontSize="small" />
                            ) : (
                              <WarningIcon color="warning" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={issue.message}
                            secondary={
                              issue.affectedCount > 0
                                ? `${issue.affectedCount} affected`
                                : 'None found'
                            }
                          />
                          {issue.affectedCount > 0 && (
                            <Button size="small">View</Button>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </Stack>

              <Button
                variant="outlined"
                startIcon={<PlayArrowIcon />}
                onClick={() => void handleRun()}
              >
                Run Again
              </Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ToolsPage(): React.ReactElement {
  const [currentTab, setCurrentTab] = useState<TabValue>('mass-price');

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BuildIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" component="h1">
              Price Guide Tools
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mass operations and management utilities
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={currentTab}
          onChange={(_, value: TabValue) => setCurrentTab(value)}
        >
          <Tab
            icon={<PriceChangeIcon />}
            iconPosition="start"
            label="Mass Price Change"
            value="mass-price"
          />
          <Tab
            icon={<LocalOfferIcon />}
            iconPosition="start"
            label="Price Types"
            value="price-types"
          />
          <Tab
            icon={<VerifiedIcon />}
            iconPosition="start"
            label="Validation"
            value="validation"
          />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value="mass-price" current={currentTab}>
        <MassPriceChange />
      </TabPanel>

      <TabPanel value="price-types" current={currentTab}>
        <CustomPriceTypes />
      </TabPanel>

      <TabPanel value="validation" current={currentTab}>
        <DataValidation />
      </TabPanel>
    </Box>
  );
}
