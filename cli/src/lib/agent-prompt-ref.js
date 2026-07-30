/**
 * agent-prompt-ref.js — External file references for `agentPrompt` values.
 *
 * An `agentPrompt` (spec-level `window.agentPrompt` or a field's `agentPrompt`)
 * may either hold the literal prompt text or a reference to an external,
 * separately versioned file. A reference is a string that starts with the
 * sentinel `#REF#` followed by a path RELATIVE to the repo root, e.g.:
 *
 *   "agentPrompt": "#REF#agent-prompts/contacts/spec.md"
 *
 * At CLI time (push-to-neo DB writes and pipeline contract generation) the
 * reference is resolved to the file's trimmed contents, so downstream
 * consumers (ETGO_SF_* tables, contract.mcp.json) only ever see literal text.
 * The prompt files live OUTSIDE `artifacts/` so they can be edited and
 * reviewed independently of the generated pipeline output.
 */

import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';

/** Sentinel that marks an `agentPrompt` value as an external file reference. */
export const AGENT_PROMPT_REF_PREFIX = '#REF#';

/**
 * Resolve a single `agentPrompt` value. If it is a `#REF#` reference, load the
 * referenced file (relative to `promptRoot`) and return its trimmed contents.
 * Any other value (literal text, non-string) is returned unchanged.
 *
 * @param {*} value - The raw agentPrompt value from decisions.json.
 * @param {string} promptRoot - Repo root the reference path is resolved against.
 * @returns {*} Literal prompt text, or the original value when not a reference.
 */
export function resolveAgentPromptValue(value, promptRoot) {
  if (typeof value !== 'string' || !value.startsWith(AGENT_PROMPT_REF_PREFIX)) {
    return value;
  }

  const rawPath = value.slice(AGENT_PROMPT_REF_PREFIX.length).trim();
  if (!rawPath) {
    throw new Error(`agentPrompt ${AGENT_PROMPT_REF_PREFIX} reference has an empty path`);
  }
  if (isAbsolute(rawPath)) {
    throw new Error(
      `agentPrompt ${AGENT_PROMPT_REF_PREFIX} path must be relative to the repo root: "${rawPath}"`
    );
  }

  const root = resolve(promptRoot || process.cwd());
  const target = resolve(root, rawPath);
  const rel = relative(root, target);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `agentPrompt ${AGENT_PROMPT_REF_PREFIX} path escapes the repo root: "${rawPath}"`
    );
  }

  let text;
  try {
    text = readFileSync(target, 'utf8');
  } catch (err) {
    throw new Error(
      `Cannot read agentPrompt ${AGENT_PROMPT_REF_PREFIX} file "${rawPath}" (resolved: ${target}): ${err.message}`
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`agentPrompt ${AGENT_PROMPT_REF_PREFIX} file "${rawPath}" is empty`);
  }
  return trimmed;
}

/** True for non-null objects (arrays included, matching the previous checks). */
function isObject(value) {
  return value !== null && typeof value === 'object';
}

/**
 * Resolve a `#REF#` agentPrompt on a single node in place. No-op when the node
 * is not an object or its `agentPrompt` is not a string.
 */
function resolveNodePrompt(node, promptRoot) {
  if (isObject(node) && typeof node.agentPrompt === 'string') {
    node.agentPrompt = resolveAgentPromptValue(node.agentPrompt, promptRoot);
  }
}

/**
 * Walk a parsed decisions object and resolve every `#REF#` agentPrompt in
 * place: the spec-level `window.agentPrompt`, each entity's `agentPrompt`, and
 * each field's `agentPrompt`. Values that are not references are left
 * untouched. Mutates and returns the same object for convenience.
 *
 * @param {object} decisions - Parsed decisions.json.
 * @param {string} promptRoot - Repo root reference paths are resolved against.
 * @returns {object} The same decisions object with references resolved.
 */
export function resolveAgentPromptRefs(decisions, promptRoot) {
  if (!isObject(decisions)) {
    return decisions;
  }

  resolveNodePrompt(decisions.window, promptRoot);

  const entities = isObject(decisions.entities) ? decisions.entities : null;
  if (!entities) {
    return decisions;
  }

  for (const entity of Object.values(entities)) {
    resolveNodePrompt(entity, promptRoot);
    const fields = isObject(entity) ? entity.fields : null;
    if (!isObject(fields)) {
      continue;
    }
    for (const field of Object.values(fields)) {
      resolveNodePrompt(field, promptRoot);
    }
  }

  return decisions;
}
