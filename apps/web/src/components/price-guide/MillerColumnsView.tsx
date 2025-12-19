/**
 * Miller Columns view for hierarchical category navigation.
 * Fixed 3-column layout that shifts as user drills deeper.
 */
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useMemo, useState } from 'react';

import { useContextMenu } from '../../hooks/useContextMenu';
import { usePriceGuideCategoriesList } from '../../hooks/usePriceGuideCategories';

import { CategoryContextMenu } from './CategoryContextMenu';
import { CategoryEditPanel } from './CategoryEditPanel';
import { MillerColumn } from './MillerColumn';

import type { PriceGuideCategoryListItem } from '@shared/core';

type MillerColumnsViewProps = {
  /** Callback when edit dialog should open for a category. */
  onEditCategory: (category: PriceGuideCategoryListItem) => void;
  /** Callback when move dialog should open for a category. */
  onMoveCategory: (category: PriceGuideCategoryListItem) => void;
  /** Callback when delete dialog should open for a category. */
  onDeleteCategory: (category: PriceGuideCategoryListItem) => void;
  /** Callback when create dialog should open with parent. */
  onCreateCategory: (parentId: string | null) => void;
  /** Callback when a category is saved inline. */
  onSaveCategory: (
    categoryId: string,
    data: { name: string; isActive: boolean },
  ) => Promise<void>;
  /** Whether save operation is in progress. */
  isSaving?: boolean;
  /** Whether user can update categories. */
  canUpdate?: boolean;
  /** Whether user can delete categories. */
  canDelete?: boolean;
  /** Whether user can create categories. */
  canCreate?: boolean;
};

type VisibleColumns = {
  col1ParentId: string | null;
  col2ParentId: string | null;
  col3ParentId: string | null;
};

/**
 * Determine what each column shows based on selected path depth.
 */
function getVisibleColumns(selectedPath: string[]): VisibleColumns {
  const depth = selectedPath.length;

  if (depth === 0) {
    // At root: Col1=root categories, Col2=empty, Col3=empty
    return { col1ParentId: null, col2ParentId: null, col3ParentId: null };
  }
  if (depth === 1) {
    // One level deep: Col1=root, Col2=selected's children, Col3=empty
    return {
      col1ParentId: null,
      col2ParentId: selectedPath[0] ?? null,
      col3ParentId: null,
    };
  }
  if (depth === 2) {
    // Two levels: Col1=root, Col2=first level children, Col3=second level
    return {
      col1ParentId: null,
      col2ParentId: selectedPath[0] ?? null,
      col3ParentId: selectedPath[1] ?? null,
    };
  }
  // Deeper: shift window - show last 3 levels
  return {
    col1ParentId: selectedPath[depth - 3] ?? null,
    col2ParentId: selectedPath[depth - 2] ?? null,
    col3ParentId: selectedPath[depth - 1] ?? null,
  };
}

/**
 * Get column titles based on visible parent IDs.
 */
function getColumnTitle(
  parentId: string | null,
  categories: PriceGuideCategoryListItem[],
  fallback: string,
): string {
  if (parentId === null) return fallback;
  const parent = categories.find(c => c.id === parentId);
  return parent?.name ?? fallback;
}

/**
 * Miller Columns container component.
 * Manages column state, navigation, and responsive behavior.
 */
