// @covers packages/app-shell-core/src/walkthrough/useForeignDialog.js
/**
 * Contract of `hasForeignDialog`: which portalled layers suspend the
 * walkthrough scrim and park the step card in the bottom-left corner.
 *
 * The bug that shaped the tooltip case: launching "Create a contact" from the
 * Guided Tutorials menu while already on Contacts showed step 1 parked
 * bottom-left with no highlight for 2-16 s. Closing the Radix dropdown returns
 * focus to its trigger, the trigger's Radix Tooltip opens on that focus, and
 * its `[data-radix-popper-content-wrapper]` was counted as a foreign dialog. A
 * focus-opened tooltip only closes on blur or pointer movement, hence "moving
 * the mouse fixes it". A tooltip is a passive label, never something the user
 * interacts with, so it must not suspend the tour.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { OVERLAY_TESTID, hasForeignDialog } from '../useForeignDialog.js';

function mount(html) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hasForeignDialog', () => {
  it('ignores a Radix tooltip popper (focus-opened tooltip on the launcher)', () => {
    mount(`
      <div data-radix-popper-content-wrapper="">
        <div data-state="delayed-open" data-side="bottom">Guided tutorials
          <span role="tooltip" id="radix-1">Guided tutorials</span>
        </div>
      </div>`);
    expect(hasForeignDialog(document)).toBe(false);
  });

  it('still reports a Radix dropdown/popover popper as foreign', () => {
    mount(`
      <div data-radix-popper-content-wrapper="">
        <div role="menu"><div role="menuitem">Item</div></div>
      </div>`);
    expect(hasForeignDialog(document)).toBe(true);
  });

  it('reports a dialog even while a tooltip is also open', () => {
    mount(`
      <div data-radix-popper-content-wrapper=""><span role="tooltip">tip</span></div>
      <div role="dialog">Product search</div>`);
    expect(hasForeignDialog(document)).toBe(true);
  });

  it('ignores the walkthrough card and a dialog containing the step target', () => {
    const host = mount(`
      <div data-testid="${OVERLAY_TESTID}"><div role="dialog">card</div></div>
      <div role="alertdialog"><button data-testid="confirm">Confirm</button></div>`);
    const target = host.querySelector('[data-testid="confirm"]');
    expect(hasForeignDialog(document, target)).toBe(false);
  });
});
