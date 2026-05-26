import { useUI } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Small dot + label indicating whether a movement has been posted.
 * RPPC → posted (green dot), everything else → not posted (orange dot).
 *
 * @param {{ paymentStatus: string; className?: string }} props
 */
export function PostingStatusDot({ paymentStatus, className }) {
  const ui = useUI();
  const isPosted = paymentStatus === 'RPPC';

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-[#6c6c89]', className)}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isPosted ? 'bg-[#26a95f]' : 'bg-[#E68A00]',
        )}
      />
      {isPosted ? ui('financeAccountMovementsPosted') : ui('financeAccountMovementsNotPosted')}
    </span>
  );
}
