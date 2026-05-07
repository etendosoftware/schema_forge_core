import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock use-mobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Mock UI sub-components used by sidebar
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));
vi.mock('@/components/ui/separator', () => ({
  Separator: (props) => <hr {...props} />,
}));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }) => <div>{children}</div>,
  SheetDescription: ({ children }) => <p>{children}</p>,
  SheetHeader: ({ children }) => <div>{children}</div>,
  SheetTitle: ({ children }) => <h2>{children}</h2>,
}));
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props) => <div data-testid="skeleton" {...props} />,
}));
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }) => <>{children}</>,
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children }) => <>{children}</>,
  TooltipContent: ({ children }) => <span style={{ display: 'none' }}>{children}</span>,
}));

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
  useSidebar,
} from '../sidebar.jsx';

describe('Sidebar components', () => {
  it('SidebarProvider renders children', () => {
    render(
      <SidebarProvider>
        <div data-testid="child">Hello</div>
      </SidebarProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('Sidebar renders children within SidebarProvider', () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <div data-testid="sidebar-child">Sidebar Content</div>
        </Sidebar>
      </SidebarProvider>
    );
    expect(screen.getByTestId('sidebar-child')).toBeInTheDocument();
  });

  it('SidebarContent renders with data-sidebar attribute', () => {
    render(
      <SidebarProvider>
        <SidebarContent data-testid="sc">Content</SidebarContent>
      </SidebarProvider>
    );
    const el = screen.getByTestId('sc');
    expect(el).toHaveAttribute('data-sidebar', 'content');
  });

  it('SidebarHeader renders with data-sidebar attribute', () => {
    render(
      <SidebarProvider>
        <SidebarHeader data-testid="sh">Header</SidebarHeader>
      </SidebarProvider>
    );
    expect(screen.getByTestId('sh')).toHaveAttribute('data-sidebar', 'header');
  });

  it('SidebarFooter renders with data-sidebar attribute', () => {
    render(
      <SidebarProvider>
        <SidebarFooter data-testid="sf">Footer</SidebarFooter>
      </SidebarProvider>
    );
    expect(screen.getByTestId('sf')).toHaveAttribute('data-sidebar', 'footer');
  });

  it('SidebarGroup renders children', () => {
    render(
      <SidebarProvider>
        <SidebarGroup>
          <SidebarGroupLabel>Label</SidebarGroupLabel>
          <SidebarGroupContent data-testid="gc">Items</SidebarGroupContent>
        </SidebarGroup>
      </SidebarProvider>
    );
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByTestId('gc')).toBeInTheDocument();
  });

  it('SidebarMenu renders a list', () => {
    render(
      <SidebarProvider>
        <SidebarMenu data-testid="menu">
          <SidebarMenuItem>
            <SidebarMenuButton>Item 1</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>
    );
    expect(screen.getByTestId('menu').tagName).toBe('UL');
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('SidebarTrigger toggles sidebar', async () => {
    const user = userEvent.setup();
    function TestComp() {
      const { state } = useSidebar();
      return <span data-testid="state">{state}</span>;
    }
    render(
      <SidebarProvider defaultOpen={true}>
        <SidebarTrigger data-testid="trigger" />
        <TestComp />
      </SidebarProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('expanded');
    await user.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
  });

  it('SidebarInset renders a main element', () => {
    render(
      <SidebarProvider>
        <SidebarInset data-testid="inset">Main Content</SidebarInset>
      </SidebarProvider>
    );
    expect(screen.getByTestId('inset').tagName).toBe('MAIN');
  });

  it('SidebarSeparator renders an hr', () => {
    render(
      <SidebarProvider>
        <SidebarSeparator data-testid="sep" />
      </SidebarProvider>
    );
    expect(screen.getByTestId('sep')).toBeInTheDocument();
  });

  it('Sidebar with collapsible=none renders without toggle logic', () => {
    render(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <div data-testid="non-collapsible">Static</div>
        </Sidebar>
      </SidebarProvider>
    );
    expect(screen.getByTestId('non-collapsible')).toBeInTheDocument();
  });
});
