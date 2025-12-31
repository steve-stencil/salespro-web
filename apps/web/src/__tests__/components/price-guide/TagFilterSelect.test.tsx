/**
 * Tests for TagFilterSelect component.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TagFilterSelect } from '../../../components/price-guide/TagFilterSelect';

import type { TagSummary } from '@shared/types';

// ============================================================================
// Test Data
// ============================================================================

const mockTags: TagSummary[] = [
  { id: 'tag-1', name: 'Premium', color: '#1976D2' },
  { id: 'tag-2', name: 'Sale', color: '#FFEB3B' },
  { id: 'tag-3', name: 'New', color: '#4CAF50' },
  { id: 'tag-4', name: 'Featured', color: '#FF5722' },
];

// ============================================================================
// Tests
// ============================================================================

describe('TagFilterSelect', () => {
  it('should render with label', () => {
    render(<TagFilterSelect value={[]} onChange={vi.fn()} tags={mockTags} />);

    expect(screen.getByLabelText('Tags')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    render(
      <TagFilterSelect
        value={[]}
        onChange={vi.fn()}
        tags={mockTags}
        label="Filter by Tags"
      />,
    );

    expect(screen.getByLabelText('Filter by Tags')).toBeInTheDocument();
  });

  it('should show "All" when no tags are selected', () => {
    render(<TagFilterSelect value={[]} onChange={vi.fn()} tags={mockTags} />);

    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('should show selected tag name when one tag is selected', () => {
    render(
      <TagFilterSelect value={['tag-1']} onChange={vi.fn()} tags={mockTags} />,
    );

    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('should show chips when multiple tags are selected', () => {
    render(
      <TagFilterSelect
        value={['tag-1', 'tag-2']}
        onChange={vi.fn()}
        tags={mockTags}
      />,
    );

    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Sale')).toBeInTheDocument();
  });

  it('should show +N indicator when more than 2 tags selected', () => {
    render(
      <TagFilterSelect
        value={['tag-1', 'tag-2', 'tag-3', 'tag-4']}
        onChange={vi.fn()}
        tags={mockTags}
      />,
    );

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('should open dropdown on click', () => {
    render(<TagFilterSelect value={[]} onChange={vi.fn()} tags={mockTags} />);

    // Click on the select to open dropdown
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);

    // Check dropdown is open and shows all options
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Check all tags are visible in the dropdown
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Premium')).toBeInTheDocument();
    expect(within(listbox).getByText('Sale')).toBeInTheDocument();
    expect(within(listbox).getByText('New')).toBeInTheDocument();
    expect(within(listbox).getByText('Featured')).toBeInTheDocument();
  });

  it('should call onChange when a tag is selected', () => {
    const handleChange = vi.fn();
    render(
      <TagFilterSelect value={[]} onChange={handleChange} tags={mockTags} />,
    );

    // Open dropdown
    fireEvent.mouseDown(screen.getByRole('combobox'));

    // Click on a tag option
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Premium'));

    expect(handleChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('should call onChange with updated array when adding a tag', () => {
    const handleChange = vi.fn();
    render(
      <TagFilterSelect
        value={['tag-1']}
        onChange={handleChange}
        tags={mockTags}
      />,
    );

    // Open dropdown
    fireEvent.mouseDown(screen.getByRole('combobox'));

    // Click on another tag option
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Sale'));

    expect(handleChange).toHaveBeenCalledWith(['tag-1', 'tag-2']);
  });

  it('should call onChange with updated array when removing a tag', () => {
    const handleChange = vi.fn();
    render(
      <TagFilterSelect
        value={['tag-1', 'tag-2']}
        onChange={handleChange}
        tags={mockTags}
      />,
    );

    // Open dropdown
    fireEvent.mouseDown(screen.getByRole('combobox'));

    // Click on selected tag to deselect
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Premium'));

    expect(handleChange).toHaveBeenCalledWith(['tag-2']);
  });

  it('should show "No tags available" when tags array is empty', () => {
    render(<TagFilterSelect value={[]} onChange={vi.fn()} tags={[]} />);

    // Open dropdown
    fireEvent.mouseDown(screen.getByRole('combobox'));

    expect(screen.getByText('No tags available')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <TagFilterSelect
        value={[]}
        onChange={vi.fn()}
        tags={mockTags}
        disabled
      />,
    );

    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('should render small size by default', () => {
    const { container } = render(
      <TagFilterSelect value={[]} onChange={vi.fn()} tags={mockTags} />,
    );

    const formControl = container.querySelector('.MuiFormControl-sizeSmall');
    expect(formControl).toBeInTheDocument();
  });

  it('should render medium size when specified', () => {
    const { container } = render(
      <TagFilterSelect
        value={[]}
        onChange={vi.fn()}
        tags={mockTags}
        size="medium"
      />,
    );

    // MuiFormControl-sizeSmall should not be present
    const formControl = container.querySelector('.MuiFormControl-root');
    expect(formControl).not.toHaveClass('MuiFormControl-sizeSmall');
  });
});
