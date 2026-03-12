/**
 * Deterministic pre-classification of extracted rules.
 *
 * Classifies rules based on their type and structure:
 * - displayLogic / readOnlyLogic: auto-keep if already translated
 * - validation: auto-keep if isSimple
 * - callout: auto-keep if no DML and few effects
 * - process: always human (requires understanding of business logic)
 */

/**
 * Classify a single rule deterministically.
 * Returns the rule augmented with tier ('auto'|'human'),
 * autoDecision (for auto tier), or decision: 'pending' (for human tier).
 */
export function classifyRule(rule) {
  const classified = { ...rule };

  switch (rule.type) {
    case 'displayLogic':
    case 'readOnlyLogic':
      return classifyLogicExpression(classified);

    case 'callout':
      return classifyCallout(classified);

    case 'validation':
      return classifyValidation(classified);

    case 'process':
      // Processes always need human review (business logic decisions)
      classified.tier = 'human';
      classified.decision = 'pending';
      return classified;

    default:
      classified.tier = 'human';
      classified.decision = 'pending';
      return classified;
  }
}

/**
 * Classify display/readOnly logic rules.
 *
 * Supports two formats:
 * - New format (from extract-rules.js): { rawExpression, translated }
 * - Legacy format (from tests/old code): { expression }
 *
 * If already translated → auto/keep.
 * If has raw/expression but can translate → auto/keep.
 * If translation fails (framework calls) → human.
 */
function classifyLogicExpression(rule) {
  // New format: extractor already translated
  if (rule.translated) {
    rule.tier = 'auto';
    rule.autoDecision = 'keep';
    rule.translatedExpression = rule.translated;
    return rule;
  }

  // Legacy format or raw expression needing translation
  const expr = rule.rawExpression || rule.expression;
  if (expr) {
    // Check for framework calls that can't be translated
    if (/OB\.|Utilities\.|checkRule|function\s*\(/.test(expr)) {
      rule.tier = 'human';
      rule.decision = 'pending';
      return rule;
    }

    // Simple expression — translate inline
    const translated = expr
      .replace(/@([A-Za-z_][A-Za-z0-9_]*)@/g, (_, v) => v.charAt(0).toLowerCase() + v.slice(1))
      .replace(/\|/g, '||')
      .replace(/&/g, '&&')
      .replace(/'Y'/g, 'true')
      .replace(/'N'/g, 'false');

    rule.tier = 'auto';
    rule.autoDecision = 'keep';
    rule.translatedExpression = translated;
    return rule;
  }

  // No expression at all — discard
  rule.tier = 'auto';
  rule.autoDecision = 'omit';
  return rule;
}

/**
 * Classify callout rules.
 * - No DML + low/unknown complexity + ≤2 effects → auto/keep
 * - DML present → human
 * - High complexity or many effects → human
 */
function classifyCallout(rule) {
  if (rule.hasDmlOperations) {
    rule.tier = 'human';
    rule.decision = 'pending';
    rule.warnings = rule.dmlWarning ? [rule.dmlWarning] : [];
    return rule;
  }

  const effectCount = (rule.effects ?? []).length;

  // If source wasn't found (complexity: "unknown"), classify based on what we know:
  // - no DML (checked above)
  // - few or no effects → safe to auto-keep as a stub (will need TODO translation)
  if (effectCount <= 2) {
    rule.tier = 'auto';
    rule.autoDecision = 'keep';
    return rule;
  }

  rule.tier = 'human';
  rule.decision = 'pending';
  return rule;
}

/**
 * Classify validation rules.
 * isSimple (from extractor) or low complexity → auto/keep.
 */
function classifyValidation(rule) {
  if (rule.isSimple || (rule.complexity === 'low' && !rule.hasDmlOperations)) {
    rule.tier = 'auto';
    rule.autoDecision = 'keep';
    return rule;
  }

  if (!rule.hasDmlOperations && rule.code && rule.code.length < 200) {
    // Short validation code without DML is usually safe
    rule.tier = 'auto';
    rule.autoDecision = 'keep';
    return rule;
  }

  rule.tier = 'human';
  rule.decision = 'pending';
  return rule;
}

/**
 * Classify an array of rules. Returns classified rules and a summary.
 * @param {Array} rules - Raw rules from extraction
 * @param {Object} options - { skipAi: boolean }
 * @returns {{ rules: Array, summary: { total, autoClassified, humanReview } }}
 */
export function classifyRules(rules, options = {}) {
  const classified = rules.map(rule => classifyRule(rule));

  const autoClassified = classified.filter(r => r.tier === 'auto').length;
  const humanReview = classified.filter(r => r.tier === 'human').length;

  return {
    rules: classified,
    summary: {
      total: classified.length,
      autoClassified,
      humanReview,
    },
  };
}
