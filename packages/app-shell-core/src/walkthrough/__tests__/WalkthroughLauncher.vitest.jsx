/**
 * The topbar tutorials launcher: the "you never took this" dot, the per-flow
 * badges, and the two Mixpanel events it emits (ETP-5144).
 *
 * Two mechanics worth knowing before editing this file:
 *
 * 1. The component needs a `TooltipProvider` ancestor. The real app gets one
 *    from `TopBar`; here it is mounted explicitly.
 * 2. Radix opens its dropdown on `pointerdown`, and `userEvent.click`
 *    DEADLOCKS on the `pointer-events: none` Radix puts on the body while the
 *    menu is open. Open the menu with `fireEvent.pointerDown`, never with
 *    `userEvent.click`.
 */
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../i18n/useUI.js', () => ({
  useUI: () => (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
}));

/**
 * Mutable stand-in for the engine's context. Rebuilt per test so a case can
 * flip `isRunning` / `available` / the flow list.
 */
const engine = {
  available: true,
  isRunning: false,
  start: vi.fn(),
  flows: [],
};

/** How many times the component read the engine — i.e. how many renders. */
let engineReads = 0;

vi.mock('../useStepText.js', () => ({
  useStepText: () => (key) => key ?? '',
}));

vi.mock('../WalkthroughProvider.jsx', () => ({
  useWalkthrough: () => {
    engineReads += 1;
    return {
      available: engine.available,
      isRunning: engine.isRunning,
      start: engine.start,
      // A NEW array (and new flow objects) on every render, on purpose: this is
      // what a host that builds its flow list inline does, and the component
      // must key its memo on flow CONTENT rather than on array identity or the
      // progress effect loops forever. See the render-loop test below.
      flows: engine.flows.map((flow) => ({ ...flow })),
    };
  },
}));

/**
 * Telemetry is INJECTED, not imported: the launcher reads named callbacks off
 * the observability context and the host names the events. This stands in for
 * that host, recording (name, properties) so the assertions below read the
 * same as they did when the component imported a tracker directly.
 */
const trackSpy = vi.fn();
vi.mock('../../observability/ObservabilityContext.jsx', () => ({
  useObservability: () => ({
    trackWalkthroughMenuOpened: (properties) => trackSpy('walkthrough_menu_opened', properties),
    trackWalkthroughStarted: (properties) => trackSpy('walkthrough_started', properties),
  }),
}));

import { TooltipProvider } from '../../components/ui/tooltip.jsx';
import * as progress from '../walkthroughProgress.js';
import { WalkthroughLauncher } from '../WalkthroughLauncher.jsx';

const CONTACT = { id: 'create-contact', revision: 1, titleKey: 'contactTitle', icon: 'UserPlus', steps: [1, 2, 3] };
/** Revision 2 on purpose: lets a rev-1 completion surface as `updated`. */
const PRODUCT = { id: 'create-product', revision: 2, titleKey: 'productTitle', icon: 'Package', steps: [1] };

const mount = () => render(
  <TooltipProvider><WalkthroughLauncher /></TooltipProvider>,
);

const openMenu = () => fireEvent.pointerDown(
  screen.getByTestId('topbar-walkthroughs'),
  { button: 0, ctrlKey: false, pointerType: 'mouse' },
);

/** The properties of the single `track()` call for `name`. */
const trackedProperties = (name) => trackSpy.mock.calls.find((call) => call[0] === name)?.[1];

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('sf_auth_user', 'valentin');
  engine.available = true;
  engine.isRunning = false;
  engine.flows = [CONTACT, PRODUCT];
  engineReads = 0;
  trackSpy.mockClear();
  engine.start.mockClear();
});

