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
  LinkPickerDialog,
  LinkedItemsList,
  TagDots,
  TagFilterSelect,
  UnlinkConfirmation,
} from '../../components/price-guide';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOfficesList } from '../../hooks/useOffices';
import {
  useMsiList,
  useMsiDetail,
  useCategoryTree,
  useLinkOptions,
  useLinkUpcharges,
  useLinkAdditionalDetails,
  useSyncOffices,
  useUnlinkOption,
  useUnlinkUpcharge,
  useUnlinkAdditionalDetail,
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
  LinkPickerDialogType,
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
  onLinkAdditionalDetails: () => void;
  onUnlinkOffice: (officeId: string, officeName: string) => void;
  onUnlinkOption: (optionId: string, optionName: string) => void;
  onUnlinkUpcharge: (upchargeId: string, upchargeName: string) => void;
  onUnlinkAdditionalDetail: (fieldId: string, title: string) => void;
};

function MsiExpandedContent({
  msiId,
  onLinkOffices,
  onLinkOptions,
  onLinkUpcharges,
  onLinkAdditionalDetails,
  onUnlinkOffice,
  onUnlinkOption,
  onUnlinkUpcharge,
  onUnlinkAdditionalDetail,
}: MsiExpandedContentProps): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading } = useMsiDetail(msiId);

  const offices = data?.item.offices ?? [];
  const options = data?.item.options ?? [];
  const upcharges = data?.item.upcharges ?? [];
  const additionalDetails = data?.item.additionalDetails ?? [];

  return (
    <Box>
      {/* Linked Items Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            md: '1fr 1fr 1fr 1fr',
          },
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
        <LinkedItemsList
          title="Additional Details"
          itemType="additionalDetail"
          items={additionalDetails}
          isLoading={isLoading}
          onLinkClick={onLinkAdditionalDetails}
          onViewItem={() =>
            void navigate('/price-guide/library?tab=additional-details')
          }
          onUnlinkItem={fieldId => {
            const detail = additionalDetails.find(d => d.fieldId === fieldId);
            if (detail) {
              onUnlinkAdditionalDetail(fieldId, detail.title);
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
  onLinkAdditionalDetails: () => void;
  onUnlinkOffice: (officeId: string, officeName: string) => void;
  onUnlinkOption: (optionId: string, optionName: string) => void;
  onUnlinkUpcharge: (upchargeId: string, upchargeName: string) => void;
  onUnlinkAdditionalDetail: (fieldId: string, title: string) => void;
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
  onLinkAdditionalDetails,
  onUnlinkOffice,
  onUnlinkOption,
  onUnlinkUpcharge,
  onUnlinkAdditionalDetail,
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
        <Box sx={{ ml: 1 }}>
          <TagDots tags={msi.tags} maxDots={5} />
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
          onLinkAdditionalDetails={onLinkAdditionalDetails}
          onUnlinkOffice={onUnlinkOffice}
          onUnlinkOption={onUnlinkOption}
          onUnlinkUpcharge={onUnlinkUpcharge}
          onUnlinkAdditionalDetail={onUnlinkAdditionalDetail}
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

  // Link picker dialog state (uses new LinkPickerDialog for all types)
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkPickerType, setLinkPickerType] =
    useState<LinkPickerDialogType>('option');
  const [linkPickerMsiId, setLinkPickerMsiId] = useState<string>('');

  // Unlink confirmation state
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkItem, setUnlinkItem] = useState<{
    type: 'office' | 'option' | 'upcharge' | 'additionalDetail';
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

  // Mutations
  const linkOptionsMutation = useLinkOptions();
  const linkUpchargesMutation = useLinkUpcharges();
  const linkDetailsMutation = useLinkAdditionalDetails();
  const syncOfficesMutation = useSyncOffices();
  const unlinkOptionMutation = useUnlinkOption();
  const unlinkUpchargeMutation = useUnlinkUpcharge();
  const unlinkDetailMutation = useUnlinkAdditionalDetail();

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

  // Get current MSI for link picker dialog
  const { data: linkPickerMsiData } = useMsiDetail(linkPickerMsiId);

  // Get MSI detail for image picker (to get version for sync)
  const { data: imagePickerMsiData } = useMsiDetail(imagePickerMsiId ?? '');

  // Currently linked offices for the dialog
  const linkedOfficesForDialog = useMemo(() => {
    if (!linkPickerMsiData?.item) return [];
    return linkPickerMsiData.item.offices.map(o => ({
      id: o.id,
      name: o.name,
    }));
  }, [linkPickerMsiData]);

  // Currently linked options for the dialog
  const linkedOptionsForDialog = useMemo(() => {
    if (!linkPickerMsiData?.item) return [];
    return linkPickerMsiData.item.options.map(o => ({
      id: o.optionId,
      name: o.name,
      brand: o.brand,
    }));
  }, [linkPickerMsiData]);

  // Options for the disabled options dropdown in upcharge dialog
  const msiOptionsForUpchargeDialog = useMemo(() => {
    if (!linkPickerMsiData?.item) return [];
    return linkPickerMsiData.item.options.map(o => ({
      id: o.optionId,
      name: o.name,
      brand: o.brand,
    }));
  }, [linkPickerMsiData]);

  // State for upcharge disabled options (local state since API doesn't support per-MSI disabled options yet)
  const [upchargeDisabledOptions, setUpchargeDisabledOptions] = useState<
    Record<string, string[]>
  >({});

  // Reset disabled options state when dialog closes
  useEffect(() => {
    if (!linkPickerOpen) {
      setUpchargeDisabledOptions({});
    }
  }, [linkPickerOpen]);

  // Currently linked upcharges for the dialog
  const linkedUpchargesForDialog = useMemo(() => {
    if (!linkPickerMsiData?.item) return [];
    return linkPickerMsiData.item.upcharges.map(u => ({
      id: u.upchargeId,
      name: u.name,
      disabledOptionIds: upchargeDisabledOptions[u.upchargeId] ?? [],
    }));
  }, [linkPickerMsiData, upchargeDisabledOptions]);

  // Currently linked additional details for the dialog
  const linkedAdditionalDetailsForDialog = useMemo(() => {
    if (!linkPickerMsiData?.item) return [];
    return linkPickerMsiData.item.additionalDetails.map(d => ({
      id: d.fieldId,
      title: d.title,
      inputType: d.inputType,
    }));
  }, [linkPickerMsiData]);

  // Handler to update disabled options for an upcharge
  const handleUpdateDisabledOptions = useCallback(
    (upchargeId: string, optionIds: string[]) => {
      setUpchargeDisabledOptions(prev => ({
        ...prev,
        [upchargeId]: optionIds,
      }));
    },
    [],
  );

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

  // Link picker dialog handlers (unified for office, option, upcharge)
  const openLinkPicker = useCallback(
    (type: LinkPickerDialogType, msiId: string) => {
      setLinkPickerType(type);
      setLinkPickerMsiId(msiId);
      setLinkPickerOpen(true);
    },
    [],
  );

  const handleLinkItem = useCallback(
    async (itemId: string) => {
      try {
        switch (linkPickerType) {
          case 'office': {
            // For offices, we need to sync ALL offices (existing + new)
            const existingOfficeIds =
              linkPickerMsiData?.item.offices.map(o => o.id) ?? [];
            const allOfficeIds = [...new Set([...existingOfficeIds, itemId])];
            await syncOfficesMutation.mutateAsync({
              msiId: linkPickerMsiId,
              officeIds: allOfficeIds,
              version: linkPickerMsiData?.item.version ?? 1,
            });
            break;
          }
          case 'option':
            await linkOptionsMutation.mutateAsync({
              msiId: linkPickerMsiId,
              optionIds: [itemId],
            });
            break;
          case 'upcharge':
            await linkUpchargesMutation.mutateAsync({
              msiId: linkPickerMsiId,
              upchargeIds: [itemId],
            });
            break;
          case 'additionalDetail':
            await linkDetailsMutation.mutateAsync({
              msiId: linkPickerMsiId,
              fieldIds: [itemId],
            });
            break;
        }
      } catch (err) {
        console.error('Failed to link item:', err);
      }
    },
    [
      linkPickerType,
      linkPickerMsiId,
      linkPickerMsiData,
      syncOfficesMutation,
      linkOptionsMutation,
      linkUpchargesMutation,
      linkDetailsMutation,
    ],
  );

  const handleUnlinkItemFromDialog = useCallback(
    async (itemId: string) => {
      try {
        switch (linkPickerType) {
          case 'office': {
            // For offices, we need to sync with the office removed
            const currentOfficeIds =
              linkPickerMsiData?.item.offices.map(o => o.id) ?? [];
            const newOfficeIds = currentOfficeIds.filter(id => id !== itemId);
            await syncOfficesMutation.mutateAsync({
              msiId: linkPickerMsiId,
              officeIds: newOfficeIds,
              version: linkPickerMsiData?.item.version ?? 1,
            });
            break;
          }
          case 'option':
            await unlinkOptionMutation.mutateAsync({
              msiId: linkPickerMsiId,
              optionId: itemId,
            });
            break;
          case 'upcharge':
            await unlinkUpchargeMutation.mutateAsync({
              msiId: linkPickerMsiId,
              upchargeId: itemId,
            });
            break;
          case 'additionalDetail':
            await unlinkDetailMutation.mutateAsync({
              msiId: linkPickerMsiId,
              fieldId: itemId,
            });
            break;
        }
      } catch (err) {
        console.error('Failed to unlink item:', err);
      }
    },
    [
      linkPickerType,
      linkPickerMsiId,
      linkPickerMsiData,
      syncOfficesMutation,
      unlinkOptionMutation,
      unlinkUpchargeMutation,
      unlinkDetailMutation,
    ],
  );

  // Unlink handlers (for confirmation dialog when unlinking from expanded card)
  const openUnlinkDialog = useCallback(
    (
      type: 'office' | 'option' | 'upcharge' | 'additionalDetail',
      msiId: string,
      msiName: string,
      itemId: string,
      itemName: string,
    ) => {
      // Set the linkPickerMsiId so we can get the MSI data for the unlink
      setLinkPickerMsiId(msiId);
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
          linkPickerMsiData?.item.offices.map(o => o.id) ?? [];
        const newOfficeIds = currentOfficeIds.filter(
          id => id !== unlinkItem.itemId,
        );
        await syncOfficesMutation.mutateAsync({
          msiId: unlinkItem.msiId,
          officeIds: newOfficeIds,
          version: linkPickerMsiData?.item.version ?? 1,
        });
      } else if (unlinkItem.type === 'option') {
        await unlinkOptionMutation.mutateAsync({
          msiId: unlinkItem.msiId,
          optionId: unlinkItem.itemId,
        });
      } else if (unlinkItem.type === 'upcharge') {
        await unlinkUpchargeMutation.mutateAsync({
          msiId: unlinkItem.msiId,
          upchargeId: unlinkItem.itemId,
        });
      } else {
        // unlinkItem.type === 'additionalDetail'
        await unlinkDetailMutation.mutateAsync({
          msiId: unlinkItem.msiId,
          fieldId: unlinkItem.itemId,
        });
      }
      setUnlinkDialogOpen(false);
      setUnlinkItem(null);
    } catch (err) {
      console.error('Failed to unlink item:', err);
    }
  }, [
    unlinkItem,
    linkPickerMsiData,
    unlinkOptionMutation,
    unlinkUpchargeMutation,
    unlinkDetailMutation,
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
              onLinkAdditionalDetails={() =>
                openLinkPicker('additionalDetail', msi.id)
              }
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
              onUnlinkAdditionalDetail={(fieldId, title) =>
                openUnlinkDialog(
                  'additionalDetail',
                  msi.id,
                  msi.name,
                  fieldId,
                  title,
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

      {/* Link Picker Dialog (unified for offices, options, upcharges, additional details) */}
      <LinkPickerDialog
        open={linkPickerOpen}
        itemType={linkPickerType}
        linkedOffices={linkedOfficesForDialog}
        linkedOptions={linkedOptionsForDialog}
        linkedUpcharges={linkedUpchargesForDialog}
        linkedAdditionalDetails={linkedAdditionalDetailsForDialog}
        msiOptions={msiOptionsForUpchargeDialog}
        onLink={itemId => void handleLinkItem(itemId)}
        onUnlink={itemId => void handleUnlinkItemFromDialog(itemId)}
        onUpdateDisabledOptions={handleUpdateDisabledOptions}
        onClose={() => setLinkPickerOpen(false)}
        isLinking={
          syncOfficesMutation.isPending ||
          linkOptionsMutation.isPending ||
          linkUpchargesMutation.isPending ||
          linkDetailsMutation.isPending
        }
        isUnlinking={
          syncOfficesMutation.isPending ||
          unlinkOptionMutation.isPending ||
          unlinkUpchargeMutation.isPending ||
          unlinkDetailMutation.isPending
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
          unlinkUpchargeMutation.isPending ||
          unlinkDetailMutation.isPending
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
