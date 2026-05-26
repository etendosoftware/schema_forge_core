/**
 * etendo-uuid.js — Etendo-format UUID generation.
 *
 * Etendo IDs are 32-char uppercase hex strings without dashes
 * (e.g. "95E2A8B50A254B2AAE6774B8C2F28120"). This is `make uuid` in
 * JS form: a v4 UUID with dashes stripped and letters uppercased.
 */

import { randomUUID } from 'node:crypto';

/**
 * Generate a fresh Etendo-format UUID.
 *
 * @returns {string} 32-char uppercase hex, no dashes
 */
export function newEtendoId() {
  return randomUUID().replace(/-/g, '').toUpperCase();
}
