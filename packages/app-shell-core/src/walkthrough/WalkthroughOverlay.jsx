import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, TriangleAlert, X } from 'lucide-react';
import { Button } from '../components/ui/button.jsx';
import { useLocale, useUI } from '../i18n/index.js';
import { cn } from '../lib/utils.js';
import { computeCardPosition, computeScrimPanels } from './cardPlacement.js';
import { WalkthroughCursor } from './WalkthroughCursor.jsx';
import { resolveStepText } from './stepText.js';
import { useElementRect } from './useElementRect.js';
import { useForeignDialog } from './useForeignDialog.js';
import { resolveHighlightBox, WALKTHROUGH_ERROR } from './targetResolver.js';

/**
 * The overlay's elevation. It has to clear every surface a tour can point at,
 * and the app grew a set of ad-hoc elevations well above the nominal `z-50`
 * modal tier -- 100 (`.fm-modal-overlay`), 150/160 (LocationEditorModal and its
 * country/region pickers), 200/201 (ContactDetailModal's pickers), 500
 * (LifecycleConfirmModal). Those are load-bearing (LocationEditorModal opens
 * from INSIDE .fm-modal-overlay, so it genuinely outranks it), so the overlay
 * is raised once instead of pulling each of them down. At the old `z-70` the
 * step card was simply invisible on any step inside one of them.
 *
 * Deliberately BELOW the 1000 used by the fixed select panels
 * (CreatableSearchSelect, InlineSearchCombo): those are plain divs with no
 * `role`, so `useForeignDialog` cannot detect them and park the card out of the
 * way. Leaving them on top means a step pointing at a dropdown is never covered
 * by the very card explaining it.
 *
 * An inline style, NOT a Tailwind utility. A `z-*` class defined in the shared
 * preset only compiles if the consuming app's Tailwind `content` globs happen to
 * scan this file -- which is a per-app, per-dev-profile accident (see the
 * LOCAL_CORE note in tools/app-shell/tailwind.config.js). Confirmed live: the
 * class produced no rule at all and the overlay silently fell back to `auto`.
 * The one thing this layer cannot afford is an invisible card.
 */
const OVERLAY_Z_INDEX = 600;

// 380, not the original 340: the Spanish footer of a mid-flow step measures
// 325px ("Salir del tutorial" 113 + "Atras" 86 + "Siguiente" 110 + two 8px
// gaps), and 340 minus the p-4 padding leaves only 306 -- so every step after
// the first wrapped its nav group onto a second line and the card grew 40px
// mid-tour. The `flex-wrap` in the footer is still the real guarantee (a
// longer locale will wrap and that is fine); this width just keeps the common
// case on one line so the card stops resizing between steps.
const CARD_WIDTH = 380;
const CARD_HEIGHT_FALLBACK = 168;
/** How long the card takes to travel to a new position. */
const CARD_MOVE_MS = 1000;

/**
 * The visual layer of the walkthrough: a dimming scrim with a hole around the
 * highlighted element, plus the step card.
 *
 * Sits at `OVERLAY_Z_INDEX` (600) -- above every app surface a tour can point
 * at. See that constant for why the nominal `z-70` "global tools" tier was not
 * enough, and why 600 is a ceiling rather than infinity.
 *
 * By default the scrim does NOT swallow clicks (`step.blockOutside` opts in):
 * a walkthrough teaches the real UI, so the real UI has to stay usable — and a
 * user who wanders off must never find the window inert. `Escape`, the close
 * button and the error card's escape hatch all end the tour and restore focus.
 */
