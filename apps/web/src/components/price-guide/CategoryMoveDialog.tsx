/**
 * Category move dialog component.
 * Provides accessible fallback for drag-and-drop move operation.
 */
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';

import type {
  PriceGuideCategoryListItem,
  PriceGuideCategoryTreeNode,
} from '@shared/core';

type MoveDestination = {
  id: string | null;
  path: string;
};

type CategoryMoveDialogProps = {
  /** Whether the dialog is open. */
  open: boolean;
  /** Category being moved. */
  category: PriceGuideCategoryListItem | null;
  /** Full category tree for destination selection. */
  tree: PriceGuideCategoryTreeNode[];
  /** Whether the move operation is in progress. */
  isMoving?: boolean;
  /** Callback when dialog is closed. */
  onClose: () => void;
  /** Callback when move is confirmed. */
  onMove: (parentId: string | null) => void;
};

/**
 * Build flat list of destination options with full paths.
 * Excludes the category being moved and its descendants.
 */
function buildDestinations(
  tree: PriceGuideCategoryTreeNode[],
  excludeId: string | null,
): MoveDestination[] {
  const destinations: MoveDestination[] = [
    { id: null, path: 'Root (top level)' },
  ];

  function collectDescendantIds(node: PriceGuideCategoryTreeNode): string[] {
    const ids = [node.id];
    for (const child of node.children) {
      ids.push(...collectDescendantIds(child));
    }
    return ids;
  }

  function traverse(
    nodes: PriceGuideCategoryTreeNode[],
    pathPrefix: string,
  ): void {
    for (const node of nodes) {
      // Skip the category being moved and all its descendants
      if (excludeId) {
        const descendantIds = collectDescendantIds(node);
        if (descendantIds.includes(excludeId)) {
          continue;
        }
      }

      const currentPath = pathPrefix
        ? `${pathPrefix} > ${node.name}`
        : node.name;
      destinations.push({ id: node.id, path: currentPath });
      traverse(node.children, currentPath);
    }
  }

  traverse(tree, '');
  return destinations;
}

/**
 * Dialog for moving a category to a new parent.
 * Accessible alternative to drag-and-drop.
 */
export function CategoryMoveDialog({
  open,
  category,
  tree,
  isMoving = false,
  onClose,
  onMove,
}: CategoryMoveDialogProps): React.ReactElement {
  const [selectedDestination, setSelectedDestination] =
    useState<MoveDestination | null>(null);

  // Build destination options, excluding category and its descendants
  const destinations = useMemo(
    () => buildDestinations(tree, category?.id ?? null),
    [tree, category?.id],
  );

  // Reset selection when dialog opens
  useMemo(() => {
    if (open) {
      setSelectedDestination(null);
    }
  }, [open]);

  function handleMove(): void {
    if (selectedDestination !== null) {
      onMove(selectedDestination.id);
    }
  }

  // Don't render if no category selected
  if (!category) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogTitle>Move Category</DialogTitle>
        <DialogContent>
          <Typography>No category selected.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move Category</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select where to move &ldquo;{category.name}&rdquo;
        </Typography>

        <Autocomplete
          options={destinations}
          getOptionLabel={option => option.path}
          value={selectedDestination}
          onChange={(_event, newValue) => setSelectedDestination(newValue)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={params => (
            <TextField
              {...params}
              label="Destination"
              placeholder="Search destinations..."
              helperText="Select a category or Root to move to"
            />
          )}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props;
            return (
              <Box component="li" key={key} {...optionProps}>
                <Typography variant="body2">{option.path}</Typography>
              </Box>
            );
          }}
          sx={{ mt: 1 }}
        />

        {selectedDestination && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: 'action.hover',
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Will move to:
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {selectedDestination.path}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isMoving}>
          Cancel
        </Button>
        <Button
          onClick={handleMove}
          variant="contained"
          disabled={selectedDestination === null || isMoving}
        >
          {isMoving ? 'Moving...' : 'Move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
