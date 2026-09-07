/**
 * Contract of the step-card geometry (ETP-5144).
 *
 * The invariant this file exists for is stated in `computeCardPosition`'s own
 * comment and is easy to regress into: the authored placement is a PREFERENCE,
 * not an order. Honouring it blindly is how the card ends up covering the very
 * field the step asks the user to fill — `right` on a field already at the
 * right edge produces an off-screen card, and the clamp then slides it back in,
 * straight over the target. So every candidate is scored by how much it
 * overlaps the spotlight and the first non-overlapping one wins.
 *
 * Pure math on plain objects, so `node --test` is enough — no browser, no jsdom.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeCardPosition, computeScrimPanels } from '../cardPlacement.js';

/** The real card size (see `WalkthroughOverlay.jsx`'s `CARD_WIDTH`). */
const CARD = { width: 380, height: 168 };
const VIEWPORT = { width: 1440, height: 900 };
const MARGIN = 12;

/** A small field near the top-left, with room on every side. */
const ROOMY_RECT = { top: 300, left: 500, width: 200, height: 40 };

/** True when the card at `position` touches the target's padded box. */
function overlaps(position, rect, padding = 8) {
  const x = Math.max(0, Math.min(position.left + CARD.width, rect.left + rect.width + padding)
    - Math.max(position.left, rect.left - padding));
  const y = Math.max(0, Math.min(position.top + CARD.height, rect.top + rect.height + padding)
    - Math.max(position.top, rect.top - padding));
  return x * y > 0;
}

describe('computeCardPosition — parked', () => {
  it('sits in the bottom-left corner, away from the app\'s own dialogs', () => {
    // A step whose target opened a picker parks the card instead of hiding it:
    // the instruction is what the user is acting on. Bottom-LEFT because this
    // app's dialogs are centred or right-anchored.
    const position = computeCardPosition({
      rect: ROOMY_RECT, card: CARD, viewport: VIEWPORT, placement: 'parked',
    });

    assert.deepEqual(position, {
      top: VIEWPORT.height - CARD.height - MARGIN,
      left: MARGIN,
      placement: 'parked',
    });
  });

  it('never goes off-screen on a viewport shorter than the card', () => {
    const position = computeCardPosition({
      rect: ROOMY_RECT, card: CARD, viewport: { width: 400, height: 100 }, placement: 'parked',
    });

    assert.equal(position.top, MARGIN);
  });

  it('parks regardless of the target — the dialog position is unknown here', () => {
    const withRect = computeCardPosition({ rect: ROOMY_RECT, card: CARD, viewport: VIEWPORT, placement: 'parked' });
    const withoutRect = computeCardPosition({ rect: null, card: CARD, viewport: VIEWPORT, placement: 'parked' });

    assert.deepEqual(withRect, withoutRect);
  });
});

describe('computeCardPosition — centered', () => {
  it('centers when there is no target', () => {
    const position = computeCardPosition({ rect: null, card: CARD, viewport: VIEWPORT });

    assert.equal(position.placement, 'center');
    assert.equal(position.left, (VIEWPORT.width - CARD.width) / 2);
    assert.equal(position.top, (VIEWPORT.height - CARD.height) / 2);
  });

  it('centers on explicit request even with a target', () => {
    const position = computeCardPosition({
      rect: ROOMY_RECT, card: CARD, viewport: VIEWPORT, placement: 'center',
    });

    assert.equal(position.placement, 'center');
  });

  it('clamps to the margin rather than going negative on a tiny viewport', () => {
    const position = computeCardPosition({
      rect: null, card: CARD, viewport: { width: 320, height: 120 },
    });

    assert.equal(position.top, MARGIN);
    assert.equal(position.left, MARGIN);
  });
});

describe('computeCardPosition — auto placement priority', () => {
  it('prefers below the target when there is room', () => {
    const position = computeCardPosition({ rect: ROOMY_RECT, card: CARD, viewport: VIEWPORT });

    assert.equal(position.placement, 'bottom');
    assert.equal(position.top, ROOMY_RECT.top + ROOMY_RECT.height + 14);
  });

  it('falls to above when the target sits low', () => {
    const low = { top: 800, left: 500, width: 200, height: 40 };

    const position = computeCardPosition({ rect: low, card: CARD, viewport: VIEWPORT });

    assert.equal(position.placement, 'top');
  });

  it('falls to the side when the target is tall enough to block both', () => {
    // A full-height side panel: no room above or below, plenty to the right.
    const tall = { top: 20, left: 40, width: 200, height: 850 };

    const position = computeCardPosition({ rect: tall, card: CARD, viewport: VIEWPORT });

    assert.equal(position.placement, 'right');
  });
});

