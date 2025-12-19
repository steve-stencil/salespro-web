/**
 * Category tree sidebar component for hierarchical navigation.
 */
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useMemo, useState } from 'react';

import type { PriceGuideCategoryTreeNode } from '@shared/core';

type CategoryTreeSidebarProps = {
  /** Tree data to display. */
  tree: PriceGuideCategoryTreeNode[];
  /** Whether tree data is loading. */
  isLoading?: boolean;
  /** Currently selected category ID. */
  selectedId: string | null;
  /** Callback when a category is selected. */
  onSelect: (categoryId: string | null) => void;
};

/**
 * Skeleton loader for tree sidebar.
 */
function TreeSkeleton(): React.ReactElement {
  return (
    <Box sx={{ p: 2 }}>
      <Skeleton variant="rounded" width="100%" height={40} sx={{ mb: 2 }} />
      {[1, 2, 3, 4, 5].map(i => (
        <Box
          key={i}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
        >
          <Skeleton variant="circular" width={20} height={20} />
          <Skeleton variant="text" width={`${60 + (i % 3) * 20}%`} />
        </Box>
      ))}
    </Box>
  );
}

/**
 * Filter tree nodes by search query.
 * Returns matching nodes and their ancestors.
 */
function filterTree(
  nodes: PriceGuideCategoryTreeNode[],
  query: string,
): PriceGuideCategoryTreeNode[] {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase();

  function nodeMatches(node: PriceGuideCategoryTreeNode): boolean {
    return node.name.toLowerCase().includes(lowerQuery);
  }

  function filterNode(
    node: PriceGuideCategoryTreeNode,
  ): PriceGuideCategoryTreeNode | null {
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is PriceGuideCategoryTreeNode => n !== null);

    if (nodeMatches(node) || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  return nodes
    .map(filterNode)
    .filter((n): n is PriceGuideCategoryTreeNode => n !== null);
}

/**
 * Get all node IDs from tree (for expanding all when searching).
 */
function getAllNodeIds(nodes: PriceGuideCategoryTreeNode[]): string[] {
  const ids: string[] = [];
  function collect(nodeList: PriceGuideCategoryTreeNode[]): void {
    for (const node of nodeList) {
      ids.push(node.id);
      collect(node.children);
    }
  }
  collect(nodes);
  return ids;
}

/**
 * Render a tree node recursively.
 */
function renderTreeNode(node: PriceGuideCategoryTreeNode): React.ReactElement {
  const totalCount = node.itemCount + node.children.length;

  return (
    <TreeItem
      key={node.id}
      itemId={node.id}
      slots={{
        expandIcon: ChevronRightIcon,
        collapseIcon: ExpandMoreIcon,
      }}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          {node.children.length > 0 ? (
            <FolderOpenIcon fontSize="small" color="primary" />
          ) : (
            <FolderIcon fontSize="small" color="primary" />
          )}
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}
          </Typography>
          {totalCount > 0 && (
            <Badge
              badgeContent={totalCount}
              color="default"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  height: 16,
                  minWidth: 16,
                  backgroundColor: 'action.selected',
                },
              }}
            />
          )}
        </Box>
      }
    >
      {node.children.map(renderTreeNode)}
    </TreeItem>
  );
}

/**
 * Tree sidebar for navigating category hierarchy.
 */
export function CategoryTreeSidebar({
  tree,
  isLoading = false,
  selectedId,
  onSelect,
}: CategoryTreeSidebarProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTree = useMemo(
    () => filterTree(tree, searchQuery),
    [tree, searchQuery],
  );

  const expandedItems = useMemo(() => {
    // Expand all when searching
    if (searchQuery.trim()) {
      return getAllNodeIds(filteredTree);
    }
    return [];
  }, [filteredTree, searchQuery]);

  if (isLoading) {
    return <TreeSkeleton />;
  }

  function handleItemSelectionToggle(
    _event: React.SyntheticEvent,
    itemId: string,
    isSelected: boolean,
  ): void {
    if (isSelected) {
      onSelect(itemId);
    }
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Search input */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Tree view */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 1, py: 1 }}>
        {filteredTree.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'center', py: 4 }}
          >
            {searchQuery.trim()
              ? 'No categories match your search.'
              : 'No categories yet.'}
          </Typography>
        ) : (
          <SimpleTreeView
            selectedItems={selectedId ?? undefined}
            expandedItems={expandedItems}
            onItemSelectionToggle={handleItemSelectionToggle}
          >
            {filteredTree.map(renderTreeNode)}
          </SimpleTreeView>
        )}
      </Box>
    </Box>
  );
}
