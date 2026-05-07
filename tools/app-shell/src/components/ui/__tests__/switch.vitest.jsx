import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../switch';

describe('Switch', () => {
  it('renders unchecked by default', () => {
    render(<Switch aria-label="toggle" />);
    const sw = screen.getByRole('switch', { name: /toggle/i });
    expect(sw).toBeInTheDocument();
    expect(sw).toHaveAttribute('data-state', 'unchecked');
  });

  it('toggles on click', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Switch aria-label="toggle" onCheckedChange={handleChange} />);
    const sw = screen.getByRole('switch', { name: /toggle/i });
    expect(sw).toHaveAttribute('data-state', 'unchecked');
    await user.click(sw);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('forwards disabled prop', () => {
    render(<Switch aria-label="toggle" disabled />);
    const sw = screen.getByRole('switch', { name: /toggle/i });
    expect(sw).toBeDisabled();
  });

  it('merges custom className', () => {
    render(<Switch aria-label="toggle" className="my-switch" />);
    const sw = screen.getByRole('switch', { name: /toggle/i });
    expect(sw.className).toContain('my-switch');
  });
});