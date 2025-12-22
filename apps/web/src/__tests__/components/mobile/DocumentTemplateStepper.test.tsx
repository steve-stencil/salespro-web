/**
 * Unit tests for DocumentTemplateStepper component.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { DocumentTemplateStepper } from '../../../features/mobile/components/DocumentTemplateStepper';

describe('DocumentTemplateStepper', () => {
  describe('rendering', () => {
    it('should render current value', () => {
      render(<DocumentTemplateStepper value={3} onChange={vi.fn()} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render increment and decrement buttons', () => {
      render(<DocumentTemplateStepper value={3} onChange={vi.fn()} />);

      expect(screen.getByLabelText('Decrease count')).toBeInTheDocument();
      expect(screen.getByLabelText('Increase count')).toBeInTheDocument();
    });
  });

  describe('increment', () => {
    it('should call onChange with incremented value', () => {
      const onChange = vi.fn();
      render(<DocumentTemplateStepper value={3} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Increase count'));

      expect(onChange).toHaveBeenCalledWith(4);
    });

    it('should not increment beyond max value', () => {
      const onChange = vi.fn();
      render(<DocumentTemplateStepper value={5} max={5} onChange={onChange} />);

      const button = screen.getByLabelText('Increase count');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('decrement', () => {
    it('should call onChange with decremented value', () => {
      const onChange = vi.fn();
      render(<DocumentTemplateStepper value={3} onChange={onChange} />);

      fireEvent.click(screen.getByLabelText('Decrease count'));

      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('should not decrement below min value', () => {
      const onChange = vi.fn();
      render(<DocumentTemplateStepper value={0} min={0} onChange={onChange} />);

      const button = screen.getByLabelText('Decrease count');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should disable both buttons when disabled prop is true', () => {
      render(<DocumentTemplateStepper value={3} onChange={vi.fn()} disabled />);

      expect(screen.getByLabelText('Decrease count')).toBeDisabled();
      expect(screen.getByLabelText('Increase count')).toBeDisabled();
    });
  });

  describe('event propagation', () => {
    it('should stop click event propagation', () => {
      const parentClick = vi.fn();
      const onChange = vi.fn();

      render(
        <div onClick={parentClick}>
          <DocumentTemplateStepper value={3} onChange={onChange} />
        </div>,
      );

      fireEvent.click(screen.getByLabelText('Increase count'));

      expect(onChange).toHaveBeenCalled();
      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
