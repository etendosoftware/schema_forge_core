/**
 * Pure geometry for the walkthrough step card: given the highlighted element's
 * viewport rect and the requested placement, decide where to draw the card so
 * it never leaves the viewport. Kept pure so placement is unit-testable without
 * a browser.
 */

const MARGIN = 12;

/**
 * @param {{rect: {top:number,left:number,width:number,height:number}|null,
 *          card: {width:number, height:number},
 *          viewport: {width:number, height:number},
 *          placement?: string, gap?: number}} params
 * @returns {{top:number, left:number, placement:string}}
 */
export function computeCardPosition({ rect, card, viewport, placement = 'auto', gap = 14, padding = 8 }) {
  // Parked out of the way while the step's own target has opened a dialog. The
  // card must stay VISIBLE (the tour did not end, and the step's instruction is
  // what the user is acting on) but must not sit over the picker it told them
  // to use. A fixed corner is deliberate: the dialog's position is unknown to
  // this module, so anything cleverer would be a guess that fails on the next
  // dialog size. Bottom-left, because the app's own dialogs are centred or
  // right-anchored.
  if (placement === 'parked') {
    return {
      top: Math.max(MARGIN, viewport.height - card.height - MARGIN),
      left: MARGIN,
      placement: 'parked',
    };
  }

  if (!rect || placement === 'center') {
    return {
      top: clamp((viewport.height - card.height) / 2, MARGIN, viewport.height - card.height - MARGIN),
      left: clamp((viewport.width - card.width) / 2, MARGIN, viewport.width - card.width - MARGIN),
      placement: 'center',
    };
  }

  // The authored placement is a PREFERENCE, not an order. Honouring it blindly
  // is how the card ends up covering the very field the step asks the user to
  // fill: `right` on a field already at the right edge produces an off-screen
  // card, and the clamp below then slides it back in -- straight over the
  // target. Clamping guarantees "inside the viewport", never "not on top of the
  // element we are pointing at". So every candidate is scored by how much it
  // overlaps the spotlight, and the first one that does not overlap wins.
  const preferred = placement === 'auto'
    ? pickAutoPlacement(rect, card, viewport, gap)
    : placement;
  const candidates = [preferred, ...FALLBACK_ORDER.filter((p) => p !== preferred)];

  let best = null;
  for (const candidate of candidates) {
    const position = positionFor(candidate, rect, card, viewport, gap);
    const overlap = overlapArea(position, card, rect, padding);
    if (overlap === 0) return { ...position, placement: candidate };
    if (best === null || overlap < best.overlap) best = { ...position, placement: candidate, overlap };
  }
  // Every side overlaps (a target larger than the viewport minus the card).
  // Take the least-bad one rather than an arbitrary side.
  return { top: best.top, left: best.left, placement: best.placement };
}

const FALLBACK_ORDER = ['bottom', 'top', 'right', 'left'];

function positionFor(placement, rect, card, viewport, gap) {
  let top;
  let left;
  switch (placement) {
    case 'top':
      top = rect.top - card.height - gap;
      left = rect.left + (rect.width - card.width) / 2;
      break;
    case 'left':
      top = rect.top + (rect.height - card.height) / 2;
      left = rect.left - card.width - gap;
      break;
    case 'right':
      top = rect.top + (rect.height - card.height) / 2;
      left = rect.left + rect.width + gap;
      break;
    case 'bottom':
    default:
      top = rect.top + rect.height + gap;
      left = rect.left + (rect.width - card.width) / 2;
      break;
  }
  return {
    top: clamp(top, MARGIN, Math.max(MARGIN, viewport.height - card.height - MARGIN)),
    left: clamp(left, MARGIN, Math.max(MARGIN, viewport.width - card.width - MARGIN)),
  };
}

/**
 * Overlap in px^2 between the card at `position` and the spotlight hole (the
 * target rect grown by the same padding the scrim uses, so "touching the
 * highlight ring" already counts as covering it).
 */
function overlapArea(position, card, rect, padding) {
  const overlapX = Math.max(0, Math.min(position.left + card.width, rect.left + rect.width + padding)
    - Math.max(position.left, rect.left - padding));
  const overlapY = Math.max(0, Math.min(position.top + card.height, rect.top + rect.height + padding)
    - Math.max(position.top, rect.top - padding));
  return overlapX * overlapY;
}

function pickAutoPlacement(rect, card, viewport, gap) {
  const need = { height: card.height + gap, width: card.width + gap };
  if (viewport.height - (rect.top + rect.height) >= need.height) return 'bottom';
  if (rect.top >= need.height) return 'top';
  if (viewport.width - (rect.left + rect.width) >= need.width) return 'right';
  if (rect.left >= need.width) return 'left';
  return 'bottom';
}

/**
 * The four rectangles that dim everything except the spotlight hole. Returned
 * in viewport coordinates, ready to be applied as `position: fixed` styles.
 */
export function computeScrimPanels({ rect, viewport, padding = 8 }) {
  if (!rect) {
    return [{ top: 0, left: 0, width: viewport.width, height: viewport.height }];
  }
  const hole = {
    top: Math.max(0, rect.top - padding),
    left: Math.max(0, rect.left - padding),
    right: Math.min(viewport.width, rect.left + rect.width + padding),
    bottom: Math.min(viewport.height, rect.top + rect.height + padding),
  };
  return [
    { top: 0, left: 0, width: viewport.width, height: hole.top },
    { top: hole.bottom, left: 0, width: viewport.width, height: Math.max(0, viewport.height - hole.bottom) },
    { top: hole.top, left: 0, width: hole.left, height: Math.max(0, hole.bottom - hole.top) },
    {
      top: hole.top,
      left: hole.right,
      width: Math.max(0, viewport.width - hole.right),
      height: Math.max(0, hole.bottom - hole.top),
    },
  ].filter((panel) => panel.width > 0 && panel.height > 0);
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
