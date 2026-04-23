import { setPrefill } from './prefillStore';

/**
 * Dispatch a ui_action emitted by a copilot tool.
 *
 * Forward-compatible: unknown ui_action.type values are silently ignored so
 * older SPA versions don't break when the backend starts emitting new types.
 *
 * @param {{type?: string, path?: string, window?: string, values?: object}|null|undefined} uiAction
 * @param {(to: string) => void} navigate  react-router-dom useNavigate() result
 */
export function applyUiAction(uiAction, navigate) {
  if (!uiAction || typeof uiAction !== "object") return;
  if (uiAction.type === "navigate" && typeof uiAction.path === "string") {
    try {
      navigate(uiAction.path);
    } catch (_) {
      // Swallow — navigation failure must not break the chat turn.
    }
    return;
  }
  if (uiAction.type === "prefill_form" && typeof uiAction.window === "string") {
    // Stash values before the form mounts; DetailView reads them in its
    // new-record effect.
    setPrefill(uiAction.window, uiAction.values || {});
  }
}
