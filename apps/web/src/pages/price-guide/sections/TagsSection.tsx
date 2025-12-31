/**
 * Tags Section Component.
 * Handles tag assignment for MSI items using the reusable ItemTagEditor component.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { ItemTagEditor } from '../../../components/price-guide';

// ============================================================================
// Types
// ============================================================================

export type TagsSectionProps = {
  /** The MSI ID to manage tags for */
  msiId: string;
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Section for managing tags on an MSI.
 * Uses the ItemTagEditor component which handles optimistic updates internally.
 */
export function TagsSection({ msiId }: TagsSectionProps): React.ReactElement {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Assign Tags
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add tags to help organize and filter this item. You can create new tags
        by typing a name.
      </Typography>

      <ItemTagEditor
        entityType="MEASURE_SHEET_ITEM"
        entityId={msiId}
        label="Tags"
        placeholder="Search or create tags..."
        showLoadingSkeleton
      />
    </Box>
  );
}
