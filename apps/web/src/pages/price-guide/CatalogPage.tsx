/**
 * Price Guide Catalog Page.
 * Displays a searchable, filterable list of Measure Sheet Items.
 */

import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import FilterListIcon from '@mui/icons-material/FilterList';
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { flattenCategoryTree } from '@shared/utils';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  BulkActionsToolbar,
  BulkDeleteDialog,
  BulkEditDialog,
  CountBadge,
  EntityCard,
  EntityCardSkeleton,
  ExportDialog,
  ImportDialog,
  LinkPicker,
  LinkedItemsList,
  UnlinkConfirmation,
} from '../../components/price-guide';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOfficesList } from '../../hooks/useOffices';
import {
  useMsiList,
  useMsiDetail,
  useCategoryTree,
  useOptionList,
  useUpchargeList,
  useLinkOptions,
  useLinkUpcharges,
  useUnlinkOption,
  useUnlinkUpcharge,
} from '../../hooks/usePriceGuide';

import type {
  ExportOptions,
  ImportResult,
  BulkDeleteResult,
  BulkEditOptions,
  BulkEditResult,
  LinkableItem,
  MenuAction,
} from '../../components/price-guide';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { MeasureSheetItemSummary } from '@shared/types';

// ============================================================================
// MSI Expanded Content Component
// ============================================================================

type MsiExpandedContentProps = {
  msiId: string;
  onView: () => void;
  onEdit: () => void;
  onPricing: () => void;
  onLinkOptions: () => void;
  onLinkUpcharges: () => void;
  onUnlinkOption: (optionId: string, optionName: string) => void;
  onUnlinkUpcharge: (upchargeId: string, upchargeName: string) => void;
};

function MsiExpandedContent({
  msiId,
  onView,
  onEdit,
  onPricing,
  onLinkOptions,
  onLinkUpcharges,
  onUnlinkOption,
  onUnlinkUpcharge,
}: MsiExpandedContentProps): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading } = useMsiDetail(msiId);

  const options = data?.item.options ?? [];
  const upcharges = data?.item.upcharges ?? [];
  const additionalDetails = data?.item.additionalDetails ?? [];

  return (
    <Box>
      {/* Linked Items */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        <LinkedItemsList
          title="Options"
          itemType="option"
          items={options}
          isLoading={isLoading}
          onLinkClick={onLinkOptions}
          onViewItem={optionId =>
            void navigate(`/price-guide/library/options/${optionId}`)
          }
          onUnlinkItem={optionId => {
            const option = options.find(o => o.optionId === optionId);
            if (option) {
              onUnlinkOption(optionId, option.name);
            }
          }}
        />
        <LinkedItemsList
          title="UpCharges"
          itemType="upcharge"
          items={upcharges}
          isLoading={isLoading}
          onLinkClick={onLinkUpcharges}
          onViewItem={upchargeId =>
            void navigate(`/price-guide/library/upcharges/${upchargeId}`)
          }
          onUnlinkItem={upchargeId => {
            const upcharge = upcharges.find(u => u.upchargeId === upchargeId);
            if (upcharge) {
              onUnlinkUpcharge(upchargeId, upcharge.name);
            }
          }}
        />
        <LinkedItemsList
          title="Additional Details"
          itemType="additionalDetail"
          items={additionalDetails}
          isLoading={isLoading}
          canLink={false}
        />
      </Box>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          size="small"
          variant="outlined"
          startIcon={<VisibilityIcon />}
          onClick={onView}
        >
          View Details
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<LocalOfferIcon />}
          onClick={onPricing}
        >
          Pricing
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 'auto' }}
        >
          ID: {msiId}
        </Typography>
      </Stack>
    </Box>
  );
}

// ============================================================================
// MSI Card Wrapper Component
// ============================================================================

type MsiCardWrapperProps = {
  msi: MeasureSheetItemSummary;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onView: () => void;
  onEdit: () => void;
  onPricing: () => void;
  onDelete: () => void;
  onLinkOptions: () => void;
  onLinkUpcharges: () => void;
  onUnlinkOption: (optionId: string, optionName: string) => void;
  onUnlinkUpcharge: (upchargeId: string, upchargeName: string) => void;
};

