---
name: classify-rules
description: Classify complex business rules using AI reasoning
---

Read `artifacts/{window}/rules-raw.json` and `artifacts/{window}/schema-raw.json`.

For each rule with `tier: 'human'` and `decision: 'pending'`:
1. Analyze the rule's effects, complexity, DML operations, and Java source analysis
2. Consider the schema context (which fields are affected, their visibility)
3. Produce a classification:
   - recommendation: keep|replace|simplify|omit
   - confidence: 0-1
   - businessDescription: plain language explanation
   - impactIfOmitted: what changes for the user
   - simplificationSuggestion: what to keep if simplify

Write the classified rules to `artifacts/{window}/rules-classified.json`.
Preserve all auto-classified rules unchanged.
