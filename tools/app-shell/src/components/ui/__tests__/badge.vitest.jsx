import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it.each([
    ['default', 'bg-primary'],
    ['secondary', 'bg-secondary'],
    ['destructive', 'bg-destructive'],
    ['outline', 'text-foreground'],
  ])('renders variant="%s" with class containing "%s"', (variant, expectedClass) => {
    render(<Badge variant={variant}>badge</Badge>);
    const el = screen.getByText('badge');
    expect(el.className).toContain(expectedClass);
  });

  it('merges custom className', () => {
    render(<Badge className="my-badge">badge</Badge>);
    const el = screen.getByText('badge');
    expect(el.className).toContain('my-badge');
  });
});