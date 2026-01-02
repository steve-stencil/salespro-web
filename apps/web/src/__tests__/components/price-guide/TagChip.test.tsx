/**
 * Tests for TagChip component.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TagChip } from '../../../components/price-guide/TagChip';

import type { TagSummary } from '@shared/types';

// ============================================================================
// Test Data
// ============================================================================

const darkTag: TagSummary = {
  id: 'tag-1',
  name: 'Premium',
  color: '#1976D2', // Dark blue
};

const lightTag: TagSummary = {
  id: 'tag-2',
  name: 'Sale',
  color: '#FFEB3B', // Light yellow
};

// ============================================================================
// Tests
// ============================================================================

describe('TagChip', () => {
  it('should render tag name', () => {
    render(<TagChip tag={darkTag} />);

    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('should render with tag icon', () => {
    render(<TagChip tag={darkTag} />);

    // MUI renders LocalOfferIcon as an SVG with a path
    const chip = screen.getByText('Premium').closest('.MuiChip-root');
    expect(chip?.querySelector('.MuiChip-icon')).toBeInTheDocument();
  });

  it('should apply tag color as background', () => {
    render(<TagChip tag={darkTag} />);

    const chip = screen.getByText('Premium').closest('.MuiChip-root');
    expect(chip).toHaveStyle({ backgroundColor: '#1976D2' });
  });

  it('should use light text on dark background', () => {
    render(<TagChip tag={darkTag} />);

    const chip = screen.getByText('Premium').closest('.MuiChip-root');
    expect(chip).toHaveStyle({ color: '#ffffff' });
  });

  it('should use dark text on light background', () => {
    render(<TagChip tag={lightTag} />);

    const chip = screen.getByText('Sale').closest('.MuiChip-root');
    expect(chip).toHaveStyle({ color: '#1a1a1a' });
  });

  it('should render small size by default', () => {
    render(<TagChip tag={darkTag} />);

    const chip = screen.getByText('Premium').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-sizeSmall');
  });

  it('should render medium size when specified', () => {
    render(<TagChip tag={darkTag} size="medium" />);

    const chip = screen.getByText('Premium').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-sizeMedium');
  });

  it('should show delete button when onDelete is provided', () => {
    const handleDelete = vi.fn();
    render(<TagChip tag={darkTag} onDelete={handleDelete} />);

    const deleteButton = screen.getByTestId('CancelIcon');
    expect(deleteButton).toBeInTheDocument();
  });

  it('should not show delete button when onDelete is not provided', () => {
    render(<TagChip tag={darkTag} />);

    expect(screen.queryByTestId('CancelIcon')).not.toBeInTheDocument();
  });

  it('should call onDelete when delete button is clicked', () => {
    const handleDelete = vi.fn();
    render(<TagChip tag={darkTag} onDelete={handleDelete} />);

    const deleteButton = screen.getByTestId('CancelIcon');
    fireEvent.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it('should be clickable when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<TagChip tag={darkTag} onClick={handleClick} />);

    const chip = screen.getByText('Premium').closest('.MuiChip-root');
    expect(chip).toHaveClass('MuiChip-clickable');
  });

  it('should not be clickable when onClick is not provided', () => {
    render(<TagChip tag={darkTag} />);

    const chip = screen.getByText('Premium').closest('.MuiChip-root');
    expect(chip).not.toHaveClass('MuiChip-clickable');
  });

  it('should call onClick when chip is clicked', () => {
    const handleClick = vi.fn();
    render(<TagChip tag={darkTag} onClick={handleClick} />);

    const chip = screen.getByText('Premium');
    fireEvent.click(chip);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

