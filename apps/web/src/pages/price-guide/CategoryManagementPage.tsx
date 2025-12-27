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
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState, useCallback, useMemo } from 'react';

import {
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../hooks/usePriceGuide';

import type { CategoryTreeNode } from '@shared/types';

// ============================================================================
// Constants
// ============================================================================

const MAX_DEPTH = 5;
const INDENT_PX = 24;

// ============================================================================
// Category Tree Node Component
// ============================================================================

type CategoryNodeProps = {
  node: CategoryTreeNode;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (node: CategoryTreeNode) => void;
  onDragStart: (node: CategoryTreeNode) => void;
  onDragOver: (e: React.DragEvent, node: CategoryTreeNode) => void;
  onDrop: (e: React.DragEvent, node: CategoryTreeNode) => void;
  isDragging: boolean;
  dragOverId: string | null;
};

function CategoryNode({
  node,
  expandedIds,
  onToggleExpand,
  onEdit,
  onAddChild,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  dragOverId,
}: CategoryNodeProps): React.ReactElement {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const isOverDepthLimit = node.depth >= MAX_DEPTH;
  const isDragOver = dragOverId === node.id;

  return (
    <Box>
      {/* Node Row */}
      <Box
        draggable
        onDragStart={() => onDragStart(node)}
        onDragOver={e => onDragOver(e, node)}
        onDrop={e => onDrop(e, node)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.75,
          px: 1,
          pl: 1 + node.depth * (INDENT_PX / 8),
          borderRadius: 1,
          cursor: 'grab',
          bgcolor: isDragOver ? 'action.hover' : 'transparent',
          borderTop: isDragOver ? '2px solid' : '2px solid transparent',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          opacity: isDragging ? 0.5 : 1,
          '&:hover': {
            bgcolor: 'action.hover',
          },
          transition: 'background-color 0.15s, border-color 0.15s',
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

        {/* MSI Count */}
        <Tooltip title={`${node.msiCount} items in this category`}>
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

      {/* Children */}
      {isExpanded && hasChildren && (
        <Box>
          {node.children.map(child => (
            <CategoryNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              isDragging={isDragging}
              dragOverId={dragOverId}
            />
          ))}
        </Box>
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
  onSave: (id: string, name: string, version: number) => void;
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

  // Reset name when dialog opens
  useMemo(() => {
    if (category) {
      setName(category.name);
    }
  }, [category]);

  const handleSave = () => {
    if (category && name.trim()) {
      // Note: We need to get version from somewhere - for now using 1
      // In practice, you'd fetch the full category details
      onSave(category.id, name.trim(), 1);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Category</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Category Name"
          fullWidth
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isSaving}
        />
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
  onSave: (name: string, parentId: string | null) => void;
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

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), parentId);
      setName('');
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {parentId ? 'Add Child Category' : 'Add Root Category'}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Category Name"
          fullWidth
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isSaving}
        />
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
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Queries & Mutations
  const { data: categoryData, isLoading, error } = useCategoryTree();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

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
    (id: string, name: string, version: number) => {
      updateMutation.mutate(
        { categoryId: id, data: { name, version } },
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
    (name: string, parentId: string | null) => {
      createMutation.mutate(
        { name, parentId },
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

  const handleDragOver = useCallback(
    (e: React.DragEvent, node: CategoryTreeNode) => {
      e.preventDefault();
      setDragOverId(node.id);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNode: CategoryTreeNode) => {
      e.preventDefault();
      setDragOverId(null);

      if (!dragNode || dragNode.id === targetNode.id) {
        setDragNode(null);
        return;
      }

      // TODO: Implement move category API call
      // For now, just log the intended move
      console.log('Move category:', {
        categoryId: dragNode.id,
        newParentId: targetNode.id,
      });

      setDragNode(null);
    },
    [dragNode],
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
                setDragOverId(null);
              }}
            >
              {categoryData.categories.map(node => (
                <CategoryNode
                  key={node.id}
                  node={node}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  onEdit={handleEdit}
                  onAddChild={handleAddChild}
                  onDelete={handleDelete}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={dragNode?.id === node.id}
                  dragOverId={dragOverId}
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
