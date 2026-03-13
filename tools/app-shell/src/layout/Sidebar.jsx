import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.jsx';
import {
  Eye,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Calculator,
  Package,
  Users,
  Settings,
  FolderKanban,
  Target,
  LogOut,
  FileJson,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
  Shield,
  Building2,
  RefreshCw,
  Check,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { getSectionColor } from '@/lib/sectionColors.js';
import { useMenuLabel } from '@/i18n';

const ICON_MAP = {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Calculator,
  Package,
  Users,
  Settings,
  FolderKanban,
  Target,
  Eye,
  FileJson,
};

export function findActiveGroup(menuGroups, pathname) {
  const currentPath = pathname.replace(/^\//, '');
  return menuGroups.find((g) =>
    g.items.some((item) => item.name === currentPath)
  ) || null;
}

const COLLAPSED_W = 60;
const EXPANDED_W = 240;

function UserPopover({ onClose }) {
  const { username, roleList, selectedRole, selectedOrg, switchContext, logout } = useAuth();

  const [pendingRoleId, setPendingRoleId] = useState(selectedRole?.id || '');
  const [pendingOrgId, setPendingOrgId] = useState(selectedOrg?.id || '');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const pendingRole = roleList.find(r => r.id === pendingRoleId);
  const orgOptions = pendingRole?.orgList || [];

  const hasChanges = pendingRoleId !== (selectedRole?.id || '') ||
                     pendingOrgId !== (selectedOrg?.id || '');

  const handleRoleChange = (e) => {
    const roleId = e.target.value;
    setPendingRoleId(roleId);
    const role = roleList.find(r => r.id === roleId);
    setPendingOrgId(role?.orgList?.[0]?.id || '');
    setSuccess(false);
    setError(null);
  };

  const handleApply = async () => {
    if (!pendingRoleId || !pendingOrgId) return;
    setSwitching(true);
    setError(null);
    setSuccess(false);
    try {
      await switchContext(pendingRoleId, pendingOrgId, needsPassword ? password : undefined);
      setSuccess(true);
      setNeedsPassword(false);
      setPassword('');
    } catch (e) {
      if (e.message === 'SESSION_EXPIRED') {
        setNeedsPassword(true);
        setError('Enter password to switch.');
      } else {
        setError(e.message || 'Failed to switch context.');
      }
    } finally {
      setSwitching(false);
    }
  };

  return createPortal(
    <>
    {/* Invisible backdrop — closes popover on click outside */}
    <div className="fixed inset-0 z-[100]" onClick={onClose} />
    <div
      className="fixed bottom-3 left-[68px] z-[101] w-72 rounded-lg border bg-popover text-popover-foreground shadow-xl"
    >
      {/* Header */}
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">{username}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {selectedRole?.name || selectedRole?.id || 'No role'} &middot; {selectedOrg?.name || selectedOrg?.id || 'No org'}
        </p>
      </div>

      {/* Context switcher */}
      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
            <Shield className="h-3 w-3" /> Role
          </label>
          <select
            value={pendingRoleId}
            onChange={handleRoleChange}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="" disabled>Select role...</option>
            {roleList.map(r => (
              <option key={r.id} value={r.id}>{r.name || r.id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
            <Building2 className="h-3 w-3" /> Organization
          </label>
          <select
            value={pendingOrgId}
            onChange={(e) => { setPendingOrgId(e.target.value); setSuccess(false); setError(null); }}
            disabled={orgOptions.length === 0}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            <option value="" disabled>Select org...</option>
            {orgOptions.map(o => (
              <option key={o.id} value={o.id}>{o.name || o.id}</option>
            ))}
          </select>
        </div>

        {needsPassword && (
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <KeyRound className="h-3 w-3" /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder="Your password..."
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {hasChanges && (
          <button
            onClick={handleApply}
            disabled={switching || !pendingRoleId || !pendingOrgId || (needsPassword && !password)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {switching ? (
              <><RefreshCw className="h-3 w-3 animate-spin" /> Switching...</>
            ) : (
              'Apply'
            )}
          </button>
        )}

        {success && (
          <p className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" /> Context updated
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Logout */}
      <div className="border-t px-4 py-2">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>
    </div>
    </>,
    document.body
  );
}

export default function AppSidebar({ menuGroups, expanded, onToggle }) {
  const { username, logout } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname.replace(/^\//, '');
  const activeGroup = findActiveGroup(menuGroups, location.pathname);
  const tMenu = useMenuLabel();

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    if (activeGroup) initial[activeGroup.group] = true;
    return initial;
  });
  const [showUserPopover, setShowUserPopover] = useState(false);

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const width = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <TooltipProvider>
      <nav
        className="fixed inset-y-0 left-0 z-50 flex flex-col bg-[hsl(222,47%,11%)] transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width }}
      >
        {/* Header: logo + toggle */}
        <div className={cn(
          'flex shrink-0 items-center py-3 border-b border-white/10',
          expanded ? 'px-4 gap-3' : 'justify-center'
        )}>
          <img
            src="./favicon.png"
            alt="Etendo"
            className="h-9 w-9 shrink-0 rounded-lg"
          />
          {expanded && (
            <div className="flex flex-col leading-none min-w-0">
              <span className="text-sm font-semibold text-white truncate">Schema Forge</span>
              <span className="text-[10px] text-white/50">ERP Generator</span>
            </div>
          )}
          <button
            onClick={onToggle}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white transition-colors',
              expanded ? 'ml-auto' : 'hidden'
            )}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Expand button (only when collapsed) */}
        {!expanded && (
          <div className="flex justify-center py-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand menu</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Menu groups */}
        <div className="flex-1 overflow-auto py-2">
          {menuGroups.map((g) => {
            const Icon = ICON_MAP[g.icon] || Package;
            const isGroupActive = activeGroup?.group === g.group;
            const color = getSectionColor(tMenu(g.group));
            const isOpen = openGroups[g.group];

            if (!expanded) {
              // Collapsed: icon only
              return (
                <div key={g.group} className="flex justify-center py-0.5">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={`/${g.items[0].name}`}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                          isGroupActive
                            ? 'text-white'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        )}
                        style={isGroupActive ? {
                          borderLeft: `3px solid ${color.accent}`,
                          backgroundColor: color.accent + '25',
                        } : undefined}
                      >
                        <Icon className="h-5 w-5" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">{tMenu(g.group)}</TooltipContent>
                  </Tooltip>
                </div>
              );
            }

            // Expanded: group with collapsible items
            return (
              <div key={g.group}>
                <button
                  onClick={() => toggleGroup(g.group)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                    isGroupActive
                      ? 'text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                  style={isGroupActive ? { borderLeft: `3px solid ${color.accent}` } : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{tMenu(g.group)}</span>
                  <ChevronRight className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-90'
                  )} />
                </button>
                {isOpen && (
                  <div className="ml-7 border-l border-white/10 pl-2 py-0.5">
                    {g.items.map((item) => {
                      const isItemActive = item.name === currentPath;
                      return (
                        <NavLink
                          key={item.name}
                          to={`/${item.name}`}
                          className={cn(
                            'block px-3 py-1.5 text-xs rounded-md transition-colors',
                            isItemActive
                              ? 'text-white bg-white/10 font-medium'
                              : 'text-white/50 hover:text-white hover:bg-white/5'
                          )}
                        >
                          {tMenu(item.label)}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={cn(
          'relative flex flex-col border-t border-white/10 pt-3 pb-3',
          expanded ? 'px-2 gap-1' : 'items-center gap-1.5'
        )}>
          {/* Artifacts */}
          {!expanded ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to="/artifacts"
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                    location.pathname.startsWith('/artifacts')
                      ? 'text-white bg-white/10'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <FileJson className="h-5 w-5" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">Artifacts</TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              to="/artifacts"
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors',
                location.pathname.startsWith('/artifacts')
                  ? 'text-white bg-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <FileJson className="h-4 w-4" />
              <span>Artifacts</span>
            </NavLink>
          )}

          {/* User avatar — click to open popover */}
          {!expanded ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowUserPopover(v => !v)}
                  className="flex h-10 w-10 items-center justify-center cursor-pointer"
                >
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors',
                    showUserPopover ? 'bg-white/30 ring-2 ring-white/40' : 'bg-white/20 hover:bg-white/30'
                  )}>
                    <span className="text-xs font-semibold">{username?.charAt(0).toUpperCase()}</span>
                  </div>
                </button>
              </TooltipTrigger>
              {!showUserPopover && <TooltipContent side="right">{username}</TooltipContent>}
            </Tooltip>
          ) : (
            <button
              onClick={() => setShowUserPopover(v => !v)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer',
                showUserPopover ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                <span className="text-[10px] font-semibold">{username?.charAt(0).toUpperCase()}</span>
              </div>
              <span className="truncate">{username}</span>
            </button>
          )}

          {/* User popover */}
          {showUserPopover && (
            <UserPopover onClose={() => setShowUserPopover(false)} />
          )}
        </div>
      </nav>
    </TooltipProvider>
  );
}
