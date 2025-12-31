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
import Typography from '@mui/material/Typography';
import { flattenCategoryTree } from '@shared/utils';
import { useQueryClient } from '@tanstack/react-query';
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
  ImagePicker,
  ImportDialog,
  LinkPicker,
  LinkedItemsList,
  TagChip,
  TagFilterSelect,
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
  useSyncOffices,
  useUnlinkOption,
  useUnlinkUpcharge,
  priceGuideKeys,
} from '../../hooks/usePriceGuide';
import { useTagList } from '../../hooks/useTags';
import { priceGuideApi } from '../../services/price-guide';

import type {
  ExportOptions,
  ImportResult,
  BulkDeleteResult,
  BulkEditOptions,
  BulkEditResult,
  LinkableItem,
  MenuAction,
  SelectedImageData,
} from '../../components/price-guide';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { MeasureSheetItemSummary } from '@shared/types';

// ============================================================================
// MSI Expanded Content Component
// ============================================================================

type MsiExpandedContentProps = {
  msiId: string;
  onLinkOffices: () => void;
  onLinkOptions: () => void;
  onLinkUpcharges: () => void;
  onUnlinkOffice: (officeId: string, officeName: string) => void;
  onUnlinkOption: (optionId: string, optionName: string) => void;
  onUnlinkUpcharge: (upchargeId: string, upchargeName: string) => void;
};

