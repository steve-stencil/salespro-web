/**
 * Pricing Export Dialog Component.
 * Allows exporting option prices to Excel with filtering by office, category, and tags.
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
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useEffect, useMemo } from 'react';

import { useOfficesList } from '../../hooks/useOffices';
import { useCategoryTree } from '../../hooks/usePriceGuide';
import { useTagList } from '../../hooks/useTags';
import { priceGuideApi } from '../../services/price-guide';

import type { PricingExportFilters } from '@shared/core';

// ============================================================================
// Types
// ============================================================================

type PricingExportDialogProps = {
  open: boolean;
  onClose: () => void;
};

type CategoryNode = {
  id: string;
  name: string;
  children?: CategoryNode[];
};

// ============================================================================
// Helper: Flatten category tree for checkbox list
// ============================================================================

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  const result: Array<{ id: string; name: string; depth: number }> = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, depth });
    if (node.children) {
      result.push(...flattenCategories(node.children, depth + 1));
    }
  }
  return result;
}

// ============================================================================
// Main Component
// ============================================================================

export function PricingExportDialog({
  open,
  onClose,
}: PricingExportDialogProps): React.ReactElement {
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [estimatedRows, setEstimatedRows] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data fetching
  const { data: officesData } = useOfficesList();
  const { data: categoryTree } = useCategoryTree();
  const { data: tagsData } = useTagList();

  const offices = officesData?.offices ?? [];
  const flatCategories = useMemo(
    () => flattenCategories(categoryTree?.categories ?? []),
    [categoryTree],
  );
  const tags = tagsData?.tags ?? [];

  // Get estimated row count when filters change
  useEffect(() => {
    if (!open) return;

    const filters: PricingExportFilters = {
      officeIds: selectedOfficeIds.length > 0 ? selectedOfficeIds : undefined,
      categoryIds:
        selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    };

    setIsLoadingCount(true);
    priceGuideApi
      .getExportRowCount(filters)
      .then(result => {
        setEstimatedRows(result.estimatedRows);
      })
      .catch(() => {
        setEstimatedRows(null);
      })
      .finally(() => {
        setIsLoadingCount(false);
      });
  }, [open, selectedOfficeIds, selectedCategoryIds, selectedTagIds]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedOfficeIds([]);
      setSelectedCategoryIds([]);
      setSelectedTagIds([]);
      setError(null);
    }
  }, [open]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const filters: PricingExportFilters = {
        officeIds: selectedOfficeIds.length > 0 ? selectedOfficeIds : undefined,
        categoryIds:
          selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      };

      await priceGuideApi.exportOptionPrices(filters);
      onClose();
    } catch (err) {
      setError('Failed to export. Please try again.');
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [selectedOfficeIds, selectedCategoryIds, selectedTagIds, onClose]);

  const handleClose = useCallback(() => {
    if (isExporting) return;
    onClose();
  }, [isExporting, onClose]);

  const handleOfficeToggle = useCallback((officeId: string) => {
    setSelectedOfficeIds(prev =>
      prev.includes(officeId)
        ? prev.filter(id => id !== officeId)
        : [...prev, officeId],
    );
  }, []);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId],
    );
  }, []);

  const handleTagToggle = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId],
    );
  }, []);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DownloadIcon color="primary" />
        Export Option Prices
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Export option prices to an Excel spreadsheet. Use filters below to
            export only specific offices, categories, or tagged options.
          </Typography>

          {/* Office Filter */}
          {offices.length > 0 && (
            <FormControl component="fieldset">
              <FormLabel component="legend">
                Offices{' '}
                {selectedOfficeIds.length > 0 &&
                  `(${selectedOfficeIds.length} selected)`}
              </FormLabel>
              <FormGroup sx={{ maxHeight: 150, overflow: 'auto' }}>
                {offices.map(office => (
                  <FormControlLabel
                    key={office.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedOfficeIds.includes(office.id)}
                        onChange={() => handleOfficeToggle(office.id)}
                        disabled={isExporting}
                      />
                    }
                    label={office.name}
                  />
                ))}
              </FormGroup>
              {selectedOfficeIds.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No filter: export all offices
                </Typography>
              )}
            </FormControl>
          )}

          {/* Category Filter */}
          {flatCategories.length > 0 && (
            <FormControl component="fieldset">
              <FormLabel component="legend">
                Categories{' '}
                {selectedCategoryIds.length > 0 &&
                  `(${selectedCategoryIds.length} selected)`}
              </FormLabel>
              <FormGroup sx={{ maxHeight: 200, overflow: 'auto' }}>
                {flatCategories.map(cat => (
                  <FormControlLabel
                    key={cat.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedCategoryIds.includes(cat.id)}
                        onChange={() => handleCategoryToggle(cat.id)}
                        disabled={isExporting}
                      />
                    }
                    label={cat.name}
                    sx={{ pl: cat.depth * 2 }}
                  />
                ))}
              </FormGroup>
              {selectedCategoryIds.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No filter: export all categories (selecting a parent includes
                  children)
                </Typography>
              )}
            </FormControl>
          )}

          {/* Tag Filter */}
          {tags.length > 0 && (
            <FormControl component="fieldset">
              <FormLabel component="legend">
                Tags{' '}
                {selectedTagIds.length > 0 &&
                  `(${selectedTagIds.length} selected)`}
              </FormLabel>
              <FormGroup sx={{ maxHeight: 150, overflow: 'auto' }}>
                {tags.map(tag => (
                  <FormControlLabel
                    key={tag.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={() => handleTagToggle(tag.id)}
                        disabled={isExporting}
                      />
                    }
                    label={tag.name}
                  />
                ))}
              </FormGroup>
              {selectedTagIds.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No filter: export all tags
                </Typography>
              )}
            </FormControl>
          )}

          {/* Estimated Row Count */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">
              Estimated rows:{' '}
              {isLoadingCount ? (
                <CircularProgress size={14} sx={{ ml: 1 }} />
              ) : estimatedRows !== null ? (
                <strong>~{estimatedRows.toLocaleString()}</strong>
              ) : (
                'calculating...'
              )}
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
          disabled={isExporting || estimatedRows === 0}
          startIcon={
            isExporting ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DownloadIcon />
            )
          }
        >
          {isExporting ? 'Exporting...' : 'Export XLSX'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
