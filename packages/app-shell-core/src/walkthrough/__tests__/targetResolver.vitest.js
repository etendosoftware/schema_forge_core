/**
 * Contract of `resolveHighlightBox` (ETP-5144).
 *
 * The bug it exists for, measured live against the compiled stylesheet: a
 * selector field carries `data-testid="field-<key>"` on the bare `<input>`
 * inside its bordered wrapper, and the chevron button is a flex SIBLING of that
 * input. The chevron's right edge sat 20px past the input's, while the wrapper
 * was 38px wider than the input but only 2px taller — so a ring drawn around
 * the element the step RESOLVED to cut straight through the chevron, and the
 * scrim left it dimmed. The control looked broken in half.
 *
 * Widening `spotlightPadding` was rejected as the fix: it would fatten the ring
 * on all four sides of every other field to paper over one asymmetric case.
 * Instead the rule is "climb to the box that PAINTS the field", which is
 * self-limiting — an ancestor qualifies only when it has a visible border AND
 * is barely taller than the target.
 *
 * vitest, not `node --test`: this needs a real `getComputedStyle`. jsdom's
 * `getBoundingClientRect` always reports zeros, so each element's rect is
 * stubbed with the measured numbers above.
 */
import { resolveHighlightBox, isSelectorValid } from '../targetResolver.js';

/** Gives `el` a fixed rect, since jsdom measures nothing. */
function withRect(el, { top = 0, left = 0, width = 0, height = 0 }) {
  el.getBoundingClientRect = () => ({
    top, left, width, height, right: left + width, bottom: top + height, x: left, y: top,
  });
  return el;
}

/**
 * The real `CreatableSearchSelect` anatomy, with the rects measured in the
 * browser: wrapper 340x40, input 302x38 (2px shorter — its own 1px border on
 * each side), chevron a sibling 20px past the input's right edge.
 */
function buildSelectorField({ borderedWrapper = true } = {}) {
  const stack = withRect(document.createElement('div'), { top: 90, left: 9, width: 340, height: 66 });
  const label = document.createElement('label');
  const wrapper = withRect(document.createElement('div'), { top: 118, left: 9, width: 340, height: 40 });
  const input = withRect(document.createElement('input'), { top: 119, left: 9, width: 302, height: 38 });
  const chevron = withRect(document.createElement('button'), { top: 130, left: 315, width: 16, height: 16 });

  if (borderedWrapper) wrapper.style.border = '1px solid rgb(0, 0, 0)';
  stack.append(label, wrapper);
  wrapper.append(input, chevron);
  document.body.append(stack);
  return { stack, wrapper, input, chevron };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('resolveHighlightBox — composite controls', () => {
  it('climbs from the bare input to the bordered wrapper, so the chevron is inside', () => {
    const { wrapper, input, chevron } = buildSelectorField();

    const box = resolveHighlightBox(input);

    expect(box).toBe(wrapper);
    // The whole point, restated as geometry: the chevron's right edge (331) now
    // falls inside the highlighted box (340) instead of 20px outside the
    // input's (311).
    expect(box.getBoundingClientRect().right).toBeGreaterThan(
      chevron.getBoundingClientRect().right,
    );
  });

  it('stops at the field box and NOT at the label+control stack above it', () => {
    // The stack is 26px taller than the input, comfortably past the 16px slack.
    // Without that guard the ring would swallow the label too.
    const { wrapper, input, stack } = buildSelectorField();

    const box = resolveHighlightBox(input);

    expect(box).toBe(wrapper);
    expect(box).not.toBe(stack);
  });

  it('climbs to the wrapper for a chip too, which is shorter than the input it replaces', () => {
    // Picking a value swaps the input for a `SelectorChip`; the wrapper is then
    // more than 2px taller, but still well inside the slack.
    const { wrapper } = buildSelectorField();
    const chip = withRect(document.createElement('span'), { top: 126, left: 13, width: 120, height: 28 });
    wrapper.append(chip);

    expect(resolveHighlightBox(chip)).toBe(wrapper);
  });
});

describe('resolveHighlightBox — leaves a correctly-highlighted field alone', () => {
  it('returns a plain bordered input untouched', () => {
    // A shared `<Input>` paints its own border and its parent is the taller
    // label+control stack, so nothing qualifies. This is the "changes nothing
    // for fields that already worked" guarantee.
    const stack = withRect(document.createElement('div'), { top: 90, left: 9, width: 340, height: 66 });
    const input = withRect(document.createElement('input'), { top: 118, left: 9, width: 340, height: 38 });
    input.style.border = '1px solid rgb(0, 0, 0)';
    stack.append(document.createElement('label'), input);
    document.body.append(stack);

    expect(resolveHighlightBox(input)).toBe(input);
  });

  it('does not climb into an ancestor with NO border, however close in height', () => {
    // "Barely taller" alone is not enough: an unbordered wrapper is a layout
    // div, not the box that paints the field.
    const { input } = buildSelectorField({ borderedWrapper: false });

    expect(resolveHighlightBox(input)).toBe(input);
  });

  it('ignores an ancestor bordered on only three sides', () => {
    // A table cell or a divider row draws one or two edges; that is not a field
    // box, so all four sides are required.
    const { wrapper, input } = buildSelectorField({ borderedWrapper: false });
    wrapper.style.borderTop = '1px solid rgb(0, 0, 0)';
    wrapper.style.borderLeft = '1px solid rgb(0, 0, 0)';
    wrapper.style.borderRight = '1px solid rgb(0, 0, 0)';

    expect(resolveHighlightBox(input)).toBe(input);
  });

  it('gives up after a bounded climb instead of walking to <body>', () => {
    const input = withRect(document.createElement('input'), { top: 0, left: 0, width: 100, height: 20 });
    let parent = document.body;
    // Five unbordered, same-height wrappers: more than the climb allows.
    for (let i = 0; i < 5; i += 1) {
      const next = withRect(document.createElement('div'), { top: 0, left: 0, width: 100, height: 20 });
      parent.append(next);
      parent = next;
    }
    parent.append(input);

    expect(resolveHighlightBox(input)).toBe(input);
  });
});

describe('resolveHighlightBox — nothing to measure', () => {
  it('hands back whatever it was given rather than throwing mid-tour', () => {
    expect(resolveHighlightBox(null)).toBe(null);
    expect(resolveHighlightBox(undefined)).toBe(undefined);

    // A detached node with no owner document (so no `getComputedStyle`).
    const orphan = { getBoundingClientRect: () => ({ height: 10 }) };
    expect(resolveHighlightBox(orphan)).toBe(orphan);

    const notAnElement = { nodeName: 'DIV' };
    expect(resolveHighlightBox(notAnElement)).toBe(notAnElement);
  });

  it('returns an element with no parent as itself', () => {
    const loose = withRect(document.createElement('div'), { width: 10, height: 10 });

    expect(resolveHighlightBox(loose)).toBe(loose);
  });
});

describe('isSelectorValid', () => {
  it('accepts a selector the browser can parse', () => {
    expect(isSelectorValid('[data-testid="field-businessPartnerCategory"]')).toBe(true);
  });

  it('rejects a malformed selector instead of letting querySelector throw', () => {
    // A typo in flow JSON must surface as `invalidSelector`, not as an
    // exception out of the overlay.
    expect(isSelectorValid('[data-testid=')).toBe(false);
    expect(isSelectorValid(':::')).toBe(false);
  });

  it('rejects an empty or non-string selector', () => {
    for (const selector of [undefined, null, '', '   ', 42]) {
      expect(isSelectorValid(selector)).toBe(false);
    }
  });
});