export function MillerColumnsView({
  onEditCategory,
  onMoveCategory,
  onDeleteCategory,
  onCreateCategory,
  onSaveCategory,
  isSaving = false,
  canUpdate = true,
  canDelete = true,
  canCreate = true,
}: MillerColumnsViewProps): React.ReactElement {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Path of selected category IDs from root to current
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  // Context menu state
  const { contextItem, anchorPosition, openMenu, closeMenu } =
    useContextMenu<PriceGuideCategoryListItem>();

  // Calculate visible columns based on selection depth
  const visibleColumns = useMemo(
    () => getVisibleColumns(selectedPath),
    [selectedPath],
  );

  // Mobile parent ID for mobile view fetching (must be computed before hooks)
  const mobileParentId: string | null =
    selectedPath.length > 0
      ? (selectedPath[selectedPath.length - 1] ?? null)
      : null;

  // Fetch categories for each visible column (desktop)
  const { data: col1Data, isLoading: col1Loading } =
    usePriceGuideCategoriesList({ parentId: visibleColumns.col1ParentId });
  const { data: col2Data, isLoading: col2Loading } =
    usePriceGuideCategoriesList(
      visibleColumns.col2ParentId !== null
        ? { parentId: visibleColumns.col2ParentId }
        : undefined,
    );
  const { data: col3Data, isLoading: col3Loading } =
    usePriceGuideCategoriesList(
      visibleColumns.col3ParentId !== null
        ? { parentId: visibleColumns.col3ParentId }
        : undefined,
    );

  // Fetch categories for mobile view (always called, may be same as col1Data when at root)
  const { data: mobileData, isLoading: mobileLoading } =
    usePriceGuideCategoriesList({ parentId: mobileParentId });

  const col1Categories = useMemo(() => col1Data?.categories ?? [], [col1Data]);
  const col2Categories = useMemo(() => col2Data?.categories ?? [], [col2Data]);
  const col3Categories = useMemo(() => col3Data?.categories ?? [], [col3Data]);
  const mobileCategories = useMemo(
    () => mobileData?.categories ?? [],
    [mobileData],
  );

  // All loaded categories for lookups
  const allCategories = useMemo(
    () => [...col1Categories, ...col2Categories, ...col3Categories],
    [col1Categories, col2Categories, col3Categories],
  );

  // Get the currently selected category (last in path)
  const selectedCategory = useMemo(() => {
    if (selectedPath.length === 0) return null;
    const lastId = selectedPath[selectedPath.length - 1];
    return allCategories.find(c => c.id === lastId) ?? null;
  }, [selectedPath, allCategories]);

  // Determine if column 3 should show edit panel
  const showEditPanel =
    selectedCategory !== null && selectedCategory.childCount === 0;

  // Column selection IDs for highlighting
  const col1SelectedId = useMemo((): string | null => {
    const depth = selectedPath.length;
    if (depth === 0) return null;
    if (depth <= 2) return selectedPath[0] ?? null;
    return selectedPath[depth - 3] ?? null;
  }, [selectedPath]);

  const col2SelectedId = useMemo((): string | null => {
    const depth = selectedPath.length;
    if (depth <= 1) return null;
    if (depth === 2) return selectedPath[1] ?? null;
    return selectedPath[depth - 2] ?? null;
  }, [selectedPath]);

  const col3SelectedId = useMemo((): string | null => {
    const depth = selectedPath.length;
    if (depth <= 2) return null;
    return selectedPath[depth - 1] ?? null;
  }, [selectedPath]);

  // Handle selecting a category in column 1 (context/back)
  const handleCol1Select = useCallback(
    (category: PriceGuideCategoryListItem) => {
      const depth = selectedPath.length;
      if (depth <= 2) {
        // At shallow depth, just select this item
        setSelectedPath([category.id]);
      } else {
        // Going back: find index of this category in path and truncate
        const index = selectedPath.findIndex(id => id === category.id);
        if (index >= 0) {
          setSelectedPath(selectedPath.slice(0, index + 1));
        } else {
          // Not in path, this shouldn't happen normally
          setSelectedPath([category.id]);
        }
      }
    },
    [selectedPath],
  );

  // Handle selecting a category in column 2
  const handleCol2Select = useCallback(
    (category: PriceGuideCategoryListItem) => {
      const depth = selectedPath.length;
      if (depth === 0) {
        // Shouldn't happen, but handle gracefully
        setSelectedPath([category.id]);
      } else if (depth === 1) {
        // Add to path
        const firstId = selectedPath[0];
        if (firstId) {
          setSelectedPath([firstId, category.id]);
        }
      } else {
        // Update last selection at this level
        const basePath = selectedPath.slice(0, -1);
        setSelectedPath([...basePath, category.id]);
      }
    },
    [selectedPath],
  );

  // Handle selecting a category in column 3
  const handleCol3Select = useCallback(
    (category: PriceGuideCategoryListItem) => {
      if (category.childCount > 0) {
        // Has children: go deeper (shift columns)
        setSelectedPath([...selectedPath, category.id]);
      } else {
        // Leaf node: just select it (edit panel will show)
        // Update path to include this selection
        setSelectedPath([...selectedPath, category.id]);
      }
    },
    [selectedPath],
  );

  // Handle mobile back navigation
  const handleBack = useCallback(() => {
    if (selectedPath.length > 0) {
      setSelectedPath(selectedPath.slice(0, -1));
    }
  }, [selectedPath]);

  // Handle inline save
  const handleSave = useCallback(
    async (data: { name: string; isActive: boolean }) => {
      if (selectedCategory) {
        await onSaveCategory(selectedCategory.id, data);
      }
    },
    [selectedCategory, onSaveCategory],
  );

  // Context menu handlers
  const handleEdit = useCallback(() => {
    if (contextItem) {
      onEditCategory(contextItem);
    }
  }, [contextItem, onEditCategory]);

  const handleMove = useCallback(() => {
    if (contextItem) {
      onMoveCategory(contextItem);
    }
  }, [contextItem, onMoveCategory]);

  const handleDelete = useCallback(() => {
    if (contextItem) {
      onDeleteCategory(contextItem);
    }
  }, [contextItem, onDeleteCategory]);

  // Mobile single-column view
  if (isMobile) {
    // Check if we should show edit panel on mobile
    const mobileSelectedCategory: PriceGuideCategoryListItem | null =
      selectedPath.length > 0
        ? (allCategories.find(
            c => c.id === selectedPath[selectedPath.length - 1],
          ) ?? null)
        : null;
    const showMobileEditPanel =
      mobileSelectedCategory !== null &&
      mobileSelectedCategory.childCount === 0;

    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header with back button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {selectedPath.length > 0 && (
            <IconButton size="small" onClick={handleBack}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
            {mobileSelectedCategory?.name ?? 'Categories'}
          </Typography>
        </Box>

        {/* Mobile content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {mobileSelectedCategory !== null && showMobileEditPanel ? (
            <CategoryEditPanel
              category={mobileSelectedCategory}
              onSave={handleSave}
              onDelete={() => onDeleteCategory(mobileSelectedCategory)}
              onMove={() => onMoveCategory(mobileSelectedCategory)}
              isSaving={isSaving}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          ) : (
            <MillerColumn
              categories={mobileCategories}
              isLoading={mobileLoading}
              selectedId={null}
              onSelect={cat => setSelectedPath([...selectedPath, cat.id])}
              onContextMenu={openMenu}
              onCreate={
                canCreate ? () => onCreateCategory(mobileParentId) : undefined
              }
              emptyMessage="No subcategories"
            />
          )}
        </Box>

        <CategoryContextMenu
          anchorPosition={anchorPosition}
          category={contextItem}
          onClose={closeMenu}
          onEdit={handleEdit}
          onMove={handleMove}
          onDelete={handleDelete}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      </Box>
    );
  }

  // Desktop 3-column view
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        backgroundColor: 'background.default',
      }}
    >
      {/* Column 1 - Context */}
      <MillerColumn
        title={getColumnTitle(
          visibleColumns.col1ParentId,
          allCategories,
          'Categories',
        )}
        categories={col1Categories}
        isLoading={col1Loading}
        selectedId={col1SelectedId}
        onSelect={handleCol1Select}
        onContextMenu={openMenu}
        onCreate={
          canCreate
            ? () => onCreateCategory(visibleColumns.col1ParentId)
            : undefined
        }
        isContextColumn={selectedPath.length > 2}
        emptyMessage="No categories yet"
      />

      {/* Column 2 - Current level */}
      <MillerColumn
        title={
          selectedPath.length > 0
            ? getColumnTitle(
                visibleColumns.col2ParentId,
                allCategories,
                'Subcategories',
              )
            : undefined
        }
        categories={col2Categories}
        isLoading={col2Loading && selectedPath.length > 0}
        selectedId={col2SelectedId}
        onSelect={handleCol2Select}
        onContextMenu={openMenu}
        onCreate={
          canCreate && visibleColumns.col2ParentId !== null
            ? () => onCreateCategory(visibleColumns.col2ParentId)
            : undefined
        }
        placeholder={
          selectedPath.length === 0 ? 'Select a category' : undefined
        }
        emptyMessage="No subcategories"
      />

      {/* Column 3 - Children or Edit Panel */}
      {selectedCategory !== null && showEditPanel ? (
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CategoryEditPanel
            category={selectedCategory}
            onSave={handleSave}
            onDelete={() => onDeleteCategory(selectedCategory)}
            onMove={() => onMoveCategory(selectedCategory)}
            isSaving={isSaving}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </Box>
      ) : (
        <MillerColumn
          title={
            col3SelectedId
              ? getColumnTitle(
                  visibleColumns.col3ParentId,
                  allCategories,
                  'Items',
                )
              : undefined
          }
          categories={col3Categories}
          isLoading={col3Loading && selectedPath.length > 1}
          selectedId={col3SelectedId}
          onSelect={handleCol3Select}
          onContextMenu={openMenu}
          onCreate={
            canCreate && visibleColumns.col3ParentId !== null
              ? () => onCreateCategory(visibleColumns.col3ParentId)
              : undefined
          }
          placeholder={
            selectedPath.length < 2 ? 'Select a category' : undefined
          }
          emptyMessage="No subcategories"
        />
      )}

      {/* Context menu */}
      <CategoryContextMenu
        anchorPosition={anchorPosition}
        category={contextItem}
        onClose={closeMenu}
        onEdit={handleEdit}
        onMove={handleMove}
        onDelete={handleDelete}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </Box>
  );
}
