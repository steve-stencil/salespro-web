/**
 * Document template types for iOS parity.
 * Based on iOS source: ContractObject.swift, ContractObjectManager.swift
 */

/**
 * A document template that can be selected for inclusion in the final document.
 * Corresponds to iOS ContractObject.
 */
export type DocumentTemplate = {
  /** Unique identifier for the template */
  id: string;
  /** Parse object ID for the template */
  objectId: string;
  /** Display name shown in the UI */
  displayName: string;
  /** Category this template belongs to */
  category: string;
  /** Category ID for grouping */
  categoryId: string;
  /** Document type name (e.g., 'contract', 'proposal') */
  documentType: string;
  /** Document type ID */
  documentTypeId: string;
  /** URL for the template thumbnail image */
  thumbnailUrl?: string;
  /** URL for the template icon (fallback when no thumbnail) */
  iconUrl?: string;
  /** Whether multiple pages can be added from this template */
  canAddMultiplePages: boolean;
  /** Number of pages in the template */
  pageCount: number;
  /** Whether this template is required */
  isRequired: boolean;
  /** Sort order within category */
  sortOrder: number;
  /** Page ID for the template */
  pageId: string;
  /** Number of photos per page for photo templates */
  photosPerPage: number;
};

/**
 * Category grouping for document templates.
 * iOS: section headers in ContractObjectSelectionCollectionViewController
 */
export type DocumentCategory = {
  /** Unique identifier for the category */
  id: string;
  /** Display name for the category */
  name: string;
  /** Sort order for display */
  sortOrder: number;
  /** Whether the category is collapsed in the UI */
  isCollapsed: boolean;
};

/**
 * Selection state for a single template.
 * Tracks how many times a template has been added (for multi-page templates).
 */
export type TemplateSelection = {
  /** Template ID */
  templateId: string;
  /** Number of pages added (1 for single-page, 1+ for multi-page) */
  pageCount: number;
};

/**
 * Props for the DocumentTemplateTile component.
 */
export type DocumentTemplateTileProps = {
  /** The template to display */
  template: DocumentTemplate;
  /** Whether this template is selected */
  isSelected: boolean;
  /** Number of pages added (for multi-page templates) */
  addedCount: number;
  /** Called when the tile is tapped */
  onToggle: (templateId: string) => void;
  /** Called when the stepper value changes (for multi-page templates) */
  onPageCountChange: (templateId: string, count: number) => void;
  /** Whether the tile is in a loading state */
  isLoading?: boolean;
};

/**
 * Props for the DocumentCategorySection component.
 */
export type DocumentCategorySectionProps = {
  /** The category to display */
  category: DocumentCategory;
  /** Templates in this category */
  templates: DocumentTemplate[];
  /** Map of template ID to selection state */
  selections: Map<string, TemplateSelection>;
  /** Called when a template is toggled */
  onToggleTemplate: (templateId: string) => void;
  /** Called when a template's page count changes */
  onPageCountChange: (templateId: string, count: number) => void;
  /** Called when the category collapse state changes */
  onCollapseToggle: (categoryId: string) => void;
};

/**
 * Props for the DocumentTemplateGrid component.
 */
export type DocumentTemplateGridProps = {
  /** Categories with their templates */
  categories: DocumentCategory[];
  /** All templates */
  templates: DocumentTemplate[];
  /** Map of template ID to selection state */
  selections: Map<string, TemplateSelection>;
  /** Whether templates are loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error?: Error | null;
  /** Called when a template is toggled */
  onToggleTemplate: (templateId: string) => void;
  /** Called when a template's page count changes */
  onPageCountChange: (templateId: string, count: number) => void;
  /** Called when a category collapse state changes */
  onCollapseToggle: (categoryId: string) => void;
  /** Called when retry is requested after an error */
  onRetry: () => void;
};

/**
 * Props for the DocumentActionBar component.
 */
export type DocumentActionBarProps = {
  /** Number of templates selected */
  selectedCount: number;
  /** Total number of templates available */
  totalCount: number;
  /** Whether the NEXT button should be enabled */
  canProceed: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Called when NEXT is clicked */
  onNext: () => void;
  /** Called when SORT is clicked (iPad only) */
  onSort?: () => void;
  /** Current sort mode */
  sortMode?: 'alphabetic' | 'order';
};

/**
 * Props for the DocumentTemplateStepper component.
 */
export type DocumentTemplateStepperProps = {
  /** Current value */
  value: number;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 99) */
  max?: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Whether the stepper is disabled */
  disabled?: boolean;
};

/**
 * Response from the templates API endpoint.
 */
export type DocumentTemplatesResponse = {
  /** List of categories */
  categories: DocumentCategory[];
  /** List of templates */
  templates: DocumentTemplate[];
};
