import { resetFkResolverMemo } from './fkResolvers.js';
import { clearResolutionCache } from './resolveDependentEntity.js';

/**
 * Per-run state of the generic import (ETP-5676).
 *
 * Several caches exist so one import run does not repeat work across rows — the FK resolver memo,
 * the dependent-entity creation cache, and whatever a window's descriptor keeps (category
 * catalogues, defaults, price-list versions). They are all keyed by session token, so a second
 * file in the same tab would otherwise be answered from the first file's snapshot: a category
 * created or deleted in between would be invisible. A new file is a new run.
 *
 * Core cannot know a descriptor's caches, so descriptors register a reset callback here.
 */
const runResets = new Set();

/** Register a callback that clears one descriptor-owned cache. Returns an unregister function. */
export function registerImportRunReset(reset) {
  runResets.add(reset);
  return () => runResets.delete(reset);
}

/** Start a fresh run: clear the core caches and every registered descriptor cache. */
export function resetImportRun() {
  resetFkResolverMemo();
  clearResolutionCache();
  for (const reset of runResets) {
    try {
      reset();
    } catch {
      // One misbehaving reset must not leave the others (or the new file) stale.
    }
  }
}
