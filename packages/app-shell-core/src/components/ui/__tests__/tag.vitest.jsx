import { render, screen } from '@testing-library/react';
import { Tag } from '../tag';

describe('Tag', () => {
  it('renders label prop as text', () => {
    render(<Tag label="Priority" />);
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('renders children when no label', () => {
    render(<Tag>Fallback</Tag>);
    expect(screen.getByText('Fallback')).toBeInTheDocument();
  });

  it('prefers label over children', () => {
    render(<Tag label="Label wins">Children lose</Tag>);
    expect(screen.getByText('Label wins')).toBeInTheDocument();
    expect(screen.queryByText('Children lose')).not.toBeInTheDocument();
  });

  it.each(['blue', 'green', 'red', 'purple', 'yellow', 'pink', 'orange', 'teal', 'neutral'])(
    'renders variant="%s" with matching CSS class',
    (variant) => {
      render(<Tag variant={variant} label={variant} />);
      const el = screen.getByText(variant);
      expect(el.className).toContain(`tag--${variant}`);
    }
  );

  it('defaults to neutral variant', () => {
    render(<Tag label="default" />);
    const el = screen.getByText('default');
    expect(el.className).toContain('tag--neutral');
  });

  it('merges custom className', () => {
    render(<Tag label="cls" className="extra" />);
    const el = screen.getByText('cls');
    expect(el.className).toContain('extra');
  });
});