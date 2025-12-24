/**
 * Office Mapping Step Component
 *
 * Step 1 of the import wizard - map source offices to local offices.
 */

import AddIcon from '@mui/icons-material/Add';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect } from 'react';

import { useLocalOffices, useSourceOffices } from '../hooks';

import type { LocalOffice, OfficeMapping, ParseSourceOffice } from '../types';
import type { SelectChangeEvent } from '@mui/material';
import type { FC } from 'react';

type OfficeMappingStepProps = {
  readonly officeMapping: OfficeMapping;
  readonly onMappingChange: (mapping: OfficeMapping) => void;
  readonly onNext: () => void;
  readonly onCancel: () => void;
};

/**
 * Office Mapping Step Component.
 */
export const OfficeMappingStep: FC<OfficeMappingStepProps> = ({
  officeMapping,
  onMappingChange,
  onNext,
  onCancel,
}) => {
  const {
    data: sourceOffices,
    isLoading: isLoadingSource,
    error: sourceError,
  } = useSourceOffices();
  const {
    data: localOffices,
    isLoading: isLoadingLocal,
    error: localError,
  } = useLocalOffices();

  // Initialize mapping when source offices load
  useEffect(() => {
    if (sourceOffices && Object.keys(officeMapping).length === 0) {
      const initialMapping: OfficeMapping = {};
      for (const office of sourceOffices) {
        // Try to auto-match by name
        const matchedLocal = localOffices?.find(
          local =>
            local.name.toLowerCase().trim() ===
            office.name.toLowerCase().trim(),
        );
        initialMapping[office.objectId] = matchedLocal?.id ?? 'none';
      }
      onMappingChange(initialMapping);
    }
  }, [sourceOffices, localOffices, officeMapping, onMappingChange]);

  const handleMappingChange = (
    sourceId: string,
    event: SelectChangeEvent<string>,
  ) => {
    onMappingChange({
      ...officeMapping,
      [sourceId]: event.target.value,
    });
  };

  const isLoading = isLoadingSource || isLoadingLocal;
  const error = sourceError ?? localError;

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={400}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load offices. Please try again.
      </Alert>
    );
  }

  const sourceOfficeList: ParseSourceOffice[] = sourceOffices ?? [];
  const localOfficeList: LocalOffice[] = localOffices ?? [];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Step 1: Map Source Offices
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Map each office from the source system to an existing office in your
          account, or choose to create new ones.
        </Typography>
      </Box>

      {sourceOfficeList.length === 0 ? (
        <Alert severity="info">
          No offices found in the source system. Documents will be imported
          without office assignments.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: '40%' }}>
                  Source Office
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    Map To
                    <Tooltip title="Select an existing office, create a new one, or skip to not assign any office">
                      <HelpOutlineIcon
                        fontSize="small"
                        color="action"
                        sx={{ cursor: 'help' }}
                      />
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sourceOfficeList.map(sourceOffice => (
                <TableRow
                  key={sourceOffice.objectId}
                  data-testid="office-mapping-row"
                >
                  <TableCell>
                    <Typography variant="body2">{sourceOffice.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {sourceOffice.objectId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <FormControl fullWidth size="small">
                      <InputLabel
                        id={`office-mapping-${sourceOffice.objectId}`}
                      >
                        Select mapping
                      </InputLabel>
                      <Select
                        labelId={`office-mapping-${sourceOffice.objectId}`}
                        label="Select mapping"
                        value={officeMapping[sourceOffice.objectId] ?? 'none'}
                        onChange={event =>
                          handleMappingChange(sourceOffice.objectId, event)
                        }
                        data-testid="office-mapping-select"
                      >
                        <MenuItem value="none" data-testid="office-option">
                          <Box display="flex" alignItems="center" gap={1}>
                            <RemoveCircleOutlineIcon
                              fontSize="small"
                              color="action"
                            />
                            Skip (No Office)
                          </Box>
                        </MenuItem>
                        <MenuItem value="create" data-testid="office-option">
                          <Box display="flex" alignItems="center" gap={1}>
                            <AddIcon fontSize="small" color="primary" />
                            Create New Office
                          </Box>
                        </MenuItem>
                        {localOfficeList.map(local => (
                          <MenuItem
                            key={local.id}
                            value={local.id}
                            data-testid="office-option"
                          >
                            {local.name}
                            {!local.isActive && (
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                sx={{ ml: 1 }}
                              >
                                (inactive)
                              </Typography>
                            )}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" color="primary" onClick={onNext}>
          Next: Map Types
        </Button>
      </Box>
    </Box>
  );
};