function MsiExpandedContent({
  msiId,
  onLinkOffices,
  onLinkOptions,
  onLinkUpcharges,
  onUnlinkOffice,
  onUnlinkOption,
  onUnlinkUpcharge,
}: MsiExpandedContentProps): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading } = useMsiDetail(msiId);

  const offices = data?.item.offices ?? [];
  const options = data?.item.options ?? [];
  const upcharges = data?.item.upcharges ?? [];

  return (
    <Box>
      {/* Linked Items Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
          gap: 3,
        }}
      >
        <LinkedItemsList
          title="Offices"
          itemType="office"
          items={offices}
          isLoading={isLoading}
          onLinkClick={onLinkOffices}
          onUnlinkItem={officeId => {
            const office = offices.find(o => o.id === officeId);
            if (office) {
              onUnlinkOffice(officeId, office.name);
            }
          }}
        />
        <LinkedItemsList
          title="Options"
          itemType="option"
          items={options}
          isLoading={isLoading}
          onLinkClick={onLinkOptions}
          onViewItem={() => void navigate('/price-guide/library?tab=options')}
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
          onViewItem={() => void navigate('/price-guide/library?tab=upcharges')}
          onUnlinkItem={upchargeId => {
            const upcharge = upcharges.find(u => u.upchargeId === upchargeId);
            if (upcharge) {
              onUnlinkUpcharge(upchargeId, upcharge.name);
            }
          }}
        />
      </Box>

      {/* Footer with ID */}
      <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.disabled">
          ID: {msiId}
        </Typography>
      </Box>
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
  onLinkOffices: () => void;
  onLinkOptions: () => void;
  onLinkUpcharges: () => void;
  onUnlinkOffice: (officeId: string, officeName: string) => void;
  onUnlinkOption: (optionId: string, optionName: string) => void;
  onUnlinkUpcharge: (upchargeId: string, upchargeName: string) => void;
  onThumbnailClick: () => void;
  isThumbnailLoading: boolean;
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
  onLinkOffices,
  onLinkOptions,
  onLinkUpcharges,
  onUnlinkOffice,
  onUnlinkOption,
  onUnlinkUpcharge,
  onThumbnailClick,
  isThumbnailLoading,
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
      <CountBadge
        count={msi.officeCount}
        variant="office"
        items={msi.officeNames}
      />
      <CountBadge
        count={msi.optionCount}
        variant="option"
        items={msi.optionNames}
      />
      <CountBadge
        count={msi.upchargeCount}
        variant="upcharge"
        items={msi.upchargeNames}
      />
      {msi.tags && msi.tags.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: 1 }}>
          {msi.tags.slice(0, 3).map(tag => (
            <TagChip key={tag.id} tag={tag} size="small" />
          ))}
          {msi.tags.length > 3 && (
            <Chip
              label={`+${msi.tags.length - 3}`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      )}
    </>
  );

  // Use the thumbnail image (if set)
  const thumbnailUrl =
    msi.thumbnailImage?.thumbnailUrl ?? msi.thumbnailImage?.imageUrl ?? null;

  return (
    <EntityCard
      entityType="msi"
      name={msi.name}
      subtitle={msi.category.fullPath}
      thumbnailUrl={thumbnailUrl}
      onThumbnailClick={onThumbnailClick}
      isThumbnailLoading={isThumbnailLoading}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      showCheckbox={false}
      onClick={onView}
      badges={badges}
      menuActions={menuActions}
      expandedContent={
        <MsiExpandedContent
          msiId={msi.id}
          onLinkOffices={onLinkOffices}
          onLinkOptions={onLinkOptions}
          onLinkUpcharges={onLinkUpcharges}
          onUnlinkOffice={onUnlinkOffice}
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
  const queryClient = useQueryClient();

  // State
  const [search, setSearch] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [officeIds, setOfficeIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);

  // Link picker state
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkPickerType, setLinkPickerType] = useState<
    'office' | 'option' | 'upcharge' | 'additionalDetail'
  >('option');
  const [linkPickerMsiId, setLinkPickerMsiId] = useState<string>('');
  const [linkPickerSearch, setLinkPickerSearch] = useState('');
  const [linkPickerTagIds, setLinkPickerTagIds] = useState<string[]>([]);

  // Unlink confirmation state
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkItem, setUnlinkItem] = useState<{
    type: 'office' | 'option' | 'upcharge';
    msiId: string;
    msiName: string;
    itemId: string;
    itemName: string;
  } | null>(null);

  // Thumbnail upload state
  // Image picker state for thumbnail selection
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerMsiId, setImagePickerMsiId] = useState<string | null>(null);
  const [imagePickerSaving, setImagePickerSaving] = useState(false);

  // Debounced search
  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedLinkPickerSearch = useDebouncedValue(linkPickerSearch, 300);

  // Refs for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: categoryData } = useCategoryTree();
  const { data: officesData } = useOfficesList();
  const { data: tagsData } = useTagList();

  const {
    data: msiData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useMsiList({
    search: debouncedSearch || undefined,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    officeIds: officeIds.length > 0 ? officeIds : undefined,
    tags: tagIds.length > 0 ? tagIds : undefined,
    limit: 20,
  });

  // Options list for link picker (with tag filtering)
  const {
    data: optionsData,
    isLoading: isLoadingOptions,
    hasNextPage: hasMoreOptions,
    fetchNextPage: fetchMoreOptions,
    isFetchingNextPage: isFetchingMoreOptions,
  } = useOptionList({
    search: debouncedLinkPickerSearch || undefined,
    tags: linkPickerTagIds.length > 0 ? linkPickerTagIds : undefined,
    limit: 20,
  });

  // UpCharges list for link picker (with tag filtering)
  const {
    data: upchargesData,
    isLoading: isLoadingUpcharges,
    hasNextPage: hasMoreUpcharges,
    fetchNextPage: fetchMoreUpcharges,
    isFetchingNextPage: isFetchingMoreUpcharges,
  } = useUpchargeList({
    search: debouncedLinkPickerSearch || undefined,
    tags: linkPickerTagIds.length > 0 ? linkPickerTagIds : undefined,
    limit: 20,
  });

  // Mutations
  const linkOptionsMutation = useLinkOptions();
  const linkUpchargesMutation = useLinkUpcharges();
  const syncOfficesMutation = useSyncOffices();
  const unlinkOptionMutation = useUnlinkOption();
  const unlinkUpchargeMutation = useUnlinkUpcharge();

  // Flatten categories for dropdown
  const flatCategories = useMemo(() => {
    if (!categoryData?.categories) return [];
    return flattenCategoryTree(categoryData.categories);
  }, [categoryData]);

  // Get selected categories for chip display
  const selectedCategories = useMemo(() => {
    if (categoryIds.length === 0) return [];
    return categoryIds
      .map(id => flatCategories.find(cat => cat.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
  }, [categoryIds, flatCategories]);

  // Get selected offices for chip display
  const selectedOffices = useMemo(() => {
    if (officeIds.length === 0 || !officesData?.offices) return [];
    return officeIds
      .map(id => officesData.offices.find(o => o.id === id))
      .filter((o): o is NonNullable<typeof o> => o !== undefined);
  }, [officeIds, officesData]);

  // Get selected tags for chip display
  const selectedTags = useMemo(() => {
    if (tagIds.length === 0 || !tagsData?.tags) return [];
    return tagIds
      .map(id => tagsData.tags.find(t => t.id === id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined);
  }, [tagIds, tagsData]);

  // All MSIs from infinite query pages
  const allMsis = useMemo(() => {
    if (!msiData?.pages) return [];
    return msiData.pages.flatMap(page => page.items);
  }, [msiData]);

  // Total count
  const totalCount = msiData?.pages[0]?.total ?? 0;

  // Link picker items
  const linkPickerItems: LinkableItem[] = useMemo(() => {
    if (linkPickerType === 'office') {
      if (!officesData?.offices) return [];
      return officesData.offices.map(office => ({
        id: office.id,
        name: office.name,
        subtitle: null,
        usageCount: 0, // Offices don't have usage counts in this context
      }));
    } else if (linkPickerType === 'option') {
      if (!optionsData?.pages) return [];
      return optionsData.pages.flatMap(page =>
        page.items.map(item => ({
          id: item.id,
          name: item.name,
          subtitle: item.brand,
          usageCount: item.linkedMsiCount,
        })),
      );
    } else if (linkPickerType === 'upcharge') {
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
    return [];
  }, [linkPickerType, officesData, optionsData, upchargesData]);

  // Get current MSI for determining already linked items (for LinkPicker)
  const { data: currentMsiData } = useMsiDetail(linkPickerMsiId);

  // Get MSI detail for image picker (to get version for sync)
  const { data: imagePickerMsiData } = useMsiDetail(imagePickerMsiId ?? '');
  const alreadyLinkedIds = useMemo(() => {
    if (!currentMsiData?.item) return [];
    if (linkPickerType === 'office') {
      return currentMsiData.item.offices.map(o => o.id);
    } else if (linkPickerType === 'option') {
      return currentMsiData.item.options.map(o => o.optionId);
    } else if (linkPickerType === 'upcharge') {
      return currentMsiData.item.upcharges.map(u => u.upchargeId);
    }
    return [];
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
    setCategoryIds([]);
    setOfficeIds([]);
    setTagIds([]);
  }, []);

  const hasFilters =
    search ||
    categoryIds.length > 0 ||
    officeIds.length > 0 ||
    tagIds.length > 0;

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

  const handleCategoryChange = (e: SelectChangeEvent<string[]>) => {
    const value = e.target.value;
    // Handle both string and array (MUI Select can return either)
    setCategoryIds(typeof value === 'string' ? value.split(',') : value);
  };

  const handleOfficeChange = (e: SelectChangeEvent<string[]>) => {
    const value = e.target.value;
    // Handle both string and array (MUI Select can return either)
    setOfficeIds(typeof value === 'string' ? value.split(',') : value);
  };

  const handleView = useCallback(
    (msiId: string) => {
      void navigate(`/price-guide/${msiId}`);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (msiId: string) => {
      void navigate(`/price-guide/${msiId}`);
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

  // Image picker handlers for thumbnail/images selection
  const handleThumbnailClick = useCallback((msiId: string) => {
    setImagePickerMsiId(msiId);
    setImagePickerOpen(true);
  }, []);

  const handleImagePickerClose = useCallback(() => {
    setImagePickerOpen(false);
    setImagePickerMsiId(null);
  }, []);

  // Get current MSI's selected thumbnail image ID for the picker
  const currentMsiSelectedImageIds = useMemo(() => {
    if (!imagePickerMsiId) return [];
    const msi = allMsis.find(m => m.id === imagePickerMsiId);
    return msi?.thumbnailImage ? [msi.thumbnailImage.id] : [];
  }, [imagePickerMsiId, allMsis]);

  const handleImageSelectionChange = useCallback(
    async (imageIds: string[], _images: SelectedImageData[]) => {
      if (!imagePickerMsiId || !imagePickerMsiData?.item) return;

      setImagePickerSaving(true);
      try {
        // Set thumbnail image for MSI (single image, or null to clear)
        const imageId = imageIds.length > 0 ? imageIds[0]! : null;
        await priceGuideApi.setMsiThumbnail(
          imagePickerMsiId,
          imageId,
          imagePickerMsiData.item.version,
        );

        // Invalidate MSI list to refresh thumbnail
        void queryClient.invalidateQueries({
          queryKey: ['price-guide', 'msis', 'list'],
        });

        // Also invalidate the MSI detail to refresh for next edit
        void queryClient.invalidateQueries({
          queryKey: ['price-guide', 'msis', 'detail', imagePickerMsiId],
        });

        // Invalidate image lists to update linkedMsiCount in library
        void queryClient.invalidateQueries({
          queryKey: priceGuideKeys.imageLists(),
        });

        // Close picker
        setImagePickerOpen(false);
        setImagePickerMsiId(null);
      } catch (err) {
        console.error('Failed to set thumbnail:', err);
      } finally {
        setImagePickerSaving(false);
      }
    },
    [imagePickerMsiId, imagePickerMsiData, queryClient],
  );

  // Link picker handlers
  const openLinkPicker = useCallback(
    (type: 'office' | 'option' | 'upcharge', msiId: string) => {
      setLinkPickerType(type);
      setLinkPickerMsiId(msiId);
      setLinkPickerSearch('');
      setLinkPickerTagIds([]);
      setLinkPickerOpen(true);
    },
    [],
  );

  const handleLink = useCallback(
    async (itemIds: string[]) => {
      try {
        if (linkPickerType === 'office') {
          // For offices, we need to sync ALL selected offices (existing + new)
          const existingOfficeIds =
            currentMsiData?.item.offices.map(o => o.id) ?? [];
          const allOfficeIds = [...new Set([...existingOfficeIds, ...itemIds])];
          await syncOfficesMutation.mutateAsync({
            msiId: linkPickerMsiId,
            officeIds: allOfficeIds,
            version: currentMsiData?.item.version ?? 1,
          });
        } else if (linkPickerType === 'option') {
          await linkOptionsMutation.mutateAsync({
            msiId: linkPickerMsiId,
            optionIds: itemIds,
          });
        } else if (linkPickerType === 'upcharge') {
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
      currentMsiData,
      linkOptionsMutation,
      linkUpchargesMutation,
      syncOfficesMutation,
    ],
  );

  // Unlink handlers
  const openUnlinkDialog = useCallback(
    (
      type: 'office' | 'option' | 'upcharge',
      msiId: string,
      msiName: string,
      itemId: string,
      itemName: string,
    ) => {
      // For offices, we need to set linkPickerMsiId so currentMsiData has the right MSI
      if (type === 'office') {
        setLinkPickerMsiId(msiId);
      }
      setUnlinkItem({ type, msiId, msiName, itemId, itemName });
      setUnlinkDialogOpen(true);
    },
    [],
  );

  const handleUnlink = useCallback(async () => {
    if (!unlinkItem) return;
    try {
      if (unlinkItem.type === 'office') {
        // For offices, we need to sync with the office removed
        const currentOfficeIds =
          currentMsiData?.item.offices.map(o => o.id) ?? [];
        const newOfficeIds = currentOfficeIds.filter(
          id => id !== unlinkItem.itemId,
        );
        await syncOfficesMutation.mutateAsync({
          msiId: unlinkItem.msiId,
          officeIds: newOfficeIds,
          version: currentMsiData?.item.version ?? 1,
        });
      } else if (unlinkItem.type === 'option') {
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
  }, [
    unlinkItem,
    currentMsiData,
    unlinkOptionMutation,
    unlinkUpchargeMutation,
    syncOfficesMutation,
  ]);

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

            {/* Category Filter (Multi-Select) */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Categories</InputLabel>
              <Select
                multiple
                value={categoryIds}
                onChange={handleCategoryChange}
                label="Categories"
                renderValue={selected =>
                  selected.length === 0
                    ? ''
                    : selected.length === 1
                      ? (selectedCategories[0]?.name ?? '')
                      : `${selected.length} categories`
                }
              >
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

            {/* Office Filter (Multi-Select) */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Offices</InputLabel>
              <Select
                multiple
                value={officeIds}
                onChange={handleOfficeChange}
                label="Offices"
                renderValue={selected =>
                  selected.length === 0
                    ? ''
                    : selected.length === 1
                      ? (selectedOffices[0]?.name ?? '')
                      : `${selected.length} offices`
                }
              >
                {officesData?.offices.map(office => (
                  <MenuItem key={office.id} value={office.id}>
                    {office.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Tag Filter */}
            {tagsData?.tags && tagsData.tags.length > 0 && (
              <TagFilterSelect
                value={tagIds}
                onChange={setTagIds}
                tags={tagsData.tags}
                label="Tags"
                minWidth={180}
              />
            )}
          </Stack>

          {/* Active Filter Chips */}
          {hasFilters && (
            <Box
              sx={{
                mt: 2,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                Active filters:
              </Typography>
              {search && (
                <Chip
                  label={`Search: "${search}"`}
                  onDelete={() => setSearch('')}
                  size="small"
                  variant="outlined"
                />
              )}
              {selectedCategories.map(category => (
                <Chip
                  key={category.id}
                  icon={<CategoryIcon sx={{ fontSize: 16 }} />}
                  label={category.name}
                  onDelete={() =>
                    setCategoryIds(prev =>
                      prev.filter(id => id !== category.id),
                    )
                  }
                  size="small"
                  variant="outlined"
                />
              ))}
              {selectedOffices.map(office => (
                <Chip
                  key={office.id}
                  label={office.name}
                  onDelete={() =>
                    setOfficeIds(prev => prev.filter(id => id !== office.id))
                  }
                  size="small"
                  variant="outlined"
                />
              ))}
              {selectedTags.map(tag => (
                <Chip
                  key={tag.id}
                  icon={<LocalOfferIcon sx={{ fontSize: 16 }} />}
                  label={tag.name}
                  onDelete={() =>
                    setTagIds(prev => prev.filter(id => id !== tag.id))
                  }
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: tag.color,
                    '& .MuiChip-icon': { color: tag.color },
                  }}
                />
              ))}
              <Button size="small" onClick={clearFilters} sx={{ ml: 1 }}>
                Clear All
              </Button>
            </Box>
          )}
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
            <EntityCardSkeleton key={i} badgeCount={4} showCheckbox={false} />
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
              onThumbnailClick={() => handleThumbnailClick(msi.id)}
              isThumbnailLoading={
                imagePickerSaving && imagePickerMsiId === msi.id
              }
              onLinkOffices={() => openLinkPicker('office', msi.id)}
              onLinkOptions={() => openLinkPicker('option', msi.id)}
              onLinkUpcharges={() => openLinkPicker('upcharge', msi.id)}
              onUnlinkOffice={(officeId, officeName) =>
                openUnlinkDialog(
                  'office',
                  msi.id,
                  msi.name,
                  officeId,
                  officeName,
                )
              }
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
          linkPickerType === 'office'
            ? false // Offices are loaded synchronously
            : linkPickerType === 'option'
              ? isLoadingOptions
              : isLoadingUpcharges
        }
        hasMore={
          linkPickerType === 'office'
            ? false // Offices don't have pagination
            : linkPickerType === 'option'
              ? hasMoreOptions
              : hasMoreUpcharges
        }
        onLoadMore={() => {
          if (linkPickerType === 'option') {
            void fetchMoreOptions();
          } else if (linkPickerType === 'upcharge') {
            void fetchMoreUpcharges();
          }
          // Offices don't need load more
        }}
        isLoadingMore={
          linkPickerType === 'office'
            ? false
            : linkPickerType === 'option'
              ? isFetchingMoreOptions
              : isFetchingMoreUpcharges
        }
        onSearch={linkPickerType === 'office' ? undefined : setLinkPickerSearch}
        onClose={() => setLinkPickerOpen(false)}
        onLink={itemIds => void handleLink(itemIds)}
        isLinking={
          linkOptionsMutation.isPending ||
          linkUpchargesMutation.isPending ||
          syncOfficesMutation.isPending
        }
        // Tag filtering (for options and upcharges only)
        availableTags={linkPickerType === 'office' ? undefined : tagsData?.tags}
        selectedTagIds={linkPickerTagIds}
        onTagFilterChange={
          linkPickerType === 'office' ? undefined : setLinkPickerTagIds
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
          syncOfficesMutation.isPending ||
          unlinkOptionMutation.isPending ||
          unlinkUpchargeMutation.isPending
        }
      />

      {/* Image Picker Dialog for Thumbnail */}
      <ImagePicker
        open={imagePickerOpen}
        onClose={handleImagePickerClose}
        selectedImageIds={currentMsiSelectedImageIds}
        onSelectionChange={(imageIds, images) =>
          void handleImageSelectionChange(imageIds, images)
        }
        multiple={false}
        title="Select Thumbnail Image"
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
