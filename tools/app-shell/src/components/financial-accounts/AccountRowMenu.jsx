import {
  MoreVertical,
  ExternalLink,
  Pencil,
  Archive,
  Link2,
  RefreshCw,
  Unlink2,
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
import { ACCOUNT_TYPE } from './tokens';

/**
 * Per-row kebab menu. Shows every action available on a financial account so
 * the surface matches the Figma `3012:25602` mock end-to-end, even before the
 * downstream features ship. Items follow this order:
 *
 *   1. Abrir cuenta             (interactive in T1, navigates to the detail)
 *   2. Editar conexión PSD2     (disabled — wired by ETP-4097 / T3)
 *   3. Sincronizar ahora        (disabled — wired by ETP-4097 / T3)
 *   ───
 *   4. Conectar PSD2            (disabled — wired by ETP-4097 / T3)
 *   5. Desconectar PSD2         (disabled — wired by ETP-4097 / T3)
 *
 * Cash accounts (type=C) never expose the PSD2 group because the connection
 * does not apply to manual cash drawers.
 */
export function AccountRowMenu({ account, onOpen, onEdit, onArchive }) {
  const ui = useUI();
  const isCash = account.type === ACCOUNT_TYPE.CASH;

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
      <DropdownMenuContent align="end" className="w-[235px]">
        <DropdownMenuItem
          onClick={() => onOpen?.(account)}
          data-testid={`account-row-menu-open-${account.id}`}
        >
          <ExternalLink className="h-5 w-5 text-[#828FA3]" />
          <span className="text-sm font-normal leading-6 text-[#121217]">
            {ui('financeAccountsMenuOpen')}
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onEdit?.(account)}
          data-testid={`account-row-menu-edit-${account.id}`}
        >
          <Pencil className="h-5 w-5 text-[#828FA3]" />
          <span className="text-sm font-normal leading-6 text-[#121217]">
            {ui('financeAccountsMenuEdit')}
          </span>
        </DropdownMenuItem>

        {!isCash ? (
          <>
            <DropdownMenuItem disabled>
              <Link2 className="h-5 w-5 text-[#828FA3]" />
              <span className="text-sm font-normal leading-6 text-[#121217]">
                {ui('financeAccountsMenuEditPsd2')}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <RefreshCw className="h-5 w-5 text-[#828FA3]" />
              <span className="text-sm font-normal leading-6 text-[#121217]">
                {ui('financeAccountsMenuSyncNow')}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Plug className="h-5 w-5 text-[#828FA3]" />
              <span className="text-sm font-normal leading-6 text-[#121217]">
                {ui('financeAccountsMenuConnect')}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Unlink2 className="h-5 w-5 text-[#828FA3]" />
              <span className="text-sm font-normal leading-6 text-[#121217]">
                {ui('financeAccountsMenuDisconnect')}
              </span>
            </DropdownMenuItem>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onArchive?.(account)}
          data-testid={`account-row-menu-archive-${account.id}`}
        >
          <Archive className="h-5 w-5 text-[#D50B3E]" />
          <span className="text-sm font-normal leading-6 text-[#D50B3E]">
            {ui('financeAccountsMenuArchive')}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
