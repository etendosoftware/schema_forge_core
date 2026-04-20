import { useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.jsx';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { UserAvatarButton } from '@/components/UserAvatarButton.jsx';
import {
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
  ChevronDown,
  Headphones,
  FileJson,
} from 'lucide-react';
import {
  ClipboardText as ClipboardCheck,
  House,
  Star,
  IdentificationCard,
  ShareNetwork,
  TrendUp,
  Receipt,
  Bank,
  Package,
  Briefcase,
  Users,
  Presentation,
  Plug,
  Gear,
  Flask,
  SquaresFour,
  Eye,
  FileCode,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils.js';
import { useMenuLabel, useUI } from '@/i18n';
import { useFavorites } from '@/components/layout/FavoritesContext';

const ICON_MAP = {
  ClipboardCheck,
  Home:           House,
  Star,
  Contact2:       IdentificationCard,
  Share2:         ShareNetwork,
  TrendingUp:     TrendUp,
  Receipt,
  Building2:      Bank,
  Package,
  Briefcase,
  Users,
  Presentation,
  Plug,
  Settings:       Gear,
  FlaskConical:   Flask,
  LayoutDashboard: SquaresFour,
  Eye,
  FileJson:       FileCode,
};

function CollapsedGroupPopover({
  group,
  iconKey,
  isGroupActive,
  items,
  currentPath,
  locationSearch,
  tMenu,
  emptyLabel,
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const GroupIcon = ICON_MAP[iconKey] || Package;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={tMenu(group)}
          onMouseEnter={() => { cancelClose(); setOpen(true); }}
          onMouseLeave={scheduleClose}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            isGroupActive
              ? 'bg-accent-highlight text-accent-highlight-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <GroupIcon weight={isGroupActive ? 'fill' : 'regular'} className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        sideOffset={8}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className="w-52 p-0 overflow-hidden"
      >
        <p className="px-3 pt-3 pb-1 text-xs font-semibold text-[#6C6C89] uppercase tracking-wide">
          {tMenu(group)}
        </p>
        <div className="pb-2">
          {items.length === 0 && emptyLabel && (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">
              {emptyLabel}
            </p>
          )}
          {items.map((item) => {
            const itemPath = item.path || item.name;
            const currentFull = currentPath + locationSearch;
            const isItemActive = item.path?.includes('?')
              ? currentFull === itemPath
              : currentPath === item.name;
            return (
              <NavLink
                key={item.name}
                to={`/${itemPath}`}
                className={cn(
                  'flex w-full items-center px-3 py-2 text-sm transition-colors',
                  isItemActive
                    ? 'bg-accent-highlight text-accent-highlight-foreground font-semibold'
                    : 'text-foreground hover:bg-muted/50'
                )}
              >
                {tMenu(item.label)}
              </NavLink>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function findActiveGroup(menuGroups, pathname, search) {
  const currentPath = pathname.replace(/^\//, '');
  const currentFull = currentPath + (search || '');
  return menuGroups.find((g) =>
    g.items.some((item) => {
      const itemPath = item.path || item.name;
      if (item.path && item.path.includes('?')) {
        return currentFull === itemPath;
      }
      return item.name === currentPath;
    })
  ) || null;
}

const COLLAPSED_W = 60;
const EXPANDED_W = 240;

export default function SideMenu({
  menuGroups,
  expanded,
  onToggle,
  onHelpClick,
  logoSrc = '/favicon.png',
}) {
  const { selectedOrg } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname.replace(/^\//, '');
  const { favorites } = useFavorites();

  const resolvedMenuGroups = menuGroups.map((g) => {
    if (g.group !== 'Favorites') return g;
    return { ...g, items: favorites };
  });

  const activeGroup = findActiveGroup(resolvedMenuGroups, location.pathname, location.search);
  const tMenu = useMenuLabel();
  const ui = useUI();

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    if (activeGroup) initial[activeGroup.group] = true;
    return initial;
  });
  const [helpOpen, setHelpOpen] = useState(false);

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleHelpClick = () => {
    if (typeof onHelpClick === 'function') {
      onHelpClick();
      return;
    }
    setHelpOpen(true);
  };

  const width = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <TooltipProvider>
      <nav
        aria-label={ui('navigation')}
        className="fixed inset-y-0 left-0 z-40 flex flex-col bg-page-bg transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width }}
      >
        {/* Header */}
        {expanded ? (
          <div className="relative flex shrink-0 items-center h-[62px] px-3 gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={ui('switchCompany')}
                  className="flex flex-1 min-w-0 items-center gap-2 h-10 pl-1 pr-2 rounded-full bg-muted/60 hover:bg-muted transition-colors"
                >
                  <img
                    src={logoSrc}
                    alt="Etendo"
                    className="h-8 w-8 shrink-0 rounded-full"
                  />
                  <span className="flex-1 text-left text-sm font-semibold text-foreground truncate">
                    {selectedOrg?.name || ui('yourCompany')}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{ui('switchCompany')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <img
                    src={logoSrc}
                    alt=""
                    className="h-5 w-5 mr-2 rounded-full"
                  />
                  <span className="flex-1 truncate">
                    {selectedOrg?.name || ui('yourCompany')}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={onToggle}
              aria-label={ui('collapseMenu')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <div className="absolute bottom-0 left-3 right-3 border-t border-border/50" />
          </div>
        ) : (
          <div className="relative flex justify-center items-center h-[62px]">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label={ui('expandMenu')}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{ui('expandMenu')}</TooltipContent>
            </Tooltip>
            <div className="absolute bottom-0 left-2 right-2 border-t border-border/50" />
          </div>
        )}

        {/* Menu groups */}
        <div className="flex-1 overflow-auto py-2 sidebar-scroll">
          {resolvedMenuGroups.map((g, gIdx) => {
            const prevSection = gIdx > 0 ? resolvedMenuGroups[gIdx - 1].section : null;
            const showSectionLabel = expanded && g.section && g.section !== prevSection;
            const Icon = ICON_MAP[g.icon] || Package;
            const isGroupActive = activeGroup?.group === g.group;
            const isOpen = openGroups[g.group];
            const visibleItems = g.items.filter(i => !i.hidden);
            const isDirect = visibleItems.length === 1;

            /* ── COLLAPSED ── */
            if (!expanded) {
              if (isDirect) {
                const singleItem = visibleItems[0];
                const itemPath = singleItem.path || singleItem.name;
                const isItemActive = singleItem.path?.includes('?')
                  ? (currentPath + location.search) === itemPath
                  : currentPath === singleItem.name;
                return (
                  <div
                    key={g.group}
                    className={cn(
                      'flex justify-center py-0.5 border-l-[3px] transition-colors',
                      isItemActive || isGroupActive ? 'border-accent-highlight' : 'border-transparent'
                    )}
                  >
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={`/${itemPath}`}
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                            isItemActive || isGroupActive
                              ? 'bg-accent-highlight text-accent-highlight-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <Icon weight={isItemActive || isGroupActive ? 'fill' : 'regular'} className="h-5 w-5" />
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent side="right">{tMenu(singleItem.label)}</TooltipContent>
                    </Tooltip>
                  </div>
                );
              }

              return (
                <div
                  key={g.group}
                  className={cn(
                    'flex justify-center py-0.5 border-l-[3px] transition-colors',
                    isGroupActive ? 'border-accent-highlight' : 'border-transparent'
                  )}
                >
                  <CollapsedGroupPopover
                    group={g.group}
                    iconKey={g.icon}
                    isGroupActive={isGroupActive}
                    items={g.items}
                    currentPath={currentPath}
                    locationSearch={location.search}
                    tMenu={tMenu}
                    emptyLabel={g.group === 'Favorites' ? ui('noFavoritesYet') : null}
                  />
                </div>
              );
            }

            /* ── EXPANDED — direct link ── */
            if (isDirect) {
              const singleItem = visibleItems[0];
              const itemPath = singleItem.path || singleItem.name;
              const isItemActive = singleItem.path?.includes('?')
                ? (currentPath + location.search) === itemPath
                : currentPath === singleItem.name;
              return (
                <div key={g.group}>
                  {showSectionLabel && (
                    <div className="px-4 pt-4 pb-1">
                      <span className="text-xs text-[#6C6C89]">
                        {tMenu(g.section)}
                      </span>
                    </div>
                  )}
                  <NavLink
                    to={`/${itemPath}`}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors border-l-[3px]',
                      isItemActive || isGroupActive
                        ? 'bg-accent-highlight text-accent-highlight-foreground font-medium border-accent-highlight'
                        : 'hover:bg-muted/50 border-transparent'
                    )}
                  >
                    <Icon weight={isItemActive || isGroupActive ? 'fill' : 'regular'} className={cn('h-5 w-5 shrink-0', !(isItemActive || isGroupActive) && 'text-muted-foreground')} />
                    <span className={cn('flex-1 text-left truncate', !(isItemActive || isGroupActive) && 'text-text-primary')}>{tMenu(singleItem.label)}</span>
                  </NavLink>
                </div>
              );
            }

            /* ── EXPANDED — group with sub-items ── */
            const GroupIcon = Icon;
            return (
              <div key={g.group}>
                {showSectionLabel && (
                  <div className="px-4 pt-4 pb-1">
                    <span className="text-xs text-[#6C6C89]">
                      {tMenu(g.section)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleGroup(g.group)}
                  aria-expanded={!!isOpen}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors border-l-[3px]',
                    isGroupActive && !isOpen
                      ? 'bg-accent-highlight text-accent-highlight-foreground font-medium border-accent-highlight'
                      : isGroupActive
                        ? 'font-medium hover:bg-muted/50 border-accent-highlight'
                        : 'hover:bg-muted/50 border-transparent'
                  )}
                >
                  <GroupIcon weight={isGroupActive ? 'fill' : 'regular'} className={cn('h-5 w-5 shrink-0', !isGroupActive && 'text-muted-foreground')} />
                  <span className={cn('flex-1 text-left truncate', !(isGroupActive && !isOpen) && 'text-text-primary')}>{tMenu(g.group)}</span>
                  <ChevronDown className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-muted-foreground',
                    isOpen && 'rotate-180'
                  )} />
                </button>
                {isOpen && (
                  <div className="py-0.5">
                    {g.items.length === 0 && g.group === 'Favorites' && (
                      <p className="pl-10 pr-4 py-1.5 text-xs text-muted-foreground italic">
                        {ui('noFavoritesYet')}
                      </p>
                    )}
                    {g.items.map((item) => {
                      const itemPath = item.path || item.name;
                      const currentFull = currentPath + location.search;
                      const isItemActive = item.path?.includes('?')
                        ? currentFull === itemPath
                        : currentPath === item.name;
                      return (
                        <NavLink
                          key={item.name}
                          to={`/${itemPath}`}
                          className={cn(
                            'relative flex w-full items-center pl-10 pr-4 py-1.5 text-sm transition-colors',
                            isItemActive
                              ? 'text-accent-highlight-foreground/80 font-semibold'
                              : 'text-text-primary hover:bg-muted/50'
                          )}
                        >
                          <span className={cn(
                            'absolute left-[22px] top-0 bottom-0',
                            isItemActive ? 'right-2 bg-accent-highlight' : 'w-0.5 bg-border'
                          )} />
                          <span className="relative z-10">{tMenu(item.label)}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pinned footer: Help + user */}
        <div className={cn(
          'flex flex-col shrink-0 border-t border-border/50 pt-2 pb-2',
          expanded ? 'px-2 gap-1' : 'items-center gap-1.5'
        )}>
          {!expanded ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleHelpClick}
                  aria-label={ui('helpAndSupport')}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Headphones className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{ui('helpAndSupport')}</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={handleHelpClick}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Headphones className="h-4 w-4" />
              </span>
              <span className="flex-1 text-left truncate">{ui('helpAndSupport')}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}

          <div className={cn(
            'flex items-center',
            expanded ? '' : 'justify-center'
          )}>
            <UserAvatarButton expanded={expanded} />
          </div>

          {import.meta.env.VITE_SHOW_ARTIFACTS === 'true' && (
            !expanded ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <NavLink
                    to="/artifacts"
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                      location.pathname.startsWith('/artifacts')
                        ? 'text-foreground bg-muted'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <FileJson className="h-5 w-5" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{tMenu('Artifacts')}</TooltipContent>
              </Tooltip>
            ) : (
              <NavLink
                to="/artifacts"
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors',
                  location.pathname.startsWith('/artifacts')
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <FileJson className="h-4 w-4" />
                <span>{tMenu('Artifacts')}</span>
              </NavLink>
            )
          )}
        </div>
      </nav>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ui('helpAndSupport')}</DialogTitle>
            <DialogDescription>{ui('helpComingSoon')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHelpOpen(false)}>
              {ui('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
