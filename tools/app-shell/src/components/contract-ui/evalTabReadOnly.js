/**
 * Evaluate a secondary tab's readOnlyLogic against the header record.
 * Returns true when the tab should block add/edit/delete actions.
 * Existing rows still render — only mutation is suppressed.
 *
 * Extracted into a plain .js module so Node's built-in test runner
 * (which does not understand JSX) can import it directly.
 */
export function evalTabReadOnly(tab, record) {
  if (!tab?.readOnlyLogic) return false;
  try {
    return !!tab.readOnlyLogic(record ?? {});
  } catch {
    return false;
  }
}
