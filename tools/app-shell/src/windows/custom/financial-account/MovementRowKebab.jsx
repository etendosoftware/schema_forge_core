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
    <TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Movement actions"
            data-testid={`movement-row-menu-${movement.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#828FA3] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#E8EAEF]"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]">
          {/* View detail — active */}
          <DropdownMenuItem
            onClick={() => toast(ui('financeAccountMovementsRowViewDetailToast'))}
          >
            <ExternalLink className="h-5 w-5 text-[#828FA3]" />
            <span className="text-sm font-normal leading-6 text-[#121217]">
              {ui('financeAccountMovementsRowViewDetail')}
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Unreconcile — disabled with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <DropdownMenuItem disabled>
                  <GitMerge className="h-5 w-5 text-[#828FA3]" />
                  <span className="text-sm font-normal leading-6 text-[#121217]">
                    {ui('financeAccountMovementsRowUnreconcile')}
                  </span>
                </DropdownMenuItem>
              </span>
            </TooltipTrigger>
            <TooltipContent>{ui('financeAccountMovementsRowUnreconcileTooltip')}</TooltipContent>
          </Tooltip>

          {/* Post — disabled with tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <DropdownMenuItem disabled>
                  <BookOpen className="h-5 w-5 text-[#828FA3]" />
                  <span className="text-sm font-normal leading-6 text-[#121217]">
                    {ui('financeAccountMovementsRowPost')}
                  </span>
                </DropdownMenuItem>
              </span>
            </TooltipTrigger>
            <TooltipContent>{ui('financeAccountMovementsRowPostTooltip')}</TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
