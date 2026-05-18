import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

describe('Button', () => {
  it('renders with default variant and size classes', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
    // default variant classes
    expect(btn.className).toMatch(/bg-primary/);
    // default size classes
    expect(btn.className).toMatch(/h-9/);
    expect(btn.className).toMatch(/px-4/);
  });

  it.each([
    ['default', 'bg-primary'],
    ['destructive', 'bg-destructive'],
    ['outline', 'border-input'],
    ['secondary', 'bg-secondary'],
    ['ghost', 'hover:bg-accent'],
    ['link', 'underline-offset-4'],
  ])('renders variant="%s" with class containing "%s"', (variant, expectedClass) => {
    render(<Button variant={variant}>btn</Button>);
    const btn = screen.getByRole('button', { name: /btn/i });
    expect(btn.className).toMatch(new RegExp(expectedClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  it.each([
    ['default', 'h-9', 'px-4'],
    ['sm', 'h-8', 'px-3'],
    ['lg', 'h-10', 'px-8'],
    ['icon', 'h-9', 'w-9'],
  ])('renders size="%s" with classes "%s" and "%s"', (size, cls1, cls2) => {
    render(<Button size={size}>btn</Button>);
    const btn = screen.getByRole('button', { name: /btn/i });
    expect(btn.className).toContain(cls1);
    expect(btn.className).toContain(cls2);
  });

  it('forwards click handler', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button', { name: /click/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders as child element when asChild=true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/test');
    // Should NOT render a <button>
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<Button className="my-custom-class">btn</Button>);
    const btn = screen.getByRole('button', { name: /btn/i });
    expect(btn.className).toContain('my-custom-class');
  });

  it('forwards disabled prop', () => {
    render(<Button disabled>btn</Button>);
    const btn = screen.getByRole('button', { name: /btn/i });
    expect(btn).toBeDisabled();
  });
});
