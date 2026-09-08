import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Check, GraduationCap, Package, Play, ShoppingCart, UserPlus } from 'lucide-react';
import { useStepText } from './useStepText.js';
import { useWalkthrough } from './WalkthroughProvider.jsx';
import { useUI } from '../i18n/useUI.js';
import { useObservability } from '../observability/ObservabilityContext.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.jsx';
import {
  countPendingFlows,
  FLOW_STATUS,
  getFlowStatus,
  isFlowDismissed,
  markFlowDismissed,
  markFlowStarted,
  markFlowUndismissed,
} from './walkthroughProgress.js';

/**
 * Icons a flow's free-form `icon` name may resolve to. These are lucide
 * identifiers, not domain concepts: a flow names one and an unknown value falls
 * back to a generic glyph, so adding a flow never needs a code change here.
 * A host with its own set passes `icons` to merge into this.
 */
const DEFAULT_FLOW_ICONS = { UserPlus, Package, ShoppingCart };

/**
 * Per-status badge rendering. `completed` gets a mute check rather than a
 * worded badge -- it is the resting state, and labelling it competes for
 * attention with the statuses that actually ask for something.
 */
const STATUS_BADGES = {
  [FLOW_STATUS.UNSEEN]: {
    labelKey: 'walkthroughBadgeNew',
    className: 'bg-primary/10 text-primary',
  },
  [FLOW_STATUS.UPDATED]: {
    labelKey: 'walkthroughBadgeUpdated',
    className: 'bg-primary/10 text-primary',
  },
  [FLOW_STATUS.IN_PROGRESS]: {
    labelKey: 'walkthroughBadgeInProgress',
    className: 'bg-muted text-muted-foreground',
  },
};

/**
 * Badge for a tutorial the user silenced. It REPLACES the status badge (a
 * dismissed tour still reading "New" contradicts the dot it just turned off)
 * but keeps the row a normal, startable menu item -- dismissal hides the
 * reminder, it does not retire the content.
 */
const DISMISSED_BADGE = {
  labelKey: 'walkthroughBadgeDismissed',
  className: 'bg-muted text-muted-foreground',
};

/** Where a run was launched from. Only this launcher exists today. */
const SOURCE_LAUNCHER = 'launcher';

/** `action` on the dismissal event: which way the toggle went. */
const DISMISS_ACTION = Object.freeze({ DISMISSED: 'dismissed', RESTORED: 'restored' });

/**
 * Topbar entry point for the guided walkthroughs: the flow list, a per-flow
 * "you have not taken this" badge, a dot on the button while anything is
 * unfinished, and a per-flow "mark as read" toggle for a user who already knows
 * the system and wants the dot to go out without sitting through the tour.
 *
 * Dismissal is per tutorial, not one global switch, precisely so WHICH tours
 * get silenced is reportable -- that is the product signal the
 * `trackWalkthroughDismissed` event exists to carry.
 *
 * Telemetry is INJECTED, never imported: this component describes what happened
 * and the host maps it onto whatever analytics contract it owns (see
 * `observability/ObservabilityContext.jsx`, whose defaults are no-ops, so the
 * component works with no provider at all). That is what keeps the launcher
 * usable by a host with different -- or no -- telemetry.
 *
 * Renders nothing when there is no provider above it or no flow to offer, so it
 * can sit unconditionally in a topbar.
 *
 * @param {{icons?: Record<string, unknown>}} props
 */
