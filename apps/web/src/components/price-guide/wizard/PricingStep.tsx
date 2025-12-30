/**
 * Pricing Step Component.
 * Step 5 of the Create MSI Wizard.
 * Allows setting base prices per office and price type.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useMemo } from 'react';

import { useOfficesList } from '../../../hooks/useOffices';
import { usePriceTypes } from '../../../hooks/usePriceGuide';

import { useWizard } from './WizardContext';

// ============================================================================
// Main Component
// ============================================================================

export function PricingStep(): React.ReactElement {
  const { state, setMsiPrice } = useWizard();

  // Queries
  const { data: officesData, isLoading: isLoadingOffices } = useOfficesList();
  const { data: priceTypesData, isLoading: isLoadingPriceTypes } =
    usePriceTypes();

  // Filter offices to only show selected ones
  const selectedOffices = useMemo(() => {
    if (!officesData?.offices) return [];
    return officesData.offices.filter(office =>
      state.officeIds.includes(office.id),
    );
  }, [officesData, state.officeIds]);

  // Get price types
  const priceTypes = useMemo(() => {
    if (!priceTypesData?.priceTypes) return [];
    return priceTypesData.priceTypes.filter(pt => pt.isActive);
  }, [priceTypesData]);

  // Handler for price changes
  const handlePriceChange = useCallback(
    (officeId: string, priceTypeId: string, value: string) => {
      const numericValue = value === '' ? 0 : parseFloat(value);
      if (!isNaN(numericValue) && numericValue >= 0) {
        setMsiPrice(officeId, priceTypeId, numericValue);
      }
    },
    [setMsiPrice],
  );

  // Get price value for display
  const getPriceValue = useCallback(
    (officeId: string, priceTypeId: string): string => {
      const officeData = state.msiPricing[officeId];
      if (!officeData) return '';
      const value = officeData[priceTypeId];
      if (value === undefined || value === 0) return '';
      return value.toString();
    },
    [state.msiPricing],
  );

  const isLoading = isLoadingOffices || isLoadingPriceTypes;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (selectedOffices.length === 0) {
    return (
      <Box>
        <Typography variant="h3" gutterBottom>
          Pricing
        </Typography>
        <Alert severity="warning">
          No offices selected. Please go back to Step 1 and select at least one
          office.
        </Alert>
      </Box>
    );
  }

  if (priceTypes.length === 0) {
    return (
      <Box>
        <Typography variant="h3" gutterBottom>
          Pricing
        </Typography>
        <Alert severity="warning">
          No price types available. Please configure price types in the admin
          settings.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Pricing
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Set base prices for this item across offices and price types. You can
        configure option-specific pricing after creation.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Leave cells empty or at 0 for prices you don&apos;t want to set. Pricing
        is optional and can be configured later.
      </Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 600,
                  bgcolor: 'action.hover',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}
              >
                Office
              </TableCell>
              {priceTypes.map(priceType => (
                <TableCell
                  key={priceType.id}
                  align="right"
                  sx={{
                    fontWeight: 600,
                    bgcolor: 'action.hover',
                    minWidth: 120,
                  }}
                >
                  {priceType.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedOffices.map(office => (
              <TableRow key={office.id} hover>
                <TableCell
                  sx={{
                    fontWeight: 500,
                    position: 'sticky',
                    left: 0,
                    bgcolor: 'background.paper',
                    zIndex: 1,
                  }}
                >
                  {office.name}
                </TableCell>
                {priceTypes.map(priceType => (
                  <TableCell key={priceType.id} align="right" sx={{ p: 0.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{
                        min: 0,
                        step: 0.01,
                        style: { textAlign: 'right' },
                      }}
                      value={getPriceValue(office.id, priceType.id)}
                      onChange={e =>
                        handlePriceChange(
                          office.id,
                          priceType.id,
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: 'divider' },
                        },
                      }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {state.options.length > 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          You have {state.options.length} option(s) linked. Option-specific
          pricing can be configured after creation on the Pricing page.
        </Alert>
      )}

      {state.upcharges.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You have {state.upcharges.length} upcharge(s) linked. Upcharge pricing
          can be configured after creation on the Pricing page.
        </Alert>
      )}
    </Box>
  );
}
