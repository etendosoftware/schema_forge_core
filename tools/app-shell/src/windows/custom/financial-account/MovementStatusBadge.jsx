import { useUI } from '@/i18n';
import { MOVEMENT_STATUS_TONE } from '@/components/financial-accounts/tokens';
import { cn } from '@/lib/utils';
import { MOVEMENT_STATUS_CONFIG } from './movementStatusConfig';

/**
 * Renders a colored badge for a movement payment status.
 *
 * @param {{ status: string; className?: string }} props
 */
export function MovementStatusBadge({ status, className }) {
  const ui = useUI();
  const config = MOVEMENT_STATUS_CONFIG[status];
  if (!config) return null;

  const tone = MOVEMENT_STATUS_TONE[config.family];
  if (!tone) return null;

  const label = ui(config.labelKey);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ backgroundColor: tone.bg, color: tone.text }}
    >
      {label}
    </span>
  );
}
