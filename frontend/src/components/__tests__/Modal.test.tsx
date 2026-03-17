import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    title: 'Test Modal',
    children: <div>Modal Content</div>,
  };

  it('renders when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('calls onClose when clicking the close button', () => {
    render(<Modal {...defaultProps} />);
    
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay', () => {
    render(<Modal {...defaultProps} />);
    
    const overlay = screen.getByText('Test Modal').closest('.fixed');
    fireEvent.click(overlay!);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders with correct title', () => {
    render(<Modal {...defaultProps} title="Custom Title" />);
    
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <Modal {...defaultProps}>
        <p>Custom children content</p>
        <button>Action</button>
      </Modal>
    );
    
    expect(screen.getByText('Custom children content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});
