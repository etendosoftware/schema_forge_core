import { render, screen } from '@testing-library/react';
import { TableCell, TableHead } from '../table';

const TRUNCATION_CLASSES = ['overflow-hidden', 'text-ellipsis', 'whitespace-nowrap', 'min-w-0'];

describe('TableCell', () => {
  it('renders with truncation classes by default', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>cell content</TableCell>
          </tr>
        </tbody>
      </table>
    );
    const el = screen.getByText('cell content');
    TRUNCATION_CLASSES.forEach((cls) => expect(el.className).toContain(cls));
  });

  it('lets a conflicting caller className win (tailwind-merge)', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell className="whitespace-normal">cell content</TableCell>
          </tr>
        </tbody>
      </table>
    );
    const el = screen.getByText('cell content');
    expect(el.className).toContain('whitespace-normal');
    expect(el.className).not.toContain('whitespace-nowrap');
    // unrelated truncation classes are untouched by the conflict resolution
    expect(el.className).toContain('overflow-hidden');
    expect(el.className).toContain('text-ellipsis');
    expect(el.className).toContain('min-w-0');
  });
});

describe('TableHead', () => {
  it('renders with truncation classes by default', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHead>head content</TableHead>
          </tr>
        </thead>
      </table>
    );
    const el = screen.getByText('head content');
    TRUNCATION_CLASSES.forEach((cls) => expect(el.className).toContain(cls));
  });

  it('lets a conflicting caller className win (tailwind-merge)', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHead className="whitespace-normal">head content</TableHead>
          </tr>
        </thead>
      </table>
    );
    const el = screen.getByText('head content');
    expect(el.className).toContain('whitespace-normal');
    expect(el.className).not.toContain('whitespace-nowrap');
    expect(el.className).toContain('overflow-hidden');
    expect(el.className).toContain('text-ellipsis');
    expect(el.className).toContain('min-w-0');
  });
});
