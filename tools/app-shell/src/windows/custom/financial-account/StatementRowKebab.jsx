import { MoreVertical, Pencil, PlayCircle, Trash2 } from 'lucide-react';
import { useUI } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

/**
 * Per-row kebab menu for an imported-statement row. Edit / Process / Delete are
 * only enabled for drafts (unprocessed statements); on a processed statement
 * every action is disabled with an explanatory tooltip — processed statements
 * are immutable.
 *
 * @param {{
 *   statement: object,
 *   onEdit: (s: object) => void,
 *   onProcess: (s: object) => void,
 *   onDelete: (s: object) => void,
 * }} props
 */
export function StatementRowKebab({ statement: s, onEdit, onProcess, onDelete }) {
  const ui = useUI();
  const isDraft = s.status === 'DRAFT' || s.processed === 'N';
  const lockedTip = ui('financeAccountStatementsRowProcessedTooltip');

  // A menu item that is active for drafts and disabled (with tooltip) otherwise.
  const draftItem = ({ icon: Icon, label, onClick, testid, danger }) => {
    const item = (
      <DropdownMenuItem
        disabled={!isDraft}
        data-testid={testid}
        onClick={isDraft ? () => onClick(s) : undefined}
      >
        <Icon className={`h-5 w-5 ${danger ? 'text-[#D50B3E]' : 'text-[#828FA3]'}`} />
        <span className={`text-sm font-normal leading-6 ${danger ? 'text-[#D50B3E]' : 'text-[#121217]'}`}>
          {label}
        </span>
      </DropdownMenuItem>
    );
    if (isDraft) return item;
    return (
      <Tooltip>
        <TooltipTrigger asChild><span>{item}</span></TooltipTrigger>
        <TooltipContent>{lockedTip}</TooltipContent>
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
          {draftItem({
            icon: Pencil,
            label: ui('financeAccountStatementsRowEdit'),
            onClick: onEdit,
            testid: 'statement-row-edit',
          })}
          {draftItem({
            icon: PlayCircle,
            label: ui('financeAccountStatementsRowProcess'),
            onClick: onProcess,
            testid: 'statement-row-process',
          })}
          <DropdownMenuSeparator />
          {draftItem({
            icon: Trash2,
            label: ui('financeAccountStatementsRowDelete'),
            onClick: onDelete,
            testid: 'statement-row-delete',
            danger: true,
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