export function WalkthroughOverlay({ engine }) {
  const { phase, step, target, error, flow } = engine;
  const ui = useUI();
  const dictionary = useLocale();
  const cardRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_FALLBACK);
  const [viewport, setViewport] = useState(() => readViewport());

  const isActive = phase === 'active';
  // The BOX to draw around, which is not always the element the step named: a
  // selector field's `field-<key>` testid lives on the bare input inside its
  // bordered wrapper, with the chevron as a flex sibling 20px further right.
  // See `resolveHighlightBox`. Recomputed per target only -- it reads layout,
  // and the ancestor of a given element does not change while the step is up.
  const highlightBox = useMemo(
    () => (isActive ? resolveHighlightBox(target) : target),
    [target, isActive],
  );
  const rect = useElementRect(highlightBox, isActive);
  // A drawer/modal/dropdown the step's own target just opened. While one is up
  // the scrim would dim it from above (the overlay is deliberately the topmost
  // tier), so the dimming is suspended and the card is parked out of the way.
  const foreignDialogOpen = useForeignDialog(isActive, target);

  useEffect(() => {
    const onResize = () => setViewport(readViewport());
    onResize();
    globalThis.addEventListener?.('resize', onResize);
    return () => globalThis.removeEventListener?.('resize', onResize);
  }, []);

  // Observed, not sampled on a dep change. The card's height depends on its
  // TEXT (a two-line body, a visible advance hint, an extra button), which
  // changes without `phase` or `step.id` changing -- so the sampled version
  // kept a stale height, and every placement computed from it was off by the
  // difference. That is what pushed the parked card off the bottom of the
  // screen: the position was right for a card 60px shorter than the one being
  // drawn.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const measure = () => {
      const measured = el.getBoundingClientRect().height;
      setCardHeight((prev) => (measured && Math.abs(measured - prev) > 1 ? measured : prev));
    };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase, step?.id]);

  if (phase === 'idle' || !globalThis.document?.body) return null;

  const title = resolveStepText(dictionary, step?.titleKey);
  const body = resolveStepText(dictionary, step?.bodyKey);
  const flowTitle = resolveStepText(dictionary, flow?.titleKey);
  const nextFlowTitle = resolveStepText(dictionary, engine.nextFlow?.titleKey);

  let requestedPlacement = 'center';
  if (foreignDialogOpen) requestedPlacement = 'parked';
  else if (isActive) requestedPlacement = step?.placement;

  const position = computeCardPosition({
    rect: isActive && !foreignDialogOpen ? rect : null,
    card: { width: CARD_WIDTH, height: cardHeight },
    viewport,
    placement: requestedPlacement,
    // Same padding the scrim uses, so the card is kept clear of the highlight
    // ring, not merely of the raw element box.
    padding: step?.spotlightPadding ?? 8,
  });

  // No panels at all while a foreign dialog is open -- not even the
  // full-screen one, which is what `computeScrimPanels({rect: null})` returns.
  const panels = foreignDialogOpen
    ? []
    : (isActive && rect
      ? computeScrimPanels({ rect, viewport, padding: step?.spotlightPadding ?? 8 })
      : computeScrimPanels({ rect: null, viewport }));

  // Blocking is only safe once there is a HOLE. With no measured rect
  // `computeScrimPanels` returns one full-screen panel, so blocking then would
  // freeze the whole application — including the synthetic clicks a `navPath`
  // dispatches through the side menu. The card stays clickable
  // (`pointer-events-auto`) and `Escape` never went through the DOM at all, so
  // there is always a way out.
  // ... and never blocking while a dialog is up: the dialog IS the thing to
  // interact with.
  const blocking = isActive && !!rect && !foreignDialogOpen && step?.blockOutside === true;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: OVERLAY_Z_INDEX }}
      data-testid="walkthrough-overlay"
      data-walkthrough-phase={phase}
      data-walkthrough-flow={flow?.id ?? ''}
      data-walkthrough-step={step?.id ?? ''}
      data-walkthrough-blocking={blocking ? 'true' : 'false'}
      data-walkthrough-dialog-open={foreignDialogOpen ? 'true' : 'false'}
      data-walkthrough-navpath-failure={
        engine.navPathFailure ? `${engine.navPathFailure.stepId}:${engine.navPathFailure.selector}` : ''
      }
      role="presentation"
    >
      {panels.map((panel, index) => (
        <div
          key={`${panel.top}-${panel.left}-${index}`}
          className={cn(
            'fixed bg-black/30 transition-opacity',
            blocking ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          style={{ top: panel.top, left: panel.left, width: panel.width, height: panel.height }}
          data-testid="walkthrough-scrim-panel"
        />
      ))}

      {isActive && rect && !foreignDialogOpen && (
        <div
          className="pointer-events-none fixed rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={{
            top: rect.top - (step?.spotlightPadding ?? 8),
            left: rect.left - (step?.spotlightPadding ?? 8),
            width: rect.width + (step?.spotlightPadding ?? 8) * 2,
            height: rect.height + (step?.spotlightPadding ?? 8) * 2,
          }}
          data-testid="walkthrough-spotlight"
        />
      )}

      <div
        ref={cardRef}
        className="pointer-events-auto fixed rounded-xl border border-border bg-card p-4 shadow-lg"
        style={{
          top: position.top,
          left: position.left,
          width: CARD_WIDTH,
          // The card travels instead of teleporting: a bubble that reappears
          // somewhere else reads as a second bubble, and the user loses track
          // of what is being pointed at. Only the two position properties are
          // transitioned -- `transition-all` would also animate the parked
          // card's own resize, which fights the ResizeObserver above.
          transition: engine.reducedMotion ? undefined : `top ${CARD_MOVE_MS}ms ease, left ${CARD_MOVE_MS}ms ease`,
        }}
        role="dialog"
        aria-modal="false"
        aria-label={flowTitle || ui('walkthroughTitle')}
        data-testid="walkthrough-card"
        data-walkthrough-placement={position.placement}
      >
        <WalkthroughCardBody
          engine={engine}
          ui={ui}
          title={title}
          body={body}
          flowTitle={flowTitle}
          nextFlowTitle={nextFlowTitle}
          error={error}
          data-testid="WalkthroughCardBody__wt" />
      </div>

      {/* Last child on purpose: it paints above the scrim, the spotlight and
          the card without needing a second z-index tier, and it is torn down
          with this overlay -- there is no separate portal that could survive
          the tour and strand a pointer on screen. */}
      <WalkthroughCursor data-testid="WalkthroughCursor__wt" {...(engine.cursor ?? {})} />
    </div>,
    globalThis.document.body,
  );
}