describe('WalkthroughLauncher — the pending dot', () => {
  it('lights the dot for unannounced tutorials and says so in the aria-label', () => {
    mount();

    expect(screen.getByTestId('walkthrough-pending-dot')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-walkthroughs')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('walkthroughPendingHint'),
    );
  });

  it('goes dark once every tutorial has been completed at its current revision', () => {
    progress.markFlowCompleted(CONTACT.id, CONTACT.revision);
    progress.markFlowCompleted(PRODUCT.id, PRODUCT.revision);

    mount();

    expect(screen.queryByTestId('walkthrough-pending-dot')).not.toBeInTheDocument();
    expect(screen.getByTestId('topbar-walkthroughs')).toHaveAttribute(
      'aria-label',
      'walkthroughLauncherTooltip',
    );
  });

  it('stays lit for a tour left half-done — it is still unfinished', () => {
    progress.markFlowCompleted(PRODUCT.id, PRODUCT.revision);
    progress.markFlowStarted(CONTACT.id);

    mount();

    expect(screen.getByTestId('walkthrough-pending-dot')).toBeInTheDocument();
  });

  it('re-lights when a completed tour is revised', () => {
    progress.markFlowCompleted(CONTACT.id, 1);
    progress.markFlowCompleted(PRODUCT.id, PRODUCT.revision);
    engine.flows = [{ ...CONTACT, revision: 2 }, PRODUCT];

    mount();

    expect(screen.getByTestId('walkthrough-pending-dot')).toBeInTheDocument();
  });

  it('reports the click but KEEPS the dot lit — reading the list finishes nothing', () => {
    mount();
    openMenu();

    expect(trackedProperties('walkthrough_menu_opened')).toMatchObject({ count: 2, total: 2 });
    // An earlier design dismissed the dot here. Dropped: "you have unfinished
    // tutorials" does not stop being true because the user glanced at the menu.
    expect(screen.getByTestId('walkthrough-pending-dot')).toBeInTheDocument();
  });

  it('sits next to the cap glyph, not out at the button corner', () => {
    mount();

    // The button is 40px and the glyph only 20px, so a dot pinned to the
    // button's edge (`-right-0.5 -top-0.5`) floats ~11px off the icon it
    // belongs to; measured against the live stylesheet, `right-1 top-1` puts
    // its centre 2.8px from the glyph's top-right corner.
    const dot = screen.getByTestId('walkthrough-pending-dot');
    expect(dot.className).toMatch(/(^|\s)right-1(\s|$)/);
    expect(dot.className).toMatch(/(^|\s)top-1(\s|$)/);
    expect(dot.className).not.toMatch(/-right-|-top-/);
  });
});

describe('WalkthroughLauncher — per-flow badges', () => {
  it('shows in-progress and updated badges side by side', () => {
    progress.markFlowCompleted(PRODUCT.id, 1); // completed rev 1; the flow is rev 2
    progress.markFlowStarted(CONTACT.id);

    mount();
    openMenu();

    expect(screen.getByTestId('walkthrough-status-create-contact')).toHaveTextContent(
      'walkthroughBadgeInProgress',
    );
    expect(screen.getByTestId('walkthrough-status-create-product')).toHaveTextContent(
      'walkthroughBadgeUpdated',
    );
  });

  it('shows the NEW badge for a tutorial never started', () => {
    mount();
    openMenu();

    expect(screen.getByTestId('walkthrough-status-create-contact')).toHaveTextContent(
      'walkthroughBadgeNew',
    );
  });

  it('replaces the badge with a muted check once the tutorial is completed', () => {
    progress.markFlowCompleted(CONTACT.id, CONTACT.revision);

    mount();
    openMenu();

    const marker = screen.getByTestId('walkthrough-status-create-contact');
    // A completed flow has no badge label at all — only the check, which
    // carries the accessible name.
    expect(marker).toHaveAttribute('aria-label', 'walkthroughBadgeCompleted');
    expect(marker).not.toHaveTextContent('walkthroughBadge');
  });
});

describe('WalkthroughLauncher — starting a tutorial', () => {
  it('reports the PRE-run status, records the start and hands off to the engine', () => {
    progress.markFlowCompleted(PRODUCT.id, 1); // completed rev 1; the flow is rev 2

    mount();
    openMenu();
    fireEvent.click(screen.getByTestId('walkthrough-launch-create-product'));

    expect(trackedProperties('walkthrough_started')).toMatchObject({
      flowId: 'create-product',
      status: 'updated',
      total: 1,
      source: 'launcher',
    });
    expect(engine.start).toHaveBeenCalledWith('create-product');
    expect(progress.readFlowRecord('create-product').starts).toBe(1);
  });

  it('disables every entry while a tour is already running', () => {
    engine.isRunning = true;

    mount();
    openMenu();

    expect(screen.getByTestId('walkthrough-launch-create-contact'))
      .toHaveAttribute('data-disabled');
  });
});

describe('WalkthroughLauncher — nothing to offer', () => {
  it('renders nothing when the engine is unavailable', () => {
    engine.available = false;

    const { container } = mount();

    expect(container.querySelector('[data-testid="topbar-walkthroughs"]')).toBeNull();
  });

  it('renders nothing when there are no flows', () => {
    engine.flows = [];

    const { container } = mount();

    expect(container.querySelector('[data-testid="topbar-walkthroughs"]')).toBeNull();
  });
});

describe('WalkthroughLauncher — render-loop guard', () => {
  /**
   * Regression pin, not a micro-optimization: progress lives in
   * `localStorage`, so it is read imperatively in an effect that writes state.
   * If the flow list were keyed by array IDENTITY, a host handing a freshly
   * built array on every render (which the mock above does deliberately) would
   * make that effect re-run forever. The component keys its memo and callback
   * on a CONTENT string instead, so the effect settles.
   */
  it('settles after a bounded number of renders even though flows are rebuilt inline', () => {
    mount();

    expect(engineReads).toBeGreaterThan(0);
    expect(engineReads).toBeLessThanOrEqual(5);
  });

  it('does not loop while the menu is open either', () => {
    mount();
    const beforeOpen = engineReads;

    openMenu();

    expect(engineReads - beforeOpen).toBeLessThanOrEqual(6);
  });
});
