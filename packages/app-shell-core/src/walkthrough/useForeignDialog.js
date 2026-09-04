import { useEffect, useState } from 'react';

/**
 * True while a dialog that is NOT part of the walkthrough is open.
 *
 * The overlay sits at `z-walkthrough` (600) so it is visible above the app's own modals and
 * drawers. That is right for a step that points at something *behind* a modal,
 * and wrong the moment the step's target OPENS one: clicking the sales-order
 * line's "Product" field mounts the product search drawer at `z-50`, which the
 * walkthrough's scrim then dims from above — a picker the user was just told to
 * use, greyed out and looking disabled.
 *
 * Widening the spotlight hole was the other option, but a portalled dialog is
 * not one rect (drawer + its own backdrop + a dropdown inside it), and the hole
 * would have to track all of them. Suspending the scrim while ANY foreign
 * dialog is open needs no geometry and no per-flow configuration: the user
 * interacts with the picker exactly as they would outside a tour, and the
 * dimming returns when they close it.
 *
 * Detection is by `role`, not by component: `role="dialog"`/`"alertdialog"` and
 * Radix's popper wrapper cover the drawers, modals and dropdowns this app
 * mounts. Anything inside the overlay itself is ignored — the step card is a
 * `role="dialog"` too, and counting it would suspend the scrim permanently.
 *
 * A dialog that CONTAINS the step's own target is not foreign in the sense that
 * matters: the sales-order flow's last step points at "Confirm order" INSIDE
 * the confirmation modal, and suspending the scrim there would leave that step
 * with no highlight at all. So the target is part of the question.
 *
 * @param {boolean} active Only observes while a tour is running.
 * @param {Element|null} [target] The step's highlighted element, if any.
 * @param {Document} [doc]
 * @returns {boolean}
 */
export function useForeignDialog(active, target = null, doc = globalThis.document) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active || !doc?.body) {
      setOpen(false);
      return undefined;
    }

    const check = () => setOpen(hasForeignDialog(doc, target));
    check();

    // childList/subtree is enough: every dialog here is portalled, so it is
    // ADDED and REMOVED rather than toggled through an attribute. `role` is
    // still watched for the rare in-place case.
    const observer = new MutationObserver(check);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role'],
    });
    return () => observer.disconnect();
  }, [active, target, doc]);

  return open;
}

/** The DOM predicate, exported so it can be exercised directly against jsdom. */
export function hasForeignDialog(doc = globalThis.document, target = null) {
  if (!doc?.querySelectorAll) return false;
  const candidates = doc.querySelectorAll(
    '[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]',
  );
  for (const el of candidates) {
    if (el.closest?.(`[data-testid="${OVERLAY_TESTID}"]`)) continue;
    // The step points INSIDE this dialog -- keep the scrim so the step still
    // has a spotlight.
    if (target && el.contains?.(target)) continue;
    return true;
  }
  return false;
}

/**
 * Must stay in sync with the overlay root's `data-testid`. Kept here (rather
 * than imported) so this module has no React-component dependency and can be
 * tested on its own.
 */
export const OVERLAY_TESTID = 'walkthrough-overlay';