function WalkthroughCardBody({ engine, ui, title, body, flowTitle, nextFlowTitle, error }) {
  const { phase, stepIndex, stepCount, canAdvance, step } = engine;
  const hasNextFlow = !!engine.nextFlow && !!nextFlowTitle;

  if (phase === 'completed') {
    return (
      <>
        <CardHeader
          eyebrow={flowTitle}
          title={ui('walkthroughCompletedTitle')}
          onClose={engine.stop}
          closeLabel={ui('walkthroughClose')}
          data-testid="CardHeader__wt" />
        <p className="mt-1 text-sm text-muted-foreground">{ui('walkthroughCompletedBody')}</p>
        {/* Offered, never imposed: the primary action still ends the tour, and
            the invitation only appears when there IS a following flow with a
            resolvable name -- an unnamed "continue" button would be a mystery
            box. */}
        {hasNextFlow && (
          <p className="mt-2 text-sm text-foreground" data-testid="walkthrough-next-flow-prompt">
            {ui('walkthroughNextFlowPrompt', { name: nextFlowTitle })}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant={hasNextFlow ? 'outline' : 'default'}
            onClick={engine.stop}
            data-testid="walkthrough-finish">
            <Check className="mr-1.5 h-3.5 w-3.5" data-testid="Check__wt" />
            {ui('walkthroughFinish')}
          </Button>
          {hasNextFlow && (
            <Button
              size="sm"
              onClick={() => engine.start(engine.nextFlow.id)}
              data-testid="walkthrough-next-flow">
              {ui('walkthroughStartNextFlow')}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" data-testid="ArrowRight__wt" />
            </Button>
          )}
        </div>
      </>
    );
  }

  if (phase === 'error') {
    const messageKey = error?.code === WALKTHROUGH_ERROR.NAVIGATION_FAILED
      ? 'walkthroughErrorNavigation'
      : 'walkthroughErrorTargetMissing';
    return (
      <>
        <CardHeader
          eyebrow={flowTitle}
          title={ui('walkthroughErrorTitle')}
          onClose={engine.stop}
          closeLabel={ui('walkthroughClose')}
          icon={TriangleAlert}
          data-testid="CardHeader__wt" />
        <p className="mt-1 text-sm text-muted-foreground" data-testid="walkthrough-error-message">
          {ui(messageKey)}
        </p>
        {/* `flex-wrap` + `ml-auto`, NOT `justify-between`: the three buttons of a
            Spanish footer ("Salir del tutorial" + "Atras" + "Siguiente") are wider
            than the card, and `justify-between` has no fallback -- it just lets the
            last button hang outside the rounded border. Wrapping drops the nav group
            onto a second line, and the auto margin keeps it right-aligned on
            whichever line it lands on. Any locale can grow its labels freely. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={engine.stop}
            data-testid="walkthrough-exit">
            {ui('walkthroughExit')}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={engine.retry}
              data-testid="walkthrough-retry">
              {ui('walkthroughRetry')}
            </Button>
            {stepIndex < stepCount - 1 && (
              <Button size="sm" onClick={engine.skipStep} data-testid="walkthrough-skip">
                {ui('walkthroughSkipStep')}
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  if (phase !== 'active') {
    // Three different waits, three different messages. Saying "opening the
    // screen" while merely waiting for an element to mount is what made a
    // missing target look like a navigation hang -- the user stared at
    // "Abriendo la pantalla..." on a form that was already open.
    let waitingKey = 'walkthroughLocating';
    if (phase === 'navigating') {
      // While the animated cursor is walking the side menu, say so: the point
      // of the animation is that the user WATCHES the path and can repeat it,
      // which a generic spinner does not invite.
      waitingKey = (step?.navPath?.length ?? 0) > 0
        ? 'walkthroughShowingPath'
        : 'walkthroughPreparing';
    }
    return (
      <>
        <CardHeader
          eyebrow={flowTitle}
          title={title || ui(waitingKey)}
          onClose={engine.stop}
          closeLabel={ui('walkthroughClose')}
          data-testid="CardHeader__wt" />
        <p
          className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="walkthrough-waiting-message"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" data-testid="Loader2__wt" />
          {ui(waitingKey)}
        </p>
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="ghost" onClick={engine.stop} data-testid="walkthrough-exit">
            {ui('walkthroughExit')}
          </Button>
        </div>
      </>
    );
  }

  // On the last step the same button completes the tour instead of advancing.
  // There is exactly ONE way to end early -- "Exit", on the left -- because a
  // separate always-visible "Finish" duplicated it, overflowed the card, and
  // made the user ask which of the two ended the tour. Both still converge on
  // the engine's single teardown path.
  const isLastStep = stepIndex >= stepCount - 1;

  let advanceHint = null;
  if (step?.advance.on === 'targetClick') {
    // A closing step's click ENDS the tour, so it must not promise to
    // "continue". The final step of a create flow points at Save: clicking it
    // both saves the record and shows the completion card, instead of making
    // the user press Save and then press Finish for the same outcome.
    advanceHint = isLastStep ? ui('walkthroughAdvanceOnClickFinal') : ui('walkthroughAdvanceOnClick');
  } else if (step?.advance.requireValue) {
    advanceHint = ui('walkthroughAdvanceOnValue');
  }
  // The advance button is offered on EVERY step, including the ones that also
  // advance on their own (a click on the target, a value in the field): the
  // automatic condition is a convenience, not a cage. What the gate does is
  // DISABLE it, never remove it -- a missing button reads as a dead end, a
  // disabled one reads as "do the thing first", which is the actual
  // instruction. A `targetClick` step's gate IS the click on the highlighted
  // element, so it stays disabled until that click happens.
  // ... UNLESS that target is disabled: then the click can never happen and
  // disabling "Next" too would leave the user with no way forward at all. This
  // is what makes `targetClick` safe on a conditionally-enabled button --
  // "Save" is mandatory while it is live (Next stays shut, so the user really
  // does save), and stops being a wall the moment it greys out.
  const targetUnclickable = engine.targetDisabled === true;
  const nextDisabled = !canAdvance
    || (step?.advance.on === 'targetClick' && !targetUnclickable);
  return (
    <>
      <CardHeader
        eyebrow={`${flowTitle} · ${ui('walkthroughStepCounter', { current: stepIndex + 1, total: stepCount })}`}
        title={title}
        onClose={engine.stop}
        closeLabel={ui('walkthroughClose')}
        data-testid="CardHeader__wt" />
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {/* Shown exactly while "Next" is disabled: the hint IS the explanation for
          the disabled button. Keyed on `nextDisabled` rather than `canAdvance`
          because a `targetClick` step has nothing to wait for value-wise, so it
          reports `canAdvance` and its hint would never have appeared. */}
      {advanceHint && nextDisabled && (
        <p className="mt-2 text-xs font-medium text-primary" data-testid="walkthrough-advance-hint">
          {advanceHint}
        </p>
      )}
      {/* `flex-wrap` + `ml-auto`, NOT `justify-between`: the three buttons of a
          Spanish footer ("Salir del tutorial" + "Atras" + "Siguiente") are wider
          than the card, and `justify-between` has no fallback -- it just lets the
          last button hang outside the rounded border. Wrapping drops the nav group
          onto a second line, and the auto margin keeps it right-aligned on
          whichever line it lands on. Any locale can grow its labels freely. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={engine.stop}
          data-testid="walkthrough-exit">
          {ui('walkthroughExit')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {stepIndex > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={engine.previous}
              data-testid="walkthrough-previous">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" data-testid="ArrowLeft__wt" />
              {ui('walkthroughPrevious')}
            </Button>
          )}
          {isLastStep ? (
            <Button
              size="sm"
              onClick={engine.finish}
              disabled={nextDisabled}
              data-testid="walkthrough-finish">
              <Check className="mr-1.5 h-3.5 w-3.5" data-testid="Check__wt" />
              {ui('walkthroughFinish')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={engine.next}
              disabled={nextDisabled}
              data-testid="walkthrough-next">
              {ui('walkthroughNext')}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" data-testid="ArrowRight__wt" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function CardHeader({ eyebrow, title, onClose, closeLabel, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        {eyebrow && (
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {Icon && <Icon className="h-4 w-4 text-destructive" data-testid="CardHeaderIcon__wt" />}
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        data-testid="walkthrough-close"
      >
        <X className="h-4 w-4" data-testid="X__wt" />
      </button>
    </div>
  );
}

function readViewport() {
  return {
    width: globalThis.innerWidth ?? 1280,
    height: globalThis.innerHeight ?? 800,
  };
}
