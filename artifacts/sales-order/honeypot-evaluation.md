# Classification Honeypot Evaluation — Sales Order

## Overview

Ground truth: 30 rules manually classified by the product owner.
Auto-classifier: Claude (zero-shot, description-only input, no access to expected decisions).

## Distribution

| Decision    | Ground Truth | Auto-classifier |
|-------------|-------------|-----------------|
| keep        | 26          | 23              |
| simplify    | 0           | 3               |
| replace     | 0           | 0               |
| omit        | 4           | 4               |

## Accuracy

- **Overall: 27/30 (90%)**
- **Tricky rules (8): 6/8 (75%)**
- **Omit detection: 4/4 (100%)** — no false negatives on omit

## Misclassifications

| Rule | Type | Name | Ground Truth | Auto | Why it diverged |
|------|------|------|-------------|------|-----------------|
| 3 | callout | SE_Order_BPartnerLocation | keep | simplify | AI saw Cash VAT as reducible; owner considers full logic essential |
| 13 | callout | SL_Order_UpdateLinesDate | keep | simplify | AI saw warning-only callout as simplifiable; owner wants it as-is |
| 18 | process | Copy Lines | keep | simplify | AI thought BOM explosion + hooks could be trimmed; owner wants full functionality |

## Observations

1. **Bias toward simplify**: All 3 errors were keep->simplify. The classifier never omitted something that should be kept (safe failure mode).
2. **Perfect omit detection**: All 4 omit rules (4, 16, 20, 29) were correctly identified — the classifier understands MVP scope.
3. **Tricky rules**: The classifier struggles more with tricky rules (75% vs 90% overall), particularly when a rule *appears* reducible but the owner wants full fidelity.
4. **No false omissions**: The classifier errs on the side of caution — it suggests simplifying rather than omitting. This is a desirable property for a pre-classifier where human review follows.

## Conclusion

90% accuracy is a strong baseline for a zero-shot classifier with only rule descriptions as input. The simplify bias can be addressed by:
- Providing more context about project requirements (e.g., "Cash VAT is a regulatory requirement")
- Adding few-shot examples of keep vs simplify decisions
- Defaulting to keep when confidence is low

The honeypot confirms the pre-classifier is viable for reducing human review effort from ~100% to ~10-25% of rules.
