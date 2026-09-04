import { MousePointer2 } from 'lucide-react';
import { cn } from '../lib/utils.js';

/**
 * The animated pointer that shows the user the real path through the side menu.
 *
 * Three properties are non-negotiable, and all three are structural rather than
 * conventional:
 *
 *  1. `pointer-events: none` — a decorative pointer that can be hit would eat
 *     the very clicks the walkthrough is dispatching, and any real click the
 *     user makes near it.
 *  2. `aria-hidden` — there is no pointer to announce. A screen reader user
 *     gets the step card's text, which is the actual instruction.
 *  3. It renders as the LAST child of the overlay's stacking context, so it
 *     paints above the scrim and the spotlight without introducing a second
 *     z-index tier. It is also torn down with the overlay, which is what makes
 *     the single-teardown guarantee hold: there is no separate portal to leak.
 *
 * Travel is a CSS transition whose duration is handed in per hop, so
 * `prefers-reduced-motion` is expressed as `durationMs === 0` (jump straight
 * there) rather than as a second code path.
 */
export function WalkthroughCursor({ visible, x, y, durationMs = 0, pressed = false }) {
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="walkthrough-cursor"
      data-walkthrough-cursor-pressed={pressed ? 'true' : 'false'}
      className="pointer-events-none fixed left-0 top-0"
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
        transition: durationMs > 0
          ? `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
          : 'none',
        willChange: 'transform',
      }}
    >
      {/* Offset so the pointer's TIP, not its bounding box, sits on the target. */}
      <div className="relative -left-1 -top-1">
        {pressed && (
          <span
            className="absolute -left-4 -top-4 block h-16 w-16 rounded-full bg-primary/30"
            data-testid="walkthrough-cursor-ring"
          />
        )}
        <MousePointer2
          className={cn(
            'relative h-12 w-12 fill-primary text-primary-foreground drop-shadow-md transition-transform',
            pressed && 'scale-90',
          )}
          data-testid="MousePointer2__wtc"
        />
      </div>
    </div>
  );
}
