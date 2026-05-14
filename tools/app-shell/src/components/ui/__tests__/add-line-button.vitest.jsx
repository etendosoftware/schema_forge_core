import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock i18n
vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

// Mock Radix dropdown — render a simplified version that works in jsdom
vi.mock('@/components/ui/dropdown-menu', async () => {
  const React = await import('react');
  return {
    DropdownMenu: ({ children }) => <>{children}</>,
    DropdownMenuTrigger: React.forwardRef(({ children, asChild, ...props }, ref) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, { ...props, ref });
      }
      return <div {...props} ref={ref}>{children}</div>;
    }),
    DropdownMenuContent: ({ children }) => <div role="menu">{children}</div>,
    DropdownMenuItem: ({ children, onSelect, disabled, ...props }) => (
      <button
        role="menuitem"
        onClick={onSelect}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    ),
  };
});

import { AddLineButton } from '../add-line-button.jsx';

describe('AddLineButton', () => {
  it('renders with label text', () => {
    render(<AddLineButton onClick={vi.fn()} label="Add line" />);
    expect(screen.getByText('Add line')).toBeInTheDocument();
  });

  it('calls onClick when primary button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AddLineButton onClick={onClick} label="Add line" />);
    await user.click(screen.getByText('Add line'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AddLineButton onClick={onClick} label="Add line" disabled={true} />);
    await user.click(screen.getByText('Add line'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders chevron button with aria-label', () => {
    render(<AddLineButton onClick={vi.fn()} label="Add line" />);
    expect(screen.getByLabelText('More actions')).toBeInTheDocument();
  });

  it('renders menu actions in the dropdown when provided', () => {
    const menuActions = [
      { key: 'delete-all', label: 'Delete All', onClick: vi.fn() },
      { key: 'import', label: 'Import Lines', onClick: vi.fn() },
    ];
    render(
      <AddLineButton onClick={vi.fn()} label="Add line" menuActions={menuActions} />
    );
    expect(screen.getByText('Delete All')).toBeInTheDocument();
    expect(screen.getByText('Import Lines')).toBeInTheDocument();
  });

  it('renders fallback message when menuActions is empty', () => {
    render(
      <AddLineButton onClick={vi.fn()} label="Add line" menuActions={[]} />
    );
    // The UI key for no actions
    expect(screen.getByText('noAdditionalActions')).toBeInTheDocument();
  });

  it('renders fallback message when menuActions is not provided', () => {
    render(
      <AddLineButton onClick={vi.fn()} label="Add line" />
    );
    expect(screen.getByText('noAdditionalActions')).toBeInTheDocument();
  });

  it('calls menu action onClick when a menu item is clicked', async () => {
    const user = userEvent.setup();
    const actionClick = vi.fn();
    const menuActions = [
      { key: 'action1', label: 'Do Something', onClick: actionClick },
    ];
    render(
      <AddLineButton onClick={vi.fn()} label="Add line" menuActions={menuActions} />
    );
    await user.click(screen.getByText('Do Something'));
    expect(actionClick).toHaveBeenCalledTimes(1);
  });

  it('renders a disabled menu action as disabled', () => {
    const menuActions = [
      { key: 'nope', label: 'Cannot Click', onClick: vi.fn(), disabled: true },
    ];
    render(
      <AddLineButton onClick={vi.fn()} label="Add line" menuActions={menuActions} />
    );
    expect(screen.getByText('Cannot Click').closest('button')).toBeDisabled();
  });
});
