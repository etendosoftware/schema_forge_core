import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<Card className="custom-card">content</Card>);
    const el = screen.getByText('content');
    expect(el.className).toContain('custom-card');
    // default classes should still be present
    expect(el.className).toContain('rounded-xl');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<CardHeader className="custom-header">h</CardHeader>);
    expect(screen.getByText('h').className).toContain('custom-header');
  });
});

describe('CardTitle', () => {
  it('renders children', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<CardTitle className="custom-title">t</CardTitle>);
    expect(screen.getByText('t').className).toContain('custom-title');
  });
});

describe('CardDescription', () => {
  it('renders children', () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<CardDescription className="custom-desc">d</CardDescription>);
    expect(screen.getByText('d').className).toContain('custom-desc');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Body</CardContent>);
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<CardContent className="custom-content">c</CardContent>);
    expect(screen.getByText('c').className).toContain('custom-content');
  });
});

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<CardFooter className="custom-footer">f</CardFooter>);
    expect(screen.getByText('f').className).toContain('custom-footer');
  });
});