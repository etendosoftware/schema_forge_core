/**
 * Generic guided-walkthrough engine.
 *
 * The engine is window-agnostic: every route, selector and string it uses comes
 * from flow JSON supplied by the host application (see `flowSchema.js` for the
 * contract). Nothing in this directory may reference a specific window, entity
 * or field.
 */
export { WalkthroughProvider, useWalkthrough } from './WalkthroughProvider.jsx';
export { WalkthroughOverlay } from './WalkthroughOverlay.jsx';
export { WalkthroughLauncher } from './WalkthroughLauncher.jsx';
export { useWalkthroughEngine } from './useWalkthroughEngine.js';
export {
  FINISH_STATUS,
  FLOW_STATUS,
  WALKTHROUGH_PROGRESS_STORAGE_KEY,
  countPendingFlows,
  getFlowStatus,
  isPendingStatus,
  markFlowAbandoned,
  markFlowCompleted,
  markFlowStarted,
  readFlowRecord,
  readProgress,
  recordFlowFinish,
  resetProgress,
} from './walkthroughProgress.js';
export {
  DEFAULT_FLOW_REVISION,
  WALKTHROUGH_SCHEMA_VERSION,
  ADVANCE_MODES,
  PLACEMENTS,
  DEFAULT_NAV_PATH_SPEED_MS,
  NAV_PATH_SPEED_MIN_MS,
  NAV_PATH_SPEED_MAX_MS,
  clampNavPathSpeed,
  collectFlowLabelKeys,
  findMissingFlowLabelKeys,
  normalizeFlow,
  normalizeFlows,
  normalizeRevision,
  normalizeStep,
  testIdSelector,
  validateFlow,
  validateStep,
} from './flowSchema.js';
export { matchRoutePattern } from './routeMatch.js';
export { WalkthroughCursor } from './WalkthroughCursor.jsx';
export { NAV_PATH_ERROR, elementCenter, runNavPath, syntheticClick } from './navPathRunner.js';
export { REDUCED_MOTION_QUERY, useReducedMotion } from './useReducedMotion.js';
export {
  WALKTHROUGH_ERROR,
  isSelectorValid,
  isTargetVisible,
  isValueDisplay,
  readTargetValue,
  resolveTarget,
  waitForTarget,
} from './targetResolver.js';
export { MISSING_TEXT_FALLBACK_KEY, resolveStepText, resetStepTextWarnings } from './stepText.js';
export { useStepText } from './useStepText.js';
export { computeCardPosition, computeScrimPanels } from './cardPlacement.js';
export { useElementRect } from './useElementRect.js';
export { useForeignDialog, hasForeignDialog } from './useForeignDialog.js';