function MsiCardWrapper({
  msi,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onView,
  onEdit,
  onPricing,
  onDelete,
  onLinkOptions,
  onLinkUpcharges,
  onUnlinkOption,
  onUnlinkUpcharge,
}: MsiCardWrapperProps): React.ReactElement {
  const menuActions: MenuAction[] = [
    {
      label: 'View Details',
      onClick: onView,
      icon: <VisibilityIcon fontSize="small" />,
    },
    {
      label: 'Edit',
      onClick: onEdit,
      icon: <EditIcon fontSize="small" />,
    },
    {
      label: 'Pricing',
      onClick: onPricing,
      icon: <LocalOfferIcon fontSize="small" />,
    },
    {
      label: 'Delete',
      onClick: onDelete,
      icon: <DeleteIcon fontSize="small" />,
      dividerBefore: true,
      color: 'error',
    },
  ];

  const badges = (
    <>
      <Tooltip title={msi.measurementType}>
        <Chip
          label={msi.measurementType}
          size="small"
          variant="outlined"
          sx={{ minWidth: 70 }}
        />
      </Tooltip>
      <CountBadge count={msi.optionCount} variant="option" />
      <CountBadge count={msi.upchargeCount} variant="upcharge" />
      <CountBadge count={msi.officeCount} variant="office" />
    </>
  );

  return (
    <EntityCard
      entityType="msi"
      name={msi.name}
      subtitle={msi.category.fullPath}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onClick={onView}
      badges={badges}
      menuActions={menuActions}
      expandedContent={
        <MsiExpandedContent
          msiId={msi.id}
          onView={onView}
          onEdit={onEdit}
          onPricing={onPricing}
          onLinkOptions={onLinkOptions}
          onLinkUpcharges={onLinkUpcharges}
          onUnlinkOption={onUnlinkOption}
          onUnlinkUpcharge={onUnlinkUpcharge}
        />
      }
    />
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

  // Link picker state
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkPickerType, setLinkPickerType] = useState<'option' | 'upcharge'>(
    'option',
  );
  const [linkPickerMsiId, setLinkPickerMsiId] = useState<string>('');
  const [linkPickerSearch, setLinkPickerSearch] = useState('');

  // Unlink confirmation state
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkItem, setUnlinkItem] = useState<{
    type: 'option' | 'upcharge';
    msiId: string;
    msiName: string;
    itemId: string;
    itemName: string;
  } | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedLinkPickerSearch = useDebouncedValue(linkPickerSearch, 300);

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

  // Options list for link picker
  const {
    data: optionsData,
    isLoading: isLoadingOptions,
    hasNextPage: hasMoreOptions,
    fetchNextPage: fetchMoreOptions,
    isFetchingNextPage: isFetchingMoreOptions,
  } = useOptionList({
    search: debouncedLinkPickerSearch || undefined,
    limit: 20,
  });

  // UpCharges list for link picker
  const {
    data: upchargesData,
    isLoading: isLoadingUpcharges,
    hasNextPage: hasMoreUpcharges,
    fetchNextPage: fetchMoreUpcharges,
    isFetchingNextPage: isFetchingMoreUpcharges,
  } = useUpchargeList({
    search: debouncedLinkPickerSearch || undefined,
    limit: 20,
  });

  // Mutations
  const linkOptionsMutation = useLinkOptions();
  const linkUpchargesMutation = useLinkUpcharges();
  const unlinkOptionMutation = useUnlinkOption();
  const unlinkUpchargeMutation = useUnlinkUpcharge();

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

  // Link picker items
  const linkPickerItems: LinkableItem[] = useMemo(() => {
    if (linkPickerType === 'option') {
      if (!optionsData?.pages) return [];
      return optionsData.pages.flatMap(page =>
        page.items.map(item => ({
          id: item.id,
          name: item.name,
          subtitle: item.brand,
          usageCount: item.linkedMsiCount,
        })),
      );
    } else {
      if (!upchargesData?.pages) return [];
      return upchargesData.pages.flatMap(page =>
        page.items.map(item => ({
          id: item.id,
          name: item.name,
          subtitle: item.note,
          usageCount: item.linkedMsiCount,
        })),
      );
    }
  }, [linkPickerType, optionsData, upchargesData]);

  // Get current MSI for determining already linked items
  const { data: currentMsiData } = useMsiDetail(linkPickerMsiId);
  const alreadyLinkedIds = useMemo(() => {
    if (!currentMsiData?.item) return [];
    if (linkPickerType === 'option') {
      return currentMsiData.item.options.map(o => o.optionId);
    }
    return currentMsiData.item.upcharges.map(u => u.upchargeId);
  }, [currentMsiData, linkPickerType]);

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

  const handleDelete = useCallback((msiId: string) => {
    // TODO: Implement delete dialog
    console.log('Delete MSI:', msiId);
  }, []);

  // Link picker handlers
  const openLinkPicker = useCallback(
    (type: 'option' | 'upcharge', msiId: string) => {
      setLinkPickerType(type);
      setLinkPickerMsiId(msiId);
      setLinkPickerSearch('');
      setLinkPickerOpen(true);
    },
    [],
  );

  const handleLink = useCallback(
    async (itemIds: string[]) => {
      try {
        if (linkPickerType === 'option') {
          await linkOptionsMutation.mutateAsync({
            msiId: linkPickerMsiId,
            optionIds: itemIds,
          });
        } else {
          await linkUpchargesMutation.mutateAsync({
            msiId: linkPickerMsiId,
            upchargeIds: itemIds,
          });
        }
        setLinkPickerOpen(false);
      } catch (err) {
        console.error('Failed to link items:', err);
      }
    },
    [
      linkPickerType,
      linkPickerMsiId,
      linkOptionsMutation,
      linkUpchargesMutation,
    ],
  );

  // Unlink handlers
  const openUnlinkDialog = useCallback(
    (
      type: 'option' | 'upcharge',
      msiId: string,
      msiName: string,
      itemId: string,
      itemName: string,
    ) => {
      setUnlinkItem({ type, msiId, msiName, itemId, itemName });
      setUnlinkDialogOpen(true);
    },
    [],
  );

  const handleUnlink = useCallback(async () => {
    if (!unlinkItem) return;
    try {
      if (unlinkItem.type === 'option') {
        await unlinkOptionMutation.mutateAsync({
          msiId: unlinkItem.msiId,
          optionId: unlinkItem.itemId,
        });
      } else {
        await unlinkUpchargeMutation.mutateAsync({
          msiId: unlinkItem.msiId,
          upchargeId: unlinkItem.itemId,
        });
      }
      setUnlinkDialogOpen(false);
      setUnlinkItem(null);
    } catch (err) {
      console.error('Failed to unlink item:', err);
    }
  }, [unlinkItem, unlinkOptionMutation, unlinkUpchargeMutation]);

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
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    [selectedIds],
  );

  const handleBulkImport = useCallback(
    async (file: File): Promise<ImportResult> => {
      // TODO: Implement actual import logic
      console.log('Importing file:', file.name);
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => void navigate('/price-guide/create')}
          >
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
            <EntityCardSkeleton key={i} badgeCount={4} />
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
                onClick={() => void navigate('/price-guide/create')}
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
            <MsiCardWrapper
              key={msi.id}
              msi={msi}
              isExpanded={expandedIds.has(msi.id)}
              isSelected={selectedIds.has(msi.id)}
              onToggleExpand={() => toggleExpanded(msi.id)}
              onToggleSelect={() => toggleSelect(msi.id)}
              onView={() => handleView(msi.id)}
              onEdit={() => handleEdit(msi.id)}
              onPricing={() => handlePricing(msi.id)}
              onDelete={() => handleDelete(msi.id)}
              onLinkOptions={() => openLinkPicker('option', msi.id)}
              onLinkUpcharges={() => openLinkPicker('upcharge', msi.id)}
              onUnlinkOption={(optionId, optionName) =>
                openUnlinkDialog(
                  'option',
                  msi.id,
                  msi.name,
                  optionId,
                  optionName,
                )
              }
              onUnlinkUpcharge={(upchargeId, upchargeName) =>
                openUnlinkDialog(
                  'upcharge',
                  msi.id,
                  msi.name,
                  upchargeId,
                  upchargeName,
                )
              }
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

      {/* Link Picker Dialog */}
      <LinkPicker
        open={linkPickerOpen}
        itemType={linkPickerType}
        items={linkPickerItems}
        alreadyLinkedIds={alreadyLinkedIds}
        isLoading={
          linkPickerType === 'option' ? isLoadingOptions : isLoadingUpcharges
        }
        hasMore={
          linkPickerType === 'option' ? hasMoreOptions : hasMoreUpcharges
        }
        onLoadMore={() => {
          void (linkPickerType === 'option'
            ? fetchMoreOptions()
            : fetchMoreUpcharges());
        }}
        isLoadingMore={
          linkPickerType === 'option'
            ? isFetchingMoreOptions
            : isFetchingMoreUpcharges
        }
        onSearch={setLinkPickerSearch}
        onClose={() => setLinkPickerOpen(false)}
        onLink={itemIds => void handleLink(itemIds)}
        isLinking={
          linkOptionsMutation.isPending || linkUpchargesMutation.isPending
        }
      />

      {/* Unlink Confirmation Dialog */}
      <UnlinkConfirmation
        open={unlinkDialogOpen}
        itemName={unlinkItem?.itemName ?? ''}
        itemType={unlinkItem?.type ?? 'option'}
        msiName={unlinkItem?.msiName ?? ''}
        onCancel={() => {
          setUnlinkDialogOpen(false);
          setUnlinkItem(null);
        }}
        onConfirm={() => void handleUnlink()}
        isLoading={
          unlinkOptionMutation.isPending || unlinkUpchargeMutation.isPending
        }
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
