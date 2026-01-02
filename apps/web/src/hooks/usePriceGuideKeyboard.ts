/**
 * Keyboard Navigation Hook for Price Guide.
 * Provides keyboard shortcuts for common actions.
 */

import { useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

type KeyboardShortcut = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
};

type UsePriceGuideKeyboardOptions = {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
};

// ============================================================================
// Helper Functions
// ============================================================================

function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut,
): boolean {
  const ctrlOrMeta = shortcut.ctrlKey || shortcut.metaKey;
  const eventCtrlOrMeta = event.ctrlKey || event.metaKey;

  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    (ctrlOrMeta ? eventCtrlOrMeta : !eventCtrlOrMeta) &&
    (shortcut.shiftKey ? event.shiftKey : !event.shiftKey) &&
    (shortcut.altKey ? event.altKey : !event.altKey)
  );
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePriceGuideKeyboard({
  shortcuts,
  enabled = true,
}: UsePriceGuideKeyboardOptions): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// ============================================================================
// Common Shortcuts Factory
// ============================================================================

type CatalogKeyboardActions = {
  onSearch?: () => void;
  onNew?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
};

export function useCatalogKeyboard(actions: CatalogKeyboardActions): void {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.onSearch) {
    shortcuts.push({
      key: '/',
      action: actions.onSearch,
      description: 'Focus search',
    });
    shortcuts.push({
      key: 'k',
      ctrlKey: true,
      action: actions.onSearch,
      description: 'Focus search',
    });
  }

  if (actions.onNew) {
    shortcuts.push({
      key: 'n',
      action: actions.onNew,
      description: 'Create new item',
    });
  }

  if (actions.onExport) {
    shortcuts.push({
      key: 'e',
      ctrlKey: true,
      action: actions.onExport,
      description: 'Export items',
    });
  }

  if (actions.onImport) {
    shortcuts.push({
      key: 'i',
      ctrlKey: true,
      action: actions.onImport,
      description: 'Import items',
    });
  }

  if (actions.onSelectAll) {
    shortcuts.push({
      key: 'a',
      ctrlKey: true,
      action: actions.onSelectAll,
      description: 'Select all',
    });
  }

  if (actions.onDeselectAll) {
    shortcuts.push({
      key: 'Escape',
      action: actions.onDeselectAll,
      description: 'Clear selection',
    });
  }

  if (actions.onDelete) {
    shortcuts.push({
      key: 'Delete',
      action: actions.onDelete,
      description: 'Delete selected',
    });
    shortcuts.push({
      key: 'Backspace',
      action: actions.onDelete,
      description: 'Delete selected',
    });
  }

  if (actions.onRefresh) {
    shortcuts.push({
      key: 'r',
      ctrlKey: true,
      action: actions.onRefresh,
      description: 'Refresh list',
    });
  }

  usePriceGuideKeyboard({ shortcuts });
}

// ============================================================================
// Detail Page Shortcuts
// ============================================================================

type DetailKeyboardActions = {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
};

export function useDetailKeyboard(actions: DetailKeyboardActions): void {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.onEdit) {
    shortcuts.push({
      key: 'e',
      action: actions.onEdit,
      description: 'Edit item',
    });
  }

  if (actions.onDuplicate) {
    shortcuts.push({
      key: 'd',
      ctrlKey: true,
      action: actions.onDuplicate,
      description: 'Duplicate item',
    });
  }

  if (actions.onDelete) {
    shortcuts.push({
      key: 'Delete',
      action: actions.onDelete,
      description: 'Delete item',
    });
  }

  if (actions.onBack) {
    shortcuts.push({
      key: 'Escape',
      action: actions.onBack,
      description: 'Go back',
    });
  }

  if (actions.onSave) {
    shortcuts.push({
      key: 's',
      ctrlKey: true,
      action: actions.onSave,
      description: 'Save changes',
    });
  }

  if (actions.onCancel) {
    shortcuts.push({
      key: 'Escape',
      action: actions.onCancel,
      description: 'Cancel',
    });
  }

  usePriceGuideKeyboard({ shortcuts });
}

// ============================================================================
// Wizard Shortcuts
// ============================================================================

type WizardKeyboardActions = {
  onNext?: () => void;
  onPrevious?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
};

export function useWizardKeyboard(actions: WizardKeyboardActions): void {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.onNext) {
    shortcuts.push({
      key: 'Enter',
      ctrlKey: true,
      action: actions.onNext,
      description: 'Next step',
    });
  }

  if (actions.onPrevious) {
    shortcuts.push({
      key: 'ArrowLeft',
      altKey: true,
      action: actions.onPrevious,
      description: 'Previous step',
    });
  }

  if (actions.onCancel) {
    shortcuts.push({
      key: 'Escape',
      action: actions.onCancel,
      description: 'Cancel wizard',
    });
  }

  if (actions.onSave) {
    shortcuts.push({
      key: 's',
      ctrlKey: true,
      action: actions.onSave,
      description: 'Save and finish',
    });
  }

  usePriceGuideKeyboard({ shortcuts });
}
