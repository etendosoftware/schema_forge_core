import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Input } from '../input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('handles value changes via userEvent.type', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input placeholder="type here" onChange={handleChange} />);
    const input = screen.getByPlaceholderText('type here');
    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
    expect(handleChange).toHaveBeenCalled();
  });

  it('forwards disabled prop', () => {
    render(<Input disabled placeholder="disabled" />);
    expect(screen.getByPlaceholderText('disabled')).toBeDisabled();
  });

  it.each(['text', 'email', 'password', 'number'])(
    'forwards type="%s"',
    (type) => {
      render(<Input type={type} placeholder={`input-${type}`} />);
      const input = screen.getByPlaceholderText(`input-${type}`);
      expect(input).toHaveAttribute('type', type);
    }
  );

  it('merges custom className', () => {
    render(<Input className="extra-class" placeholder="cls" />);
    const input = screen.getByPlaceholderText('cls');
    expect(input.className).toContain('extra-class');
  });

  it('forwards ref', () => {
    const ref = createRef();
    render(<Input ref={ref} placeholder="ref-test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByPlaceholderText('ref-test'));
  });
});