/**
 * Price Guide Categories management page.
 * Split-pane layout with tree sidebar and content area.
 */
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { RequirePermission } from '../components/PermissionGuard';
import {
  CategoryBreadcrumb,
  CategoryCardGrid,
  CategoryDeleteDialog,
  CategoryEditDialog,
  CategoryMoveDialog,
  CategoryOfficeFilter,
  CategoryTable,
  CategoryTreeSidebar,
  ViewToggle,
} from '../components/price-guide';
import { useUserPermissions, PERMISSIONS } from '../hooks/usePermissions';
import {
  usePriceGuideCategoriesList,
  usePriceGuideCategoriesTree,
  usePriceGuideCategoryBreadcrumb,
  useCreatePriceGuideCategory,
  useUpdatePriceGuideCategory,
  useMovePriceGuideCategory,
  useDeletePriceGuideCategory,
} from '../hooks/usePriceGuideCategories';
import { handleApiError } from '../lib/api-client';

import type { ViewMode } from '../components/price-guide';
import type { PriceGuideCategoryListItem } from '@shared/core';

const SIDEBAR_WIDTH = 280;

/**
 * Main Price Guide Categories page component.
 */
export function PriceGuideCategoriesPage(): React.ReactElement {
  // URL state
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategoryId = searchParams.get('categoryId');
  const viewParam = searchParams.get('view');

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>(
    viewParam === 'table' ? 'table' : 'grid',
  );
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<string[]>([]);
  const [editCategory, setEditCategory] =
    useState<PriceGuideCategoryListItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [moveCategory, setMoveCategory] =
    useState<PriceGuideCategoryListItem | null>(null);
  const [deleteCategory, setDeleteCategory] =
    useState<PriceGuideCategoryListItem | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    severity: 'success' | 'error';
  } | null>(null);

  // Queries
  const { data: listData, isLoading: isListLoading } =
    usePriceGuideCategoriesList({
      parentId: currentCategoryId,
    });
  const { data: treeData, isLoading: isTreeLoading } =
    usePriceGuideCategoriesTree();
  const { data: breadcrumbData, isLoading: isBreadcrumbLoading } =
    usePriceGuideCategoryBreadcrumb(currentCategoryId ?? undefined);

  // Mutations
  const createMutation = useCreatePriceGuideCategory();
  const updateMutation = useUpdatePriceGuideCategory();
  const moveMutation = useMovePriceGuideCategory();
  const deleteMutation = useDeletePriceGuideCategory();

  // Permissions
  const { hasPermission } = useUserPermissions();
  const canCreate = hasPermission(PERMISSIONS.PRICE_GUIDE_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.PRICE_GUIDE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.PRICE_GUIDE_DELETE);

  const categories = listData?.categories ?? [];
  const tree = treeData?.categories ?? [];
  const breadcrumb = breadcrumbData?.breadcrumb ?? [];
  const isAtRoot = currentCategoryId === null;

  // Navigation handlers
  const handleNavigate = useCallback(
    (categoryId: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (categoryId) {
        params.set('categoryId', categoryId);
      } else {
        params.delete('categoryId');
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      const params = new URLSearchParams(searchParams);
      params.set('view', mode);
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  // Category operations
  const handleCreate = useCallback(
    async (data: { name: string; isActive: boolean }) => {
      try {
        await createMutation.mutateAsync({
          name: data.name,
          isActive: data.isActive,
          parentId: currentCategoryId,
        });
        setIsCreateOpen(false);
        setToast({
          message: 'Category created successfully',
          severity: 'success',
        });
      } catch (error) {
        setToast({ message: handleApiError(error), severity: 'error' });
      }
    },
    [createMutation, currentCategoryId],
  );

  const handleUpdate = useCallback(
    async (data: { name: string; isActive: boolean }) => {
      if (!editCategory) return;
      try {
        await updateMutation.mutateAsync({
          categoryId: editCategory.id,
          data: { name: data.name, isActive: data.isActive },
        });
        setEditCategory(null);
        setToast({
          message: 'Category updated successfully',
          severity: 'success',
        });
      } catch (error) {
        setToast({ message: handleApiError(error), severity: 'error' });
      }
    },
    [updateMutation, editCategory],
  );

  const handleRename = useCallback(
    async (categoryId: string, newName: string) => {
      try {
        await updateMutation.mutateAsync({
          categoryId,
          data: { name: newName },
        });
        setToast({ message: 'Category renamed', severity: 'success' });
      } catch (error) {
        setToast({ message: handleApiError(error), severity: 'error' });
      }
    },
    [updateMutation],
  );

  const handleMove = useCallback(
    async (parentId: string | null) => {
      if (!moveCategory) return;
      try {
        await moveMutation.mutateAsync({
          categoryId: moveCategory.id,
          data: { parentId },
        });
        setMoveCategory(null);
        setToast({
          message: 'Category moved successfully',
          severity: 'success',
        });
      } catch (error) {
        setToast({ message: handleApiError(error), severity: 'error' });
      }
    },
    [moveMutation, moveCategory],
  );

  const handleDelete = useCallback(
    async (force: boolean) => {
      if (!deleteCategory) return;
      try {
        await deleteMutation.mutateAsync({
          categoryId: deleteCategory.id,
          force,
        });
        setDeleteCategory(null);
        setToast({
          message: 'Category deleted successfully',
          severity: 'success',
        });
      } catch (error) {
        setToast({ message: handleApiError(error), severity: 'error' });
      }
    },
    [deleteMutation, deleteCategory],
  );

  // Empty state message
  const emptyMessage = isAtRoot
    ? canCreate
      ? 'No categories yet. Click "New Category" to create one.'
      : 'No categories have been created yet.'
    : 'This category is empty.';

  return (
    <Box
      sx={{
        height: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Page Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
          px: 3,
          pt: 2,
        }}
      >
        <Box>
          <Typography variant="h2" component="h1" gutterBottom>
            Price Guide Categories
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage hierarchical categories for your price guide.
          </Typography>
        </Box>
        <RequirePermission permission={PERMISSIONS.PRICE_GUIDE_CREATE}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateOpen(true)}
          >
            New Category
          </Button>
        </RequirePermission>
      </Box>

      {/* Split Pane Layout */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Tree Sidebar */}
        <Box sx={{ width: SIDEBAR_WIDTH, flexShrink: 0 }}>
          <CategoryTreeSidebar
            tree={tree}
            isLoading={isTreeLoading}
            selectedId={currentCategoryId}
            onSelect={handleNavigate}
          />
        </Box>

        {/* Content Area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Toolbar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <CategoryOfficeFilter
              selectedOfficeIds={selectedOfficeIds}
              onChange={setSelectedOfficeIds}
              disabled={!isAtRoot}
            />
            <Box sx={{ flex: 1 }}>
              {!isAtRoot && (
                <CategoryBreadcrumb
                  breadcrumb={breadcrumb}
                  isLoading={isBreadcrumbLoading}
                  onNavigate={handleNavigate}
                />
              )}
            </Box>
            <ViewToggle value={viewMode} onChange={handleViewModeChange} />
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            {viewMode === 'grid' ? (
              <CategoryCardGrid
                categories={categories}
                isLoading={isListLoading}
                onCategoryClick={handleNavigate}
                onRename={(id, name) => void handleRename(id, name)}
                onEdit={setEditCategory}
                onMove={setMoveCategory}
                onDelete={setDeleteCategory}
                actionsDisabled={!canUpdate && !canDelete}
                emptyMessage={emptyMessage}
              />
            ) : (
              <CategoryTable
                categories={categories}
                isLoading={isListLoading}
                onCategoryClick={handleNavigate}
                onRename={(id, name) => void handleRename(id, name)}
                onEdit={setEditCategory}
                onMove={setMoveCategory}
                onDelete={setDeleteCategory}
                actionsDisabled={!canUpdate && !canDelete}
                emptyMessage={emptyMessage}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Dialogs */}
      <CategoryEditDialog
        open={isCreateOpen || editCategory !== null}
        category={editCategory}
        parentId={currentCategoryId}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setIsCreateOpen(false);
          setEditCategory(null);
        }}
        onSave={data =>
          void (editCategory ? handleUpdate(data) : handleCreate(data))
        }
      />

      <CategoryMoveDialog
        open={moveCategory !== null}
        category={moveCategory}
        tree={tree}
        isMoving={moveMutation.isPending}
        onClose={() => setMoveCategory(null)}
        onMove={parentId => void handleMove(parentId)}
      />

      <CategoryDeleteDialog
        category={deleteCategory}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeleteCategory(null)}
        onConfirm={force => void handleDelete(force)}
      />

      {/* Toast notifications */}
      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
