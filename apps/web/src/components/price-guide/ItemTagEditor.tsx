/**
 * ItemTagEditor - Reusable component for editing tags on any taggable entity.
 * Uses optimistic updates for smooth UX - changes appear instantly and revert on error.
 *
 * This component encapsulates all tag management logic including:
 * - Fetching current tags for an item
 * - Optimistic UI updates
 * - Creating new tags inline
 * - Error handling with rollback
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  useTagList,
  useItemTags,
  useSetItemTags,
  useCreateTag,
} from '../../hooks/useTags';

import { TagAutocomplete } from './TagAutocomplete';

import type { TagSummary, TaggableEntityType } from '@shared/types';

// Default colors for new tags
const DEFAULT_TAG_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
];

function getRandomColor(): string {
  return (
    DEFAULT_TAG_COLORS[Math.floor(Math.random() * DEFAULT_TAG_COLORS.length)] ??
    DEFAULT_TAG_COLORS[0] ??
    '#58D68D'
  );
}

export type ItemTagEditorProps = {
  /** Type of entity being tagged */
  entityType: TaggableEntityType;
  /** ID of the entity being tagged */
  entityId: string | undefined;
  /** Label for the autocomplete */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show the loading skeleton while initial data loads */
  showLoadingSkeleton?: boolean;
};

/**
 * Reusable tag editor component with optimistic updates.
 * Use this anywhere you need to edit tags for an entity.
 */
export function ItemTagEditor({
  entityType,
  entityId,
  label = 'Tags',
  placeholder = 'Add tags...',
  showLoadingSkeleton = false,
}: ItemTagEditorProps): React.ReactElement | null {
  // Local optimistic state
  const [optimisticTags, setOptimisticTags] = useState<TagSummary[] | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const previousTagsRef = useRef<TagSummary[]>([]);

  // Queries
  const { data: tagsData, isLoading: isLoadingAllTags } = useTagList();
  const { data: itemTagsData, isLoading: isLoadingItemTags } = useItemTags(
    entityType,
    entityId,
  );

  // Mutations
  const setItemTagsMutation = useSetItemTags();
  const createTagMutation = useCreateTag();

  // The displayed tags: use optimistic state if set, otherwise use server data
  const displayedTags = useMemo(
    () => optimisticTags ?? itemTagsData?.tags ?? [],
    [optimisticTags, itemTagsData?.tags],
  );

  // Handle tag selection changes with optimistic update
  const handleTagsChange = useCallback(
    (newTags: TagSummary[]) => {
      if (!entityId) return;

      // Clear any previous error
      setSaveError(null);

      // Store previous state for potential rollback
      previousTagsRef.current = displayedTags;

      // Optimistically update the UI immediately
      setOptimisticTags(newTags);

      // Save to server silently
      const tagIds = newTags.map(t => t.id);
      setItemTagsMutation.mutate(
        { entityType, entityId, tagIds },
        {
          onError: () => {
            // Revert to previous state on error
            setOptimisticTags(previousTagsRef.current);
            setSaveError('Failed to save tags. Changes reverted.');
          },
        },
      );
    },
    [displayedTags, entityType, entityId, setItemTagsMutation],
  );

  // Handle creating new tag from autocomplete
  const handleCreateTag = useCallback(
    async (name: string): Promise<TagSummary | null> => {
      try {
        const result = await createTagMutation.mutateAsync({
          name,
          color: getRandomColor(),
        });
        return result.tag;
      } catch {
        setSaveError('Failed to create tag.');
        return null;
      }
    },
    [createTagMutation],
  );

  // Don't render if no entity ID
  if (!entityId) {
    return null;
  }

  const isLoading = isLoadingAllTags || isLoadingItemTags;
  const allTags = tagsData?.tags ?? [];

  if (isLoading && showLoadingSkeleton) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Loading tags...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TagAutocomplete
        value={displayedTags}
        onChange={handleTagsChange}
        options={allTags}
        onCreateTag={handleCreateTag}
        label={label}
        placeholder={placeholder}
        loading={isLoading}
      />
      {saveError && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
          onClose={() => setSaveError(null)}
        >
          {saveError}
        </Alert>
      )}
    </Box>
  );
}