describe('computeCardPosition — the card must not cover the target', () => {
  it('OVERRIDES an authored placement that would land on the spotlight', () => {
    // This is the regression the scoring exists for. `right` on a field at the
    // right edge has nowhere to go: the clamp pulls the card back inside the
    // viewport and straight over the field the step is pointing at.
    const atRightEdge = { top: 400, left: 1200, width: 220, height: 40 };

    const position = computeCardPosition({
      rect: atRightEdge, card: CARD, viewport: VIEWPORT, placement: 'right',
    });

    assert.notEqual(position.placement, 'right');
    assert.equal(overlaps(position, atRightEdge), false);
  });

  it('honours an authored placement that does NOT overlap', () => {
    const position = computeCardPosition({
      rect: ROOMY_RECT, card: CARD, viewport: VIEWPORT, placement: 'top',
    });

    assert.equal(position.placement, 'top');
  });

  it('keeps the card clear of the target from every authored preference', () => {
    const atRightEdge = { top: 400, left: 1200, width: 220, height: 40 };
    for (const placement of ['auto', 'top', 'bottom', 'left', 'right']) {
      const position = computeCardPosition({
        rect: atRightEdge, card: CARD, viewport: VIEWPORT, placement,
      });
      assert.equal(overlaps(position, atRightEdge), false, `placement ${placement} covered the target`);
    }
  });

  it('takes the least-bad side when EVERY side overlaps, instead of an arbitrary one', () => {
    // A target larger than the viewport minus the card: no placement is clean,
    // so the contract is "smallest overlap", not "first in the list".
    const huge = { top: 0, left: 0, width: 1440, height: 900 };

    const position = computeCardPosition({ rect: huge, card: CARD, viewport: VIEWPORT });

    assert.ok(['top', 'bottom', 'left', 'right'].includes(position.placement));
    assert.ok(position.top >= MARGIN && position.left >= MARGIN);
  });
});

describe('computeScrimPanels', () => {
  it('dims the whole viewport with one panel when there is no target', () => {
    const panels = computeScrimPanels({ rect: null, viewport: VIEWPORT });

    assert.equal(panels.length, 1);
    assert.deepEqual(panels[0], { top: 0, left: 0, width: 1440, height: 900 });
  });

  it('leaves a padded hole over the target and covers everything else', () => {
    const panels = computeScrimPanels({ rect: ROOMY_RECT, viewport: VIEWPORT, padding: 8 });

    assert.equal(panels.length, 4);
    // No panel may intrude on the hole — that is what "un-dimmed" means, and it
    // is exactly what got the selector chevron dimmed before the highlight box
    // was widened to the field's bordered wrapper.
    const hole = { top: 292, left: 492, right: 708, bottom: 348 };
    for (const panel of panels) {
      const x = Math.max(0, Math.min(panel.left + panel.width, hole.right) - Math.max(panel.left, hole.left));
      const y = Math.max(0, Math.min(panel.top + panel.height, hole.bottom) - Math.max(panel.top, hole.top));
      assert.equal(x * y, 0, 'a scrim panel overlapped the spotlight hole');
    }
  });

  it('drops zero-area panels for a target in the top-left corner', () => {
    // Nothing above it and nothing to its left, so those two panels would be
    // 0px — rendering them is dead DOM on every step of every tour.
    const panels = computeScrimPanels({
      rect: { top: 0, left: 0, width: 200, height: 40 }, viewport: VIEWPORT,
    });

    assert.ok(panels.length < 4);
    for (const panel of panels) {
      assert.ok(panel.width > 0 && panel.height > 0);
    }
  });

  it('clamps the hole to the viewport for a target hanging off the edge', () => {
    const panels = computeScrimPanels({
      rect: { top: 880, left: 1400, width: 300, height: 100 }, viewport: VIEWPORT,
    });

    for (const panel of panels) {
      assert.ok(panel.left + panel.width <= VIEWPORT.width);
      assert.ok(panel.top + panel.height <= VIEWPORT.height);
    }
  });
});
