/**
 * Price Guide Catalog Page.
 * Displays a searchable, filterable list of Measure Sheet Items.
 */

import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import InventoryIcon from '@mui/icons-material/Inventory';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { flattenCategoryTree } from '@shared/utils';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  BulkActionsToolbar,
  BulkDeleteDialog,
  BulkEditDialog,
  ExportDialog,
  ImportDialog,
} from '../../components/price-guide';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOfficesList } from '../../hooks/useOffices';
import { useMsiList, useCategoryTree } from '../../hooks/usePriceGuide';

import type {
  ExportOptions,
  ImportResult,
  BulkDeleteResult,
  BulkEditOptions,
  BulkEditResult,
} from '../../components/price-guide';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { MeasureSheetItemSummary } from '@shared/types';

// ============================================================================
// MSI Card Component
// ============================================================================

type MsiCardProps = {
  msi: MeasureSheetItemSummary;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onView: (msiId: string) => void;
  onEdit: (msiId: string) => void;
  onPricing: (msiId: string) => void;
};

function MsiCard({
  msi,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onView,
  onEdit,
  onPricing,
}: MsiCardProps): React.ReactElement {
  return (
    <Card
      sx={{
        mb: 1,
        bgcolor: isSelected ? 'action.selected' : undefined,
        '&:hover': { bgcolor: isSelected ? 'action.selected' : 'action.hover' },
        transition: 'background-color 0.2s',
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        {/* Main Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Checkbox */}
          <Checkbox
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            size="small"
          />

          {/* Expand Icon */}
          <IconButton size="small" onClick={onToggleExpand}>
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>

          {/* Name & Category - Clickable */}
          <Box
            sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
            onClick={() => onView(msi.id)}
          >
            <Typography variant="subtitle1" noWrap fontWeight={500}>
              {msi.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {msi.category.fullPath}
            </Typography>
          </Box>

          {/* Measurement Type */}
          <Chip
            label={msi.measurementType}
            size="small"
            variant="outlined"
            sx={{ minWidth: 80 }}
          />

          {/* Counts */}
          <Stack direction="row" spacing={1} sx={{ minWidth: 150 }}>
            <Chip
              label={`${msi.optionCount} opt`}
              size="small"
              color={msi.optionCount > 0 ? 'primary' : 'default'}
              variant={msi.optionCount > 0 ? 'filled' : 'outlined'}
            />
            <Chip
              label={`${msi.upchargeCount} uc`}
              size="small"
              color={msi.upchargeCount > 0 ? 'secondary' : 'default'}
              variant={msi.upchargeCount > 0 ? 'filled' : 'outlined'}
            />
          </Stack>

          {/* Office Count */}
          <Chip
            label={`${msi.officeCount} office${msi.officeCount !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            sx={{ minWidth: 80 }}
          />
        </Box>

        {/* Expanded Content */}
        <Collapse in={isExpanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                onClick={() => onView(msi.id)}
              >
                View Details
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onEdit(msi.id)}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => onPricing(msi.id)}
              >
                Pricing
              </Button>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 'auto' }}
              >
                ID: {msi.id}
              </Typography>
            </Stack>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function MsiCardSkeleton(): React.ReactElement {
  return (
    <Card sx={{ mb: 1 }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={80} height={24} />
        </Box>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CatalogPage(): React.ReactElement {
  const navigate = useNavigate();

  // State
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [officeId, setOfficeId] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);

  // Debounced search
  const debouncedSearch = useDebouncedValue(search, 300);

  // Refs for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: categoryData } = useCategoryTree();
  const { data: officesData } = useOfficesList();

  const {
    data: msiData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useMsiList({
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    officeId: officeId || undefined,
    limit: 20,
  });

  // Flatten categories for dropdown
  const flatCategories = useMemo(() => {
    if (!categoryData?.categories) return [];
    return flattenCategoryTree(categoryData.categories);
  }, [categoryData]);

  // All MSIs from infinite query pages
  const allMsis = useMemo(() => {
    if (!msiData?.pages) return [];
    return msiData.pages.flatMap(page => page.items);
  }, [msiData]);

  // Total count
  const totalCount = msiData?.pages[0]?.total ?? 0;

  // Toggle expanded
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearch('');
    setCategoryId('');
    setOfficeId('');
  }, []);

  const hasFilters = search || categoryId || officeId;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const el = loadMoreRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) {
        observer.unobserve(el);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleCategoryChange = (e: SelectChangeEvent) => {
    setCategoryId(e.target.value);
  };

  const handleOfficeChange = (e: SelectChangeEvent) => {
    setOfficeId(e.target.value);
  };

  const handleView = useCallback(
    (msiId: string) => {
      void navigate(`/price-guide/${msiId}`);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (msiId: string) => {
      void navigate(`/price-guide/${msiId}/edit`);
    },
    [navigate],
  );

  const handlePricing = useCallback(
    (msiId: string) => {
      void navigate(`/price-guide/${msiId}/pricing`);
    },
    [navigate],
  );

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allMsis.map(msi => msi.id)));
  }, [allMsis]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk operation handlers
  const handleBulkExport = useCallback(
    async (options: ExportOptions): Promise<void> => {
      // TODO: Implement actual export logic
      console.log('Export options:', options);
      console.log('Selected IDs:', Array.from(selectedIds));
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    [selectedIds],
  );

  const handleBulkImport = useCallback(
    async (file: File): Promise<ImportResult> => {
      // TODO: Implement actual import logic
      console.log('Importing file:', file.name);
      // Simulate import delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
        success: true,
        imported: 10,
        skipped: 2,
        errors: [],
        warnings: [],
      };
    },
    [],
  );

  const handleBulkDelete = useCallback(
    async (ids: string[]): Promise<BulkDeleteResult> => {
      // TODO: Implement actual bulk delete logic
      console.log('Deleting IDs:', ids);
      // Simulate delete delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      deselectAll();
      return {
        deleted: ids.length,
        failed: 0,
        errors: [],
      };
    },
    [deselectAll],
  );

  const handleBulkEdit = useCallback(
    async (options: BulkEditOptions): Promise<BulkEditResult> => {
      // TODO: Implement actual bulk edit logic
      console.log('Bulk edit options:', options);
      console.log('Selected IDs:', Array.from(selectedIds));
      // Simulate edit delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      deselectAll();
      return {
        updated: selectedIds.size,
        failed: 0,
        errors: [],
      };
    },
    [selectedIds, deselectAll],
  );

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
          <InventoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" component="h1">
              Price Guide Catalog
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage measure sheet items, options, and pricing
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setImportDialogOpen(true)}
          >
            Import
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
          >
            Export
          </Button>
          <Button variant="contained" startIcon={<AddIcon />}>
            New Item
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {/* Search */}
            <TextField
              placeholder="Search items..."
              value={search}
              onChange={handleSearchChange}
              size="small"
              sx={{ flex: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Category Filter */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>
                <CategoryIcon
                  sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }}
                />
                Category
              </InputLabel>
              <Select
                value={categoryId}
                onChange={handleCategoryChange}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {flatCategories.map(cat => (
                  <MenuItem
                    key={cat.id}
                    value={cat.id}
                    sx={{ pl: 2 + cat.depth * 2 }}
                  >
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Office Filter */}
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Office</InputLabel>
              <Select
                value={officeId}
                onChange={handleOfficeChange}
                label="Office"
              >
                <MenuItem value="">All Offices</MenuItem>
                {officesData?.offices.map(office => (
                  <MenuItem key={office.id} value={office.id}>
                    {office.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Clear Filters */}
            {hasFilters && (
              <Button
                variant="text"
                startIcon={<FilterListIcon />}
                onClick={clearFilters}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Clear Filters
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Results Count */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {isLoading ? (
            <Skeleton width={100} />
          ) : (
            <>
              {totalCount} item{totalCount !== 1 ? 's' : ''}
              {hasFilters && ' (filtered)'}
            </>
          )}
        </Typography>
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load items. Please try again.
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box>
          {[...Array(5)].map((_, i) => (
            <MsiCardSkeleton key={i} />
          ))}
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && allMsis.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <InventoryIcon
              sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }}
            />
            <Typography variant="h3" color="text.secondary" gutterBottom>
              No items found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {hasFilters
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by creating your first measure sheet item.'}
            </Typography>
            {!hasFilters && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mt: 3 }}
              >
                Create First Item
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* MSI List */}
      {!isLoading && allMsis.length > 0 && (
        <Box>
          {allMsis.map(msi => (
            <MsiCard
              key={msi.id}
              msi={msi}
              isExpanded={expandedIds.has(msi.id)}
              isSelected={selectedIds.has(msi.id)}
              onToggleExpand={() => toggleExpanded(msi.id)}
              onToggleSelect={() => toggleSelect(msi.id)}
              onView={handleView}
              onEdit={handleEdit}
              onPricing={handlePricing}
            />
          ))}

          {/* Load More Trigger */}
          <Box
            ref={loadMoreRef}
            sx={{
              height: 50,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isFetchingNextPage && <CircularProgress size={24} />}
            {!hasNextPage && allMsis.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                End of list
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        totalCount={allMsis.length}
        allSelected={
          selectedIds.size > 0 && selectedIds.size === allMsis.length
        }
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onBulkEdit={() => setBulkEditDialogOpen(true)}
        onExport={() => setExportDialogOpen(true)}
        onBulkDelete={() => setBulkDeleteDialogOpen(true)}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        selectedIds={Array.from(selectedIds)}
        totalCount={totalCount}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleBulkExport}
      />

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleBulkImport}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={bulkDeleteDialogOpen}
        selectedIds={Array.from(selectedIds)}
        onClose={() => setBulkDeleteDialogOpen(false)}
        onDelete={handleBulkDelete}
      />

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={bulkEditDialogOpen}
        selectedIds={Array.from(selectedIds)}
        onClose={() => setBulkEditDialogOpen(false)}
        onUpdate={handleBulkEdit}
      />
    </Box>
  );
}
