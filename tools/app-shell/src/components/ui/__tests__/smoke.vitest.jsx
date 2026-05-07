import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Vitest + RTL smoke test', () => {
  it('renders a simple element', () => {
    render(<div data-testid="hello">Hello Vitest</div>);
    expect(screen.getByTestId('hello')).toBeInTheDocument();
    expect(screen.getByTestId('hello')).toHaveTextContent('Hello Vitest');
  });
});