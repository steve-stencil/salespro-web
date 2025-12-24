/**
 * Type Mapping Step Component
 *
 * Step 2 of the import wizard - map source types to DocumentTypes.
 */

import AddIcon from '@mui/icons-material/Add';
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
  Typography,
} from '@mui/material';
import { useEffect } from 'react';

import { useDocumentTypes, useSourceTypes } from '../hooks';

import type { DocumentTypeItem, TypeMapping } from '../types';
import type { SelectChangeEvent } from '@mui/material';
import type { FC } from 'react';

type TypeMappingStepProps = {
  readonly typeMapping: TypeMapping;
  readonly onMappingChange: (mapping: TypeMapping) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
};

/**
 * Type Mapping Step Component.
 */
export const TypeMappingStep: FC<TypeMappingStepProps> = ({
  typeMapping,
  onMappingChange,
  onNext,
  onBack,
}) => {
  const {
    data: sourceTypes,
    isLoading: isLoadingSource,
    error: sourceError,
  } = useSourceTypes();
  const {
    data: documentTypes,
    isLoading: isLoadingTypes,
    error: typesError,
  } = useDocumentTypes();

  // Initialize mapping when source types load
  useEffect(() => {
    if (sourceTypes && Object.keys(typeMapping).length === 0) {
      const initialMapping: TypeMapping = {};
      for (const sourceType of sourceTypes) {
        // Try to auto-match by name
        const matchedType = documentTypes?.find(
          dt =>
            dt.name.toLowerCase().trim() === sourceType.toLowerCase().trim(),
        );
        initialMapping[sourceType] = matchedType?.id ?? 'create';
      }
      onMappingChange(initialMapping);
    }
  }, [sourceTypes, documentTypes, typeMapping, onMappingChange]);

  const handleMappingChange = (
    sourceType: string,
    event: SelectChangeEvent<string>,
  ) => {
    onMappingChange({
      ...typeMapping,
      [sourceType]: event.target.value,
    });
  };

  const isLoading = isLoadingSource || isLoadingTypes;
  const error = sourceError ?? typesError;

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
        Failed to load document types. Please try again.
      </Alert>
    );
  }

  const sourceTypeList: string[] = sourceTypes ?? [];
  const documentTypeList: DocumentTypeItem[] = documentTypes ?? [];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Step 2: Map Document Types
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Map each document type from the source system to an existing type, or
          create new ones. Default types (contract, proposal) are pre-created.
        </Typography>
      </Box>

      {sourceTypeList.length === 0 ? (
        <Alert severity="info">
          No document types found in the source system. Documents will use the
          default "contract" type.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: '40%' }}>
                  Source Type
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Map To</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sourceTypeList.map(sourceType => (
                <TableRow key={sourceType} data-testid="type-mapping-row">
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ textTransform: 'capitalize' }}
                    >
                      {sourceType}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`type-mapping-${sourceType}`}>
                        Select type
                      </InputLabel>
                      <Select
                        labelId={`type-mapping-${sourceType}`}
                        label="Select type"
                        value={typeMapping[sourceType] ?? 'create'}
                        onChange={event =>
                          handleMappingChange(sourceType, event)
                        }
                        data-testid="type-mapping-select"
                      >
                        <MenuItem value="create" data-testid="type-option">
                          <Box display="flex" alignItems="center" gap={1}>
                            <AddIcon fontSize="small" color="primary" />
                            Create "{sourceType}"
                          </Box>
                        </MenuItem>
                        {documentTypeList.map(docType => (
                          <MenuItem
                            key={docType.id}
                            value={docType.id}
                            data-testid="type-option"
                          >
                            <Box display="flex" alignItems="center" gap={1}>
                              {docType.name}
                              {docType.isDefault && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  (default)
                                </Typography>
                              )}
                            </Box>
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

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" color="primary" onClick={onNext}>
          Start Import
        </Button>
      </Box>
    </Box>
  );
};
