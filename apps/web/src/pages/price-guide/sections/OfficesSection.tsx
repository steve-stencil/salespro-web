/**
 * Offices Section Component.
 * Handles multi-select office assignment for MSI.
 */

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';

import { useOfficesList } from '../../../hooks/useOffices';

import type { WizardState } from '../../../components/price-guide/wizard/WizardContext';

// ============================================================================
// Types
// ============================================================================

export type OfficesSectionProps = {
  state: WizardState;
  setBasicInfo: (info: Partial<WizardState>) => void;
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Section for editing office assignments for an MSI.
 */
export function OfficesSection({
  state,
  setBasicInfo,
}: OfficesSectionProps): React.ReactElement {
  // Queries
  const { data: officesData, isLoading: isLoadingOffices } = useOfficesList();

  // Handlers
  const handleOfficesChange = useCallback(
    (officeId: string, checked: boolean) => {
      if (checked) {
        setBasicInfo({ officeIds: [...state.officeIds, officeId] });
      } else {
        setBasicInfo({
          officeIds: state.officeIds.filter(id => id !== officeId),
        });
      }
    },
    [setBasicInfo, state.officeIds],
  );

  const handleSelectAllOffices = useCallback(() => {
    if (!officesData?.offices) return;
    const allIds = officesData.offices.map(o => o.id);
    if (state.officeIds.length === allIds.length) {
      setBasicInfo({ officeIds: [] });
    } else {
      setBasicInfo({ officeIds: allIds });
    }
  }, [officesData, state.officeIds.length, setBasicInfo]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2">
          Select Offices{' '}
          <Typography component="span" color="error">
            *
          </Typography>
        </Typography>
        <Chip
          label={
            state.officeIds.length === officesData?.offices.length
              ? 'Deselect All'
              : 'Select All'
          }
          size="small"
          onClick={handleSelectAllOffices}
          variant="outlined"
        />
      </Box>
      <FormHelperText sx={{ mb: 2 }}>
        Select which offices can use this item
      </FormHelperText>

      {isLoadingOffices ? (
        <Typography variant="body2" color="text.secondary">
          Loading offices...
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {officesData?.offices.map(office => (
            <FormControlLabel
              key={office.id}
              control={
                <Checkbox
                  checked={state.officeIds.includes(office.id)}
                  onChange={e =>
                    handleOfficesChange(office.id, e.target.checked)
                  }
                  size="small"
                />
              }
              label={office.name}
              sx={{
                border: 1,
                borderColor: state.officeIds.includes(office.id)
                  ? 'primary.main'
                  : 'divider',
                borderRadius: 1,
                px: 1,
                m: 0,
                bgcolor: state.officeIds.includes(office.id)
                  ? 'primary.50'
                  : 'transparent',
              }}
            />
          ))}
        </Box>
      )}

      {state.officeIds.length === 0 && (
        <FormHelperText error sx={{ mt: 1 }}>
          At least one office is required
        </FormHelperText>
      )}
    </Box>
  );
}
