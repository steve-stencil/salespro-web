/**
 * Hook for managing context menu state and positioning.
 * Handles right-click events and provides anchor position for MUI Menu.
 */
import { useCallback, useState } from 'react';

type ContextMenuPosition = {
  x: number;
  y: number;
};

type UseContextMenuResult<T> = {
  /** The item associated with the open context menu. */
  contextItem: T | null;
  /** Anchor position for the context menu. */
  anchorPosition: ContextMenuPosition | null;
  /** Whether the context menu is open. */
  isOpen: boolean;
  /** Open the context menu for an item at the given position. */
  openMenu: (event: React.MouseEvent, item: T) => void;
  /** Close the context menu. */
  closeMenu: () => void;
};

/**
 * Custom hook for managing context menu state.
 *
 * @example
 * ```tsx
 * const { contextItem, anchorPosition, isOpen, openMenu, closeMenu } =
 *   useContextMenu<Category>();
 *
 * // In component:
 * <div onContextMenu={(e) => openMenu(e, category)}>...</div>
 * <Menu
 *   open={isOpen}
 *   anchorReference="anchorPosition"
 *   anchorPosition={anchorPosition ? { top: anchorPosition.y, left: anchorPosition.x } : undefined}
 *   onClose={closeMenu}
 * >
 *   ...
 * </Menu>
 * ```
 */
export function useContextMenu<T>(): UseContextMenuResult<T> {
  const [contextItem, setContextItem] = useState<T | null>(null);
  const [anchorPosition, setAnchorPosition] =
    useState<ContextMenuPosition | null>(null);

  const openMenu = useCallback((event: React.MouseEvent, item: T) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorPosition({ x: event.clientX, y: event.clientY });
    setContextItem(item);
  }, []);

  const closeMenu = useCallback(() => {
    setAnchorPosition(null);
    setContextItem(null);
  }, []);

  const isOpen = anchorPosition !== null && contextItem !== null;

  return {
    contextItem,
    anchorPosition,
    isOpen,
    openMenu,
    closeMenu,
  };
}
