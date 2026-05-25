import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/dashboard', search: '' }),
  NavLink: ({ children, to, className, ...props }) => (
    <a href={to} className={typeof className === 'function' ? '' : className} {...props}>{children}</a>
  ),
}));

// Mock i18n hooks
vi.mock('@/i18n', () => ({
  useMenuLabel: () => (key) => key,
  useUI: () => (key, params) => {
    if (params?.n) return `${key} ${params.n}`;
    return key;
  },
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

// Mock auth context
vi.mock('@schema-forge/app-shell-core', () => ({
  useAuth: () => ({ selectedOrg: { name: 'Test Org' }, user: { name: 'User' }, logout: vi.fn() }),
}));

// Mock favorites context
vi.mock('@/components/layout/FavoritesContext', () => ({
  useFavorites: () => ({ favorites: [] }),
}));

// Mock menu.json
vi.mock('@/menu.json', () => ({
  default: {
    menu: [
      {
        group: 'Home',
        icon: 'Home',
        section: 'General',
        items: [{ name: 'dashboard', label: 'Home', favname: 'Home' }],
      },
    ],
  },
}));

// Mock Radix UI primitives that need portals/popper
vi.mock('@/components/ui/tooltip.jsx', () => ({
  TooltipProvider: ({ children }) => <>{children}</>,
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }) => <>{children}</>,
  TooltipContent: ({ children }) => <span style={{ display: 'none' }}>{children}</span>,
}));

vi.mock('@/components/ui/popover.jsx', async () => {
  const React = await import('react');
  return {
    Popover: ({ children }) => <>{children}</>,
    PopoverTrigger: React.forwardRef(({ children, asChild }, ref) => <span ref={ref}>{children}</span>),
    PopoverContent: ({ children }) => <div style={{ display: 'none' }}>{children}</div>,
  };
});

vi.mock('@/components/ui/dropdown-menu.jsx', async () => {
  const React = await import('react');
  return {
    DropdownMenu: ({ children }) => <>{children}</>,
    DropdownMenuTrigger: React.forwardRef(({ children, asChild, ...props }, ref) => {
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, { ref });
      }
      return <div ref={ref}>{children}</div>;
    }),
    DropdownMenuContent: ({ children }) => <div style={{ display: 'none' }}>{children}</div>,
    DropdownMenuItem: ({ children }) => <div>{children}</div>,
    DropdownMenuLabel: ({ children }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
  };
});

vi.mock('@/components/ui/dialog.jsx', () => ({
  Dialog: ({ children, open }) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogDescription: ({ children }) => <p>{children}</p>,
  DialogFooter: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/button.jsx', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/UserAvatarButton.jsx', () => ({
  UserAvatarButton: () => <div data-testid="user-avatar" />,
}));

// Mock Phosphor icons — return simple span stubs
vi.mock('@phosphor-icons/react', () => {
  const iconStub = ({ className }) => <span className={className} />;
  return {
    ClipboardText: iconStub,
    House: iconStub,
    Star: iconStub,
    IdentificationCard: iconStub,
    ShareNetwork: iconStub,
    TrendUp: iconStub,
    Receipt: iconStub,
    Bank: iconStub,
    Package: iconStub,
    Briefcase: iconStub,
    Users: iconStub,
    Presentation: iconStub,
    Plug: iconStub,
    Gear: iconStub,
    Flask: iconStub,
    SquaresFour: iconStub,
    Eye: iconStub,
    FileCode: iconStub,
    Storefront: iconStub,
  };
});

import SideMenu from '../SideMenu.jsx';

const MENU_GROUPS = [
  {
    group: 'Favorites',
    icon: 'Star',
    section: 'General',
    items: [],
  },
  {
    group: 'Home',
    icon: 'Home',
    section: 'General',
    items: [{ name: 'dashboard', label: 'Home' }],
  },
  {
    group: 'Sales',
    icon: 'TrendingUp',
    section: 'Operations',
    items: [
      { name: 'sales-order', label: 'Sales Order' },
      { name: 'sales-invoice', label: 'Sales Invoice' },
    ],
  },
];

describe('SideMenu', () => {
  const defaultProps = {
    menuGroups: MENU_GROUPS,
    expanded: true,
    onToggle: vi.fn(),
  };

  it('renders without crashing with minimal props', () => {
    render(<SideMenu {...defaultProps} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders the navigation aria label', () => {
    render(<SideMenu {...defaultProps} />);
    expect(screen.getByLabelText('navigation')).toBeInTheDocument();
  });

  it('renders group names in expanded mode', () => {
    render(<SideMenu {...defaultProps} />);
    // "Sales" group button should be visible
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('renders the org name from auth context', () => {
    render(<SideMenu {...defaultProps} />);
    const matches = screen.getAllByText('Test Org');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the user avatar button', () => {
    render(<SideMenu {...defaultProps} />);
    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('renders collapse button in expanded mode', () => {
    render(<SideMenu {...defaultProps} />);
    expect(screen.getByLabelText('collapseMenu')).toBeInTheDocument();
  });

  it('calls onToggle when collapse button is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<SideMenu {...defaultProps} onToggle={onToggle} />);
    await user.click(screen.getByLabelText('collapseMenu'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders expand button in collapsed mode', () => {
    render(<SideMenu {...defaultProps} expanded={false} />);
    expect(screen.getByLabelText('expandMenu')).toBeInTheDocument();
  });

  it('renders help button', () => {
    render(<SideMenu {...defaultProps} />);
    expect(screen.getByText('helpAndSupport')).toBeInTheDocument();
  });

  it('expands group items when group button is clicked', async () => {
    const user = userEvent.setup();
    render(<SideMenu {...defaultProps} />);
    // Click "Sales" to expand
    await user.click(screen.getByText('Sales'));
    expect(screen.getByText('Sales Order')).toBeInTheDocument();
    expect(screen.getByText('Sales Invoice')).toBeInTheDocument();
  });

  it('renders direct link for single-item groups (Home)', () => {
    render(<SideMenu {...defaultProps} />);
    // Home group has exactly 1 item, rendered as direct NavLink
    const homeLink = screen.getByText('Home');
    expect(homeLink).toBeInTheDocument();
  });
});
