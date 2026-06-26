import { MoreVertical, ExternalLink, GitMerge, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
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
 * Per-row kebab menu for a movement row.
 * Only visible on row hover (parent row must have `group` class).
 *
 * @param {{ movement: object }} props
 */
export function MovementRowKebab({ movement }) {
  const ui = useUI();

  return (
    <TooltipProvider data-testid="TooltipProvider__64eff3">
      <DropdownMenu data-testid="DropdownMenu__64eff3">
        <DropdownMenuTrigger asChild data-testid="DropdownMenuTrigger__64eff3">
          <button
            type="button"
            aria-label={ui('financeAccountMovementsRowActions')}
            data-testid={`movement-row-menu-${movement.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#828FA3] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#E8EAEF]"
          >
            <MoreVertical className="h-5 w-5" data-testid="MoreVertical__64eff3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[220px]"
          data-testid="DropdownMenuContent__64eff3">
          {/* View detail — active */}
          <DropdownMenuItem
            onClick={() => toast(ui('financeAccountMovementsRowViewDetailToast'))}
            data-testid="DropdownMenuItem__64eff3">
            <ExternalLink className="h-5 w-5 text-[#828FA3]" data-testid="ExternalLink__64eff3" />
            <span className="text-sm font-normal leading-6 text-[#121217]">
              {ui('financeAccountMovementsRowViewDetail')}
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator data-testid="DropdownMenuSeparator__64eff3" />

          {/* Unreconcile — disabled with tooltip */}
          <Tooltip data-testid="Tooltip__64eff3">
            <TooltipTrigger asChild data-testid="TooltipTrigger__64eff3">
              <span>
                <DropdownMenuItem disabled data-testid="DropdownMenuItem__64eff3">
                  <GitMerge className="h-5 w-5 text-[#828FA3]" data-testid="GitMerge__64eff3" />
                  <span className="text-sm font-normal leading-6 text-[#121217]">
                    {ui('financeAccountMovementsRowUnreconcile')}
                  </span>
                </DropdownMenuItem>
              </span>
            </TooltipTrigger>
            <TooltipContent data-testid="TooltipContent__64eff3">{ui('financeAccountMovementsRowUnreconcileTooltip')}</TooltipContent>
          </Tooltip>

          {/* Post — disabled with tooltip */}
          <Tooltip data-testid="Tooltip__64eff3">
            <TooltipTrigger asChild data-testid="TooltipTrigger__64eff3">
              <span>
                <DropdownMenuItem disabled data-testid="DropdownMenuItem__64eff3">
                  <BookOpen className="h-5 w-5 text-[#828FA3]" data-testid="BookOpen__64eff3" />
                  <span className="text-sm font-normal leading-6 text-[#121217]">
                    {ui('financeAccountMovementsRowPost')}
                  </span>
                </DropdownMenuItem>
              </span>
            </TooltipTrigger>
            <TooltipContent data-testid="TooltipContent__64eff3">{ui('financeAccountMovementsRowPostTooltip')}</TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