export function WalkthroughLauncher({ icons }) {
  const ui = useUI();
  const stepText = useStepText();
  const { available, flows, start, isRunning } = useWalkthrough();
  const {
    trackWalkthroughMenuOpened,
    trackWalkthroughStarted,
    trackWalkthroughDismissed,
  } = useObservability();

  const flowIcons = useMemo(() => ({ ...DEFAULT_FLOW_ICONS, ...icons }), [icons]);

  // Progress lives in `localStorage`, so it is read imperatively into state
  // rather than derived: nothing re-renders this component when it changes.
  const [progress, setProgress] = useState({ statuses: {}, dismissed: {}, pending: 0 });

  // Keyed by CONTENT, not by array identity. `refresh` runs from an effect and
  // writes state, so if it were rebuilt on every render (which it would be for
  // a host that rebuilds its `flows` array inline) the effect below would loop
  // forever. A string key compares by value, so the memo and the callback below
  // stay stable as long as the flows themselves do.
  const flowsKey = flows.map((flow) => `${flow.id}@${flow.revision ?? 1}`).join('|');
  const flowList = useMemo(
    () => flows.map((flow) => ({ id: flow.id, revision: flow.revision ?? 1, steps: flow.steps })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on flowsKey by design, see above
    [flowsKey],
  );

  const refresh = useCallback(() => {
    setProgress({
      statuses: Object.fromEntries(
        flowList.map((flow) => [flow.id, getFlowStatus(flow.id, flow.revision)]),
      ),
      // Kept beside the status rather than folded into it: dismissal is a
      // second, orthogonal axis (see `walkthroughProgress.js`), and the row
      // needs both to pick a badge and to label its toggle.
      dismissed: Object.fromEntries(
        flowList.map((flow) => [flow.id, isFlowDismissed(flow.id, flow.revision)]),
      ),
      pending: countPendingFlows(flowList),
    });
  }, [flowList]);

  // Re-read on mount and whenever a run ends: finishing a tour must move its
  // badge to `completed` without a reload. `isRunning` going false is the only
  // signal this component gets that progress may have changed.
  useEffect(() => {
    if (isRunning) return;
    refresh();
  }, [isRunning, refresh]);

  const handleOpenChange = useCallback((open) => {
    if (!open) return;
    trackWalkthroughMenuOpened?.({ count: countPendingFlows(flowList), total: flowList.length });
    // Opening the list does NOT clear the dot -- it stays lit while anything is
    // unfinished (see `countPendingFlows`). Still refresh: a run that ended
    // while this menu was closed must show its new badge.
    refresh();
  }, [flowList, refresh, trackWalkthroughMenuOpened]);

  const handleSelect = useCallback((flow) => {
    // Report before marking: the status handed to the host is the one the flow
    // held BEFORE this run, which is what tells a first-timer from a repeater
    // from someone returning to a revised tour.
    trackWalkthroughStarted?.({
      flowId: flow.id,
      status: getFlowStatus(flow.id, flow.revision ?? 1),
      total: flow.steps?.length ?? 0,
      source: SOURCE_LAUNCHER,
    });
    markFlowStarted(flow.id);
    start(flow.id);
  }, [start, trackWalkthroughStarted]);

  /**
   * The per-row "mark as read" toggle.
   *
   * Reports BEFORE writing, like `handleSelect`: the status carried by the
   * event is the one the flow held at the moment the user silenced it, which is
   * the whole product question ("are people dismissing tours they never
   * opened, or ones they gave up on?").
   */
  const handleToggleDismissed = useCallback((flow) => {
    const revision = flow.revision ?? 1;
    const wasDismissed = isFlowDismissed(flow.id, revision);
    trackWalkthroughDismissed?.({
      flowId: flow.id,
      status: getFlowStatus(flow.id, revision),
      action: wasDismissed ? DISMISS_ACTION.RESTORED : DISMISS_ACTION.DISMISSED,
      source: SOURCE_LAUNCHER,
    });
    if (wasDismissed) {
      markFlowUndismissed(flow.id);
    } else {
      markFlowDismissed(flow.id, revision);
    }
    refresh();
  }, [refresh, trackWalkthroughDismissed]);

  const pendingLabel = useMemo(
    () => (progress.pending > 0
      ? `${ui('walkthroughLauncherTooltip')} — ${ui('walkthroughPendingHint', { count: progress.pending })}`
      : ui('walkthroughLauncherTooltip')),
    [progress.pending, ui],
  );

  if (!available || flows.length === 0) return null;

  return (
    <DropdownMenu onOpenChange={handleOpenChange} data-testid="WalkthroughLauncherMenu__wtl">
      <Tooltip delayDuration={0} data-testid="Tooltip__wtl">
        <TooltipTrigger asChild data-testid="TooltipTrigger__wtl">
          <DropdownMenuTrigger asChild data-testid="DropdownMenuTrigger__wtl">
            <button
              type="button"
              aria-label={pendingLabel}
              data-testid="topbar-walkthroughs"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-topbar-icon transition-colors hover:bg-muted hover:text-foreground"
            >
              <GraduationCap className="h-5 w-5" data-testid="GraduationCap__wtl" />
              {/* The dot is lit while ANY tutorial is unfinished -- never
                  started, left half-way, or revised since it was completed. It
                  does NOT go out when the menu is opened: the reminder is about
                  unfinished work, not about unread news.
                  Positioned in from the button's corner (`right-1 top-1`, not a
                  negative inset): the button is 40px and the cap glyph only
                  20px, so a dot pinned to the button's edge floats visibly away
                  from the icon it belongs to -- measured, 11.3px versus 2.8px.
                  `aria-hidden` because `pendingLabel` already says it. */}
              {progress.pending > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-page-bg"
                  data-testid="walkthrough-pending-dot"
                />
              )}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" data-testid="TooltipContent__wtl">
          {pendingLabel}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80" data-testid="walkthrough-launcher-list">
        <DropdownMenuLabel data-testid="DropdownMenuLabel__wtl">
          {ui('walkthroughLauncherHeading')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator data-testid="DropdownMenuSeparator__wtl" />
        {flows.map((flow) => {
          const Icon = flowIcons[flow.icon] ?? Play;
          const description = stepText(flow.descriptionKey, { warn: false });
          const title = stepText(flow.titleKey);
          const status = progress.statuses[flow.id] ?? FLOW_STATUS.UNSEEN;
          const dismissed = Boolean(progress.dismissed[flow.id]);
          // A dismissed row keeps a badge, just a quieter one -- see
          // `DISMISSED_BADGE`. A completed row has nothing left to silence, so
          // it gets neither badge nor toggle.
          const badge = dismissed ? DISMISSED_BADGE : STATUS_BADGES[status];
          const canDismiss = status !== FLOW_STATUS.COMPLETED;
          const ToggleIcon = dismissed ? Bell : BellOff;
          return (
            // The toggle is its OWN menu item beside the launch row, not a
            // button nested inside it. Nested interactives in a `menuitem` are
            // neither reachable by the menu's arrow navigation nor announced as
            // separate controls, and they fight the item's own selection
            // handler; two siblings are keyboard-reachable and need no
            // propagation tricks.
            <div key={flow.id} className="flex items-start" data-testid={`walkthrough-row-${flow.id}`}>
              <DropdownMenuItem
                disabled={isRunning}
                onSelect={() => handleSelect(flow)}
                className="min-w-0 flex-1 items-start gap-2 py-2"
                data-testid={`walkthrough-launch-${flow.id}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" data-testid="FlowIcon__wtl" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {title}
                  </span>
                  {description && (
                    <span className="text-xs leading-snug text-muted-foreground">{description}</span>
                  )}
                </span>
                {badge ? (
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-tight ${badge.className}`}
                    data-testid={`walkthrough-status-${flow.id}`}
                  >
                    {ui(badge.labelKey)}
                  </span>
                ) : (
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                    aria-label={ui('walkthroughBadgeCompleted')}
                    data-testid={`walkthrough-status-${flow.id}`}
                  />
                )}
              </DropdownMenuItem>
              {canDismiss && (
                <DropdownMenuItem
                  disabled={isRunning}
                  // `preventDefault` keeps the menu open: silencing one
                  // tutorial is usually the first of several, and a menu that
                  // shuts on every toggle makes the user reopen it each time.
                  onSelect={(event) => {
                    event.preventDefault();
                    handleToggleDismissed(flow);
                  }}
                  className="mt-1.5 shrink-0 justify-center px-2 py-1.5"
                  aria-label={ui(
                    dismissed ? 'walkthroughRestoreAction' : 'walkthroughDismissAction',
                    { title },
                  )}
                  data-testid={`walkthrough-dismiss-${flow.id}`}
                >
                  {/* `aria-hidden` because the item above already carries the
                      full label -- announcing the glyph too would repeat it. */}
                  <ToggleIcon
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-muted-foreground"
                    data-testid="DismissToggleIcon__wtl"
                  />
                </DropdownMenuItem>
              )}
            </div>
          );
        })}
        {progress.pending > 0 && (
          <>
            <DropdownMenuSeparator data-testid="DropdownMenuSeparatorHint__wtl" />
            {/* Guidance for the whole menu, once at the bottom, rather than a
                caption repeated on every row: it explains what the per-row
                toggle is FOR and that using it costs the user nothing. */}
            <p
              className="px-2 py-1.5 text-xs leading-snug text-muted-foreground"
              data-testid="walkthrough-dismiss-hint"
            >
              {ui('walkthroughDismissHint')}
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WalkthroughLauncher;
