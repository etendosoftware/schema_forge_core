import { useUI } from '@/i18n';
import { useCopilot } from '@/components/CopilotContext';
import { cn } from '@/lib/utils.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import {
  Search,
  Mic,
  Sparkles,
  Plus,
  Bell,
  MoreVertical,
  Star,
  HelpCircle,
} from 'lucide-react';

function openCommandPalette() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true })
  );
}

export default function TopBar({
  title,
  breadcrumb,
  recordCount,
  menuAction,
  onAddToFavorites,
  isFavorite = false,
  onPageHelp = () => {},
  onSearchClick,
  searchPlaceholder,
  onAIClick,
  onNewClick,
  onBellClick,
  rightExtras,
  className,
}) {
  const ui = useUI();
  const copilot = useCopilot();

  const resolvedPlaceholder = searchPlaceholder ?? ui('searchPlaceholder');
  const handleSearchClick = onSearchClick ?? openCommandPalette;
  const handleAIClick = onAIClick ?? copilot?.toggle;

  const hasMenu = onAddToFavorites || onPageHelp || menuAction;

  return (
    <TooltipProvider>
      <header
        className={cn(
          'flex h-[62px] shrink-0 items-center gap-4 pl-0 pr-6 bg-page-bg',
          className
        )}
      >
        {/* Left: title + breadcrumb + 3-dot menu */}
        {title && (
          <div className="flex items-center gap-1 shrink-0 min-w-0">
            <div className="flex flex-col justify-center items-start min-w-0 h-12">
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold leading-8 text-text-primary truncate">
                  {title}
                </span>
                {recordCount != null && (
                  <span className="inline-flex items-center justify-center w-7 h-6 px-2 py-1 text-xs font-medium text-muted-foreground bg-page-bg border border-[#D1D4DB] rounded-lg shrink-0">
                    {recordCount}
                  </span>
                )}
              </div>
              {breadcrumb && (
                <span className="text-xs text-topbar-breadcrumb truncate">
                  {breadcrumb}
                </span>
              )}
            </div>

            {hasMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={ui('more')}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-topbar-icon hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {onAddToFavorites && (
                    <DropdownMenuItem onClick={onAddToFavorites}>
                      <Star
                        className={cn(
                          'h-4 w-4 mr-2',
                          isFavorite
                            ? 'fill-accent-highlight text-accent-highlight'
                            : 'text-muted-foreground'
                        )}
                      />
                      {isFavorite ? ui('removeFromFavorites') : ui('addToFavorites')}
                    </DropdownMenuItem>
                  )}
                  {onPageHelp && (
                    <DropdownMenuItem onClick={onPageHelp}>
                      <HelpCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                      {ui('pageHelp')}
                    </DropdownMenuItem>
                  )}
                  {menuAction && (onAddToFavorites || onPageHelp) && (
                    <DropdownMenuSeparator />
                  )}
                  {menuAction && (
                    <DropdownMenuItem
                      onClick={menuAction.onClick}
                      disabled={menuAction.disabled}
                    >
                      {menuAction.icon && (
                        <menuAction.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      )}
                      {menuAction.label}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {/* Center: search */}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={handleSearchClick}
            className="relative flex h-9 w-full max-w-xl items-center gap-2 rounded-full bg-search-bg px-4 text-sm hover:bg-search-bg/80 transition-colors"
          >
            <Search className="h-4 w-4 shrink-0 text-search-placeholder" />
            <span className="flex-1 text-left truncate text-search-placeholder">
              {resolvedPlaceholder}
            </span>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={ui('searchWithVoice')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-search-placeholder"
                >
                  <Mic className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{ui('searchWithVoice')}</TooltipContent>
            </Tooltip>
          </button>
        </div>

        {/* Right: action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleAIClick}
                aria-label={ui('aiAssistant')}
                className="copilot-btn flex h-10 w-10 items-center justify-center rounded-lg text-topbar-icon transition-colors"
              >
                <Sparkles className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{ui('aiAssistant')}</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNewClick}
                aria-label={ui('newRecord')}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-topbar-icon hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{ui('newRecord')}</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onBellClick}
                aria-label={ui('notifications')}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-topbar-icon hover:text-foreground hover:bg-muted transition-colors"
              >
                <Bell className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{ui('notifications')}</TooltipContent>
          </Tooltip>

          {rightExtras}
        </div>
      </header>
    </TooltipProvider>
  );
}
