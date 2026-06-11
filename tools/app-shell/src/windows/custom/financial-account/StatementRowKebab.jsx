import { MoreVertical, PlayCircle, RotateCcw } from 'lucide-react';
import { useUI } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

/**
 * Per-row kebab menu for an imported-statement row. Holds the state-transition
 * actions: "Procesar" (enabled only for drafts) and "Reactivar" (enabled only
 * for processed statements). The non-applicable one renders disabled with an
 * explanatory tooltip.
 *
 * Edit and Delete are NOT here — they live as inline hover quick-actions on the
 * row (see {@link StatementsTable}), mirroring the sales-order grid.
 *
 * @param {{
 *   statement: object,
 *   onProcess: (s: object) => void,
 *   onReactivate: (s: object) => void,
 * }} props
 */
export function StatementRowKebab({ statement: s, onProcess, onReactivate }) {
  const ui = useUI();
  const isDraft = s.status === 'DRAFT' || s.processed === 'N';
  const lockedTip = ui('financeAccountStatementsRowProcessedTooltip');
  const reactivateTip = ui('financeAccountStatementsRowReactivateTooltip');

  // A menu item active only when `enabled`, otherwise disabled with a tooltip.
  const gatedItem = ({ icon: Icon, label, onClick, testid, enabled, tip }) => {
    const item = (
      <DropdownMenuItem
        disabled={!enabled}
        data-testid={testid}
        onClick={enabled ? () => onClick(s) : undefined}
      >
        <Icon className="h-5 w-5 text-[#828FA3]" />
        <span className="text-sm font-normal leading-6 text-[#121217]">{label}</span>
      </DropdownMenuItem>
    );
    if (enabled) return item;
    return (
      <Tooltip>
        <TooltipTrigger asChild><span>{item}</span></TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={ui('financeAccountStatementsRowActions')}
            data-testid={`statement-row-menu-${s.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#828FA3] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#E8EAEF]"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]" onClick={(e) => e.stopPropagation()}>
          {gatedItem({
            icon: PlayCircle,
            label: ui('financeAccountStatementsRowProcess'),
            onClick: onProcess,
            testid: 'statement-row-process',
            enabled: isDraft,
            tip: lockedTip,
          })}
          {gatedItem({
            icon: RotateCcw,
            label: ui('financeAccountStatementsRowReactivate'),
            onClick: onReactivate,
            testid: 'statement-row-reactivate',
            enabled: !isDraft,
            tip: reactivateTip,
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
