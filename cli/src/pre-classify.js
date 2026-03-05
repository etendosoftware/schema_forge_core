import { translateExpression } from './extract-rules.js';

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
      return classifyDisplayLogic(classified);

    case 'callout':
      return classifyCallout(classified);

    case 'validation':
      return classifyValidation(classified);

    default:
      // Unknown type → escalate to human
      classified.tier = 'human';
      classified.decision = 'pending';
      return classified;
  }
}

/**
 * Classify display/readOnly logic rules.
 * Simple expressions (no framework calls) → auto/keep with translated expression.
 * Framework calls → human/pending.
 */
function classifyDisplayLogic(rule) {
  const translated = translateExpression(rule.expression);

  if (translated.success) {
    rule.tier = 'auto';
    rule.autoDecision = 'keep';
    rule.translatedExpression = translated.result;
  } else {
    rule.tier = 'human';
    rule.decision = 'pending';
  }

  return rule;
}

/**
 * Classify callout rules.
 * Low complexity + no DML + ≤2 effects → auto/keep.
 * DML present → human + warnings.
 * High complexity or >2 effects → human/pending.
 */
function classifyCallout(rule) {
  const effectCount = (rule.effects ?? []).length;

  if (rule.hasDmlOperations) {
    rule.tier = 'human';
    rule.decision = 'pending';
    rule.warnings = [];
    if (rule.dmlWarning) {
      rule.warnings.push(rule.dmlWarning);
    }
    return rule;
  }

  if (rule.complexity === 'low' && effectCount <= 2) {
    rule.tier = 'auto';
    rule.autoDecision = 'keep';
    return rule;
  }

  // High complexity or many effects
  rule.tier = 'human';
  rule.decision = 'pending';
  return rule;
}

/**
 * Classify validation rules.
 * Low complexity + no DML → auto/keep.
 * Otherwise → human/pending.
 */
function classifyValidation(rule) {
  if (rule.complexity === 'low' && !rule.hasDmlOperations) {
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
