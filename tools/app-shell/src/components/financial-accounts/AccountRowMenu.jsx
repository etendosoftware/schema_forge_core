import {
  MoreVertical,
  ExternalLink,
  Edit,
  RefreshCw,
  Unplug,
  Archive,
  Plug,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useUI } from '@/i18n';

/**
 * Per-row kebab menu. In T1 only "Abrir cuenta" is active because the rest of
 * the actions depend on features arriving in subsequent stories:
 *   - Edit / Archive → ETP-4096 (T2)
 *   - Sync now / Disconnect / Connect PSD2 → ETP-4097 (T3)
 *
 * Disabled items keep the visual placeholder but stay non-interactive.
 */
export function AccountRowMenu({ account, onOpen }) {
  const ui = useUI();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ui('financeAccountsRowMenuLabel')}
          data-testid={`account-row-menu-trigger-${account.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#828FA3] hover:bg-[#E8EAEF]"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={() => onOpen?.(account)}
          data-testid="account-row-menu-open"
        >
          <ExternalLink className="h-4 w-4" />
          {ui('financeAccountsMenuOpen')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Edit className="h-4 w-4" />
          {ui('financeAccountsMenuEdit')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <RefreshCw className="h-4 w-4" />
          {ui('financeAccountsMenuSyncNow')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Plug className="h-4 w-4" />
          {ui('financeAccountsMenuConnect')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Unplug className="h-4 w-4" />
          {ui('financeAccountsMenuDisconnect')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Archive className="h-4 w-4" />
          {ui('financeAccountsMenuArchive')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
