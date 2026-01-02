/**
 * Price Guide Category Management Page.
 * Provides tree view with drag-and-drop reordering and category CRUD.
 */

import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import WarningIcon from '@mui/icons-material/Warning';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { CATEGORY_TYPE_OPTIONS } from '@shared/types';
import { useState, useCallback, useMemo } from 'react';

import {
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useMoveCategory,
} from '../../hooks/usePriceGuide';

import type { CategoryTreeNode, PriceGuideCategoryType } from '@shared/types';

// ============================================================================
// Constants
// ============================================================================

const MAX_DEPTH = 5;
const INDENT_PX = 24;

// Drop position: above (sibling before), into (child), below (sibling after)
type DropPosition = 'above' | 'into' | 'below';

type DropTarget = {
  nodeId: string;
  position: DropPosition;
};

// ============================================================================
// Category Tree Node Component
// ============================================================================

type CategoryNodeProps = {
  node: CategoryTreeNode;
  parentId: string | null;
  siblings: CategoryTreeNode[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (node: CategoryTreeNode) => void;
  onDragStart: (node: CategoryTreeNode) => void;
  onDragOver: (
    e: React.DragEvent,
    node: CategoryTreeNode,
    parentId: string | null,
    siblings: CategoryTreeNode[],
  ) => void;
  onDrop: (
    e: React.DragEvent,
    node: CategoryTreeNode,
    parentId: string | null,
    siblings: CategoryTreeNode[],
  ) => void;
  onDragLeave: () => void;
  isDragging: boolean;
  dropTarget: DropTarget | null;
};

function CategoryNode({
  node,
  parentId,
  siblings,
  expandedIds,
  onToggleExpand,
  onEdit,
  onAddChild,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  isDragging,
  dropTarget,
}: CategoryNodeProps): React.ReactElement {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const isOverDepthLimit = node.depth >= MAX_DEPTH;

  const isDropAbove =
    dropTarget?.nodeId === node.id && dropTarget.position === 'above';
  const isDropInto =
    dropTarget?.nodeId === node.id && dropTarget.position === 'into';
  const isDropBelow =
    dropTarget?.nodeId === node.id && dropTarget.position === 'below';

  return (
    <Box>
      {/* Drop indicator above */}
      {isDropAbove && (
        <Box
          sx={{
            height: 2,
            bgcolor: 'primary.main',
            ml: 1 + node.depth * (INDENT_PX / 8),
            mr: 1,
            borderRadius: 1,
          }}
        />
      )}

      {/* Node Row */}
      <Box
        draggable
        onDragStart={e => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(node);
        }}
        onDragOver={e => onDragOver(e, node, parentId, siblings)}
        onDrop={e => onDrop(e, node, parentId, siblings)}
        onDragLeave={onDragLeave}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.75,
          px: 1,
          pl: 1 + node.depth * (INDENT_PX / 8),
          borderRadius: 1,
          cursor: 'grab',
          bgcolor: isDropInto ? 'action.selected' : 'transparent',
          outline: isDropInto ? '2px solid' : 'none',
          outlineColor: isDropInto ? 'primary.main' : 'transparent',
          opacity: isDragging ? 0.5 : 1,
          '&:hover': {
            bgcolor: isDropInto ? 'action.selected' : 'action.hover',
          },
          transition: 'background-color 0.15s, outline-color 0.15s',
        }}
      >
        {/* Drag Handle */}
        <DragIndicatorIcon
          sx={{ fontSize: 18, color: 'text.disabled', mr: 0.5, cursor: 'grab' }}
        />

        {/* Expand/Collapse Button */}
        <IconButton
          size="small"
          onClick={() => onToggleExpand(node.id)}
          sx={{ mr: 0.5, visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isExpanded ? (
            <ExpandMoreIcon fontSize="small" />
          ) : (
            <ChevronRightIcon fontSize="small" />
          )}
        </IconButton>

        {/* Category Icon */}
        <CategoryIcon sx={{ fontSize: 18, color: 'primary.main', mr: 1 }} />

        {/* Name */}
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
          {node.name}
        </Typography>

        {/* Category Type - only shown for root categories with non-default type */}
        {node.depth === 0 && node.categoryType !== 'default' && (
          <Tooltip
            title={
              CATEGORY_TYPE_OPTIONS.find(o => o.value === node.categoryType)
                ?.description
            }
          >
            <Chip
              label={node.categoryType === 'detail' ? 'Detail' : 'Deep Drill'}
              size="small"
              color={node.categoryType === 'detail' ? 'default' : 'secondary'}
              sx={{ mr: 1, fontSize: '0.7rem' }}
            />
          </Tooltip>
        )}

        {/* MSI Count */}
        <Tooltip
          title={
            hasChildren
              ? `${node.msiCount} total items (including subcategories)`
              : `${node.msiCount} items in this category`
          }
        >
          <Chip
            label={node.msiCount}
            size="small"
            variant="outlined"
            sx={{ mr: 1, minWidth: 40 }}
          />
        </Tooltip>

        {/* Depth Warning */}
        {isOverDepthLimit && (
          <Tooltip title="Maximum depth reached. Cannot add child categories.">
            <WarningIcon sx={{ fontSize: 18, color: 'warning.main', mr: 1 }} />
          </Tooltip>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(node)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              isOverDepthLimit ? 'Max depth reached' : 'Add child category'
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={() => onAddChild(node.id)}
                disabled={isOverDepthLimit}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title={
              node.msiCount > 0 || hasChildren
                ? 'Cannot delete: has items or children'
                : 'Delete'
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={() => onDelete(node)}
                disabled={node.msiCount > 0 || hasChildren}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {/* Drop indicator below (only if no children or collapsed) */}
      {isDropBelow && (!hasChildren || !isExpanded) && (
        <Box
          sx={{
            height: 2,
            bgcolor: 'primary.main',
            ml: 1 + node.depth * (INDENT_PX / 8),
            mr: 1,
            borderRadius: 1,
          }}
        />
      )}

      {/* Children */}
      {isExpanded && hasChildren && (
        <Box>
          {node.children.map(child => (
            <CategoryNode
              key={child.id}
              node={child}
              parentId={node.id}
              siblings={node.children}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragLeave={onDragLeave}
              isDragging={isDragging}
              dropTarget={dropTarget}
            />
          ))}
        </Box>
      )}

      {/* Drop indicator below children (if expanded with children) */}
      {isDropBelow && hasChildren && isExpanded && (
        <Box
          sx={{
            height: 2,
            bgcolor: 'primary.main',
            ml: 1 + node.depth * (INDENT_PX / 8),
            mr: 1,
            borderRadius: 1,
          }}
        />
      )}
    </Box>
  );
}

// ============================================================================
// Edit Category Dialog
// ============================================================================

type EditCategoryDialogProps = {
  open: boolean;
  category: CategoryTreeNode | null;
  onClose: () => void;
  onSave: (
    id: string,
    name: string,
    categoryType: PriceGuideCategoryType,
    version: number,
  ) => void;
  isSaving: boolean;
};

function EditCategoryDialog({
  open,
  category,
  onClose,
  onSave,
  isSaving,
}: EditCategoryDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [categoryType, setCategoryType] =
    useState<PriceGuideCategoryType>('default');

  // Reset form when dialog opens
  useMemo(() => {
    if (category) {
      setName(category.name);
      setCategoryType(category.categoryType);
    }
  }, [category]);

  const handleSave = () => {
    if (category && name.trim()) {
      // Note: We need to get version from somewhere - for now using 1
      // In practice, you'd fetch the full category details
      onSave(category.id, name.trim(), categoryType, 1);
    }
  };

  // Only show category type for root categories (depth=0)
  const showCategoryType = category?.depth === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Category</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label="Category Name"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isSaving}
          />
          {showCategoryType && (
            <FormControl fullWidth>
              <InputLabel id="category-type-label">Category Type</InputLabel>
              <Select
                labelId="category-type-label"
                value={categoryType}
                label="Category Type"
                onChange={e =>
                  setCategoryType(e.target.value as PriceGuideCategoryType)
                }
                disabled={isSaving}
              >
                {CATEGORY_TYPE_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {
                  CATEGORY_TYPE_OPTIONS.find(o => o.value === categoryType)
                    ?.description
                }
              </FormHelperText>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Add Category Dialog
// ============================================================================

type AddCategoryDialogProps = {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onSave: (
    name: string,
    parentId: string | null,
    categoryType: PriceGuideCategoryType,
  ) => void;
  isSaving: boolean;
};

function AddCategoryDialog({
  open,
  parentId,
  onClose,
  onSave,
  isSaving,
}: AddCategoryDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [categoryType, setCategoryType] =
    useState<PriceGuideCategoryType>('default');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), parentId, categoryType);
      setName('');
      setCategoryType('default');
    }
  };

  const handleClose = () => {
    setName('');
    setCategoryType('default');
    onClose();
  };

  // Only show category type for root categories (no parent)
  const showCategoryType = parentId === null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {parentId ? 'Add Child Category' : 'Add Root Category'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label="Category Name"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isSaving}
          />
          {showCategoryType && (
            <FormControl fullWidth>
              <InputLabel id="add-category-type-label">
                Category Type
              </InputLabel>
              <Select
                labelId="add-category-type-label"
                value={categoryType}
                label="Category Type"
                onChange={e =>
                  setCategoryType(e.target.value as PriceGuideCategoryType)
                }
                disabled={isSaving}
              >
                {CATEGORY_TYPE_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                {
                  CATEGORY_TYPE_OPTIONS.find(o => o.value === categoryType)
                    ?.description
                }
              </FormHelperText>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : <AddIcon />}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

type DeleteCategoryDialogProps = {
  open: boolean;
  category: CategoryTreeNode | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  isDeleting: boolean;
};

function DeleteCategoryDialog({
  open,
  category,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteCategoryDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete Category</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete &quot;{category?.name}&quot;? This
          action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          onClick={() => category && onConfirm(category.id)}
          color="error"
          variant="contained"
          disabled={isDeleting}
          startIcon={
            isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />
          }
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function TreeSkeleton(): React.ReactElement {
  return (
    <Box>
      {[0, 1, 2, 3, 4].map(i => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 1,
            pl: i % 2 === 1 ? 4 : 1,
          }}
        >
          <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
          <Skeleton variant="text" width={`${60 - i * 5}%`} />
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CategoryManagementPage(): React.ReactElement {
  // State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editCategory, setEditCategory] = useState<CategoryTreeNode | null>(
    null,
  );
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteCategory, setDeleteCategory] = useState<CategoryTreeNode | null>(
    null,
  );
  const [dragNode, setDragNode] = useState<CategoryTreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Queries & Mutations
  const { data: categoryData, isLoading, error } = useCategoryTree();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const moveMutation = useMoveCategory();

  // Expand all by default
  useMemo(() => {
    if (categoryData?.categories) {
      const allIds = new Set<string>();
      const collectIds = (nodes: CategoryTreeNode[]) => {
        for (const node of nodes) {
          allIds.add(node.id);
          if (node.children.length > 0) {
            collectIds(node.children);
          }
        }
      };
      collectIds(categoryData.categories);
      setExpandedIds(allIds);
    }
  }, [categoryData]);

  // Handlers
  const handleToggleExpand = useCallback((id: string) => {
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

  const handleExpandAll = useCallback(() => {
    if (categoryData?.categories) {
      const allIds = new Set<string>();
      const collectIds = (nodes: CategoryTreeNode[]) => {
        for (const node of nodes) {
          allIds.add(node.id);
          if (node.children.length > 0) {
            collectIds(node.children);
          }
        }
      };
      collectIds(categoryData.categories);
      setExpandedIds(allIds);
    }
  }, [categoryData]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const handleEdit = useCallback((node: CategoryTreeNode) => {
    setEditCategory(node);
  }, []);

  const handleSaveEdit = useCallback(
    (
      id: string,
      name: string,
      categoryType: PriceGuideCategoryType,
      version: number,
    ) => {
      updateMutation.mutate(
        { categoryId: id, data: { name, categoryType, version } },
        {
          onSuccess: () => {
            setEditCategory(null);
          },
        },
      );
    },
    [updateMutation],
  );

  const handleAddChild = useCallback((parentId: string) => {
    setAddParentId(parentId);
    setShowAddDialog(true);
  }, []);

  const handleAddRoot = useCallback(() => {
    setAddParentId(null);
    setShowAddDialog(true);
  }, []);

  const handleSaveAdd = useCallback(
    (
      name: string,
      parentId: string | null,
      categoryType: PriceGuideCategoryType,
    ) => {
      createMutation.mutate(
        { name, parentId, categoryType },
        {
          onSuccess: () => {
            setShowAddDialog(false);
            setAddParentId(null);
          },
        },
      );
    },
    [createMutation],
  );

  const handleDelete = useCallback((node: CategoryTreeNode) => {
    setDeleteCategory(node);
  }, []);

  const handleConfirmDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          setDeleteCategory(null);
        },
      });
    },
    [deleteMutation],
  );

  // Drag and Drop handlers
  const handleDragStart = useCallback((node: CategoryTreeNode) => {
    setDragNode(node);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback(
    (
      e: React.DragEvent,
      node: CategoryTreeNode,
      _parentId: string | null,
      _siblings: CategoryTreeNode[],
    ) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!dragNode || dragNode.id === node.id) {
        setDropTarget(null);
        return;
      }

      // Prevent dropping onto own descendants
      const isDescendant = (
        parent: CategoryTreeNode,
        childId: string,
      ): boolean => {
        for (const child of parent.children) {
          if (child.id === childId || isDescendant(child, childId)) {
            return true;
          }
        }
        return false;
      };

      if (isDescendant(dragNode, node.id)) {
        setDropTarget(null);
        return;
      }

      // Determine drop position based on mouse position within the element
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      // Divide element into 3 zones: top 25% = above, middle 50% = into, bottom 25% = below
      let position: DropPosition;
      if (y < height * 0.25) {
        position = 'above';
      } else if (y > height * 0.75) {
        position = 'below';
      } else {
        // Don't allow nesting if it would exceed max depth
        if (node.depth >= MAX_DEPTH) {
          position = y < height * 0.5 ? 'above' : 'below';
        } else {
          position = 'into';
        }
      }

      setDropTarget({ nodeId: node.id, position });
    },
    [dragNode],
  );

  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      targetNode: CategoryTreeNode,
      targetParentId: string | null,
      siblings: CategoryTreeNode[],
    ) => {
      e.preventDefault();

      if (!dragNode || !dropTarget || dragNode.id === targetNode.id) {
        setDragNode(null);
        setDropTarget(null);
        return;
      }

      // Prevent dropping onto own descendants
      const isDescendant = (
        parent: CategoryTreeNode,
        childId: string,
      ): boolean => {
        for (const child of parent.children) {
          if (child.id === childId || isDescendant(child, childId)) {
            return true;
          }
        }
        return false;
      };

      if (isDescendant(dragNode, targetNode.id)) {
        setDragNode(null);
        setDropTarget(null);
        return;
      }

      let newParentId: string | null;
      let sortOrder: number;

      if (dropTarget.position === 'into') {
        // Make it a child of the target node
        newParentId = targetNode.id;
        sortOrder =
          targetNode.children.length > 0
            ? Math.max(...targetNode.children.map(c => c.sortOrder)) + 1
            : 0;
      } else {
        // Make it a sibling of the target node
        newParentId = targetParentId;

        // Find target's position among siblings
        const targetIndex = siblings.findIndex(s => s.id === targetNode.id);

        if (dropTarget.position === 'above') {
          // Insert before target
          const prevSibling =
            targetIndex > 0 ? siblings[targetIndex - 1] : null;
          if (!prevSibling) {
            // First position - use sortOrder less than target
            sortOrder = Math.max(0, targetNode.sortOrder - 1);
          } else {
            // Between previous sibling and target
            sortOrder = Math.floor(
              (prevSibling.sortOrder + targetNode.sortOrder) / 2,
            );
            // If sortOrders are adjacent, we'll need to use a fractional value
            if (sortOrder === prevSibling.sortOrder) {
              sortOrder = targetNode.sortOrder;
            }
          }
        } else {
          // Insert after target (below)
          const nextSibling =
            targetIndex < siblings.length - 1
              ? siblings[targetIndex + 1]
              : null;
          if (!nextSibling) {
            // Last position
            sortOrder = targetNode.sortOrder + 1;
          } else {
            // Between target and next sibling
            sortOrder = Math.floor(
              (targetNode.sortOrder + nextSibling.sortOrder) / 2,
            );
            // If sortOrders are adjacent, place after target
            if (sortOrder === targetNode.sortOrder) {
              sortOrder = nextSibling.sortOrder;
            }
          }
        }
      }

      moveMutation.mutate({
        categoryId: dragNode.id,
        data: {
          newParentId,
          sortOrder,
        },
      });

      setDragNode(null);
      setDropTarget(null);
    },
    [dragNode, dropTarget, moveMutation],
  );

  // Total category count
  const totalCount = useMemo(() => {
    if (!categoryData?.categories) return 0;
    const count = (nodes: CategoryTreeNode[]): number => {
      return nodes.reduce((acc, node) => acc + 1 + count(node.children), 0);
    };
    return count(categoryData.categories);
  }, [categoryData]);

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
          <CategoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h2" component="h1">
              Category Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organize your measure sheet items into categories
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddRoot}
        >
          New Category
        </Button>
      </Box>

      {/* Content Card */}
      <Card>
        <CardContent>
          {/* Toolbar */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
              pb: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {isLoading ? (
                <Skeleton width={100} />
              ) : (
                `${totalCount} categor${totalCount !== 1 ? 'ies' : 'y'}`
              )}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={handleExpandAll}>
                Expand All
              </Button>
              <Button size="small" onClick={handleCollapseAll}>
                Collapse All
              </Button>
            </Stack>
          </Box>

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load categories. Please try again.
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && <TreeSkeleton />}

          {/* Empty State */}
          {!isLoading && categoryData?.categories.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CategoryIcon
                sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }}
              />
              <Typography variant="h3" color="text.secondary" gutterBottom>
                No categories yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first category to start organizing items.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddRoot}
              >
                Create First Category
              </Button>
            </Box>
          )}

          {/* Category Tree */}
          {!isLoading && categoryData && categoryData.categories.length > 0 && (
            <Box
              onDragEnd={() => {
                setDragNode(null);
                setDropTarget(null);
              }}
            >
              {categoryData.categories.map(node => (
                <CategoryNode
                  key={node.id}
                  node={node}
                  parentId={null}
                  siblings={categoryData.categories}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  onEdit={handleEdit}
                  onAddChild={handleAddChild}
                  onDelete={handleDelete}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragLeave={handleDragLeave}
                  isDragging={dragNode?.id === node.id}
                  dropTarget={dropTarget}
                />
              ))}
            </Box>
          )}

          {/* Depth Warning */}
          <Alert severity="info" sx={{ mt: 3 }} icon={<WarningIcon />}>
            Categories can be nested up to {MAX_DEPTH} levels deep. Consider
            flattening your structure if you need more levels.
          </Alert>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditCategoryDialog
        open={!!editCategory}
        category={editCategory}
        onClose={() => setEditCategory(null)}
        onSave={handleSaveEdit}
        isSaving={updateMutation.isPending}
      />

      <AddCategoryDialog
        open={showAddDialog}
        parentId={addParentId}
        onClose={() => {
          setShowAddDialog(false);
          setAddParentId(null);
        }}
        onSave={handleSaveAdd}
        isSaving={createMutation.isPending}
      />

      <DeleteCategoryDialog
        open={!!deleteCategory}
        category={deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </Box>
  );
}
