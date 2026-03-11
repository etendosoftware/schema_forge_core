import { useState } from 'react';
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

/**
 * Determines which menu group is active based on current route.
 * Returns the group object or null.
 */
export function findActiveGroup(menuGroups, pathname) {
  const currentPath = pathname.replace(/^\//, '');
  return menuGroups.find((g) =>
    g.items.some((item) => item.name === currentPath)
  ) || null;
}

function SidebarIcon({ icon, label, to, isActive }) {
  const Icon = ICON_MAP[icon] || Package;
  const color = getSectionColor(label);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            isActive
              ? 'text-white'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          )}
          style={isActive ? {
            borderLeft: `3px solid ${color.accent}`,
            backgroundColor: color.accent + '25',
          } : undefined}
        >
          <Icon className="h-5 w-5" />
          <span className="sr-only">{label}</span>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ExpandedPanel({ menuGroups, activeGroup, tMenu, onClose }) {
  const location = useLocation();
  const currentPath = location.pathname.replace(/^\//, '');
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    if (activeGroup) initial[activeGroup.group] = true;
    return initial;
  });

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="fixed inset-y-0 left-[60px] z-40 w-56 bg-[hsl(222,47%,14%)] border-r border-white/10 flex flex-col shadow-xl animate-in slide-in-from-left-2 duration-150">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white">Menu</span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {menuGroups.map((g) => {
          const Icon = ICON_MAP[g.icon] || Package;
          const isOpen = openGroups[g.group];
          const isGroupActive = activeGroup?.group === g.group;
          const color = getSectionColor(tMenu(g.group));

          return (
            <div key={g.group}>
              <button
                onClick={() => toggleGroup(g.group)}
                className={cn(
                  'flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors',
                  isGroupActive
                    ? 'text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
                style={isGroupActive ? { borderLeft: `3px solid ${color.accent}` } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{tMenu(g.group)}</span>
                <ChevronRight className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                  isOpen && 'rotate-90'
                )} />
              </button>
              {isOpen && (
                <div className="ml-6 border-l border-white/10 pl-2 py-1">
                  {g.items.map((item) => {
                    const isItemActive = item.name === currentPath;
                    return (
                      <NavLink
                        key={item.name}
                        to={`/${item.name}`}
                        onClick={onClose}
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
    </div>
  );
}

export default function AppSidebar({ menuGroups }) {
  const { username, logout } = useAuth();
  const location = useLocation();
  const activeGroup = findActiveGroup(menuGroups, location.pathname);
  const tMenu = useMenuLabel();
  const [expanded, setExpanded] = useState(false);

  return (
    <TooltipProvider>
      <nav className="fixed inset-y-0 left-0 z-50 flex w-[60px] flex-col items-center bg-[hsl(222,47%,11%)] py-3">
        {/* Logo */}
        <div className="mb-2 flex h-10 w-10 shrink-0 items-center justify-center">
          <img
            src="/favicon.png"
            alt="Etendo"
            className="h-9 w-9 rounded-lg"
          />
        </div>

        {/* Expand toggle */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md mb-2 transition-colors',
                expanded
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:bg-white/10 hover:text-white'
              )}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {expanded ? 'Close menu' : 'Expand menu'}
          </TooltipContent>
        </Tooltip>

        {/* Menu groups */}
        <div className="flex flex-1 flex-col items-center gap-1.5">
          {menuGroups.map((g) => (
            <SidebarIcon
              key={g.group}
              icon={g.icon}
              label={tMenu(g.group)}
              to={`/${g.items[0].name}`}
              isActive={activeGroup?.group === g.group}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1.5 border-t border-white/10 pt-3">
          <SidebarIcon
            icon="FileJson"
            label="Artifacts"
            to="/artifacts"
            isActive={location.pathname.startsWith('/artifacts')}
          />

          {/* User avatar */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex h-10 w-10 items-center justify-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">
                  <span className="text-xs font-semibold">
                    {username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{username}</TooltipContent>
          </Tooltip>

          {/* Logout */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        </div>
      </nav>

      {/* Expanded menu panel */}
      {expanded && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setExpanded(false)}
          />
          <ExpandedPanel
            menuGroups={menuGroups}
            activeGroup={activeGroup}
            tMenu={tMenu}
            onClose={() => setExpanded(false)}
          />
        </>
      )}
    </TooltipProvider>
  );
}
