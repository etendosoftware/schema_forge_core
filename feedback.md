# Feedback Log

Append-only log of errors, bugs, and improvement opportunities discovered during development.
Each entry should include: date, context, what happened, and suggested fix or status.

---

## 2026-03-13 — push-to-neo entity matching fails for curated names

**Context:** Pushing Sales Order to NEO Headless via `push-to-neo.js`.
**Problem:** Step 3 (field visibility update) failed for all 63 fields with "no entity" error. The contract uses curated entity names (`order`, `orderLine`) but `PopulateSpec` creates entities with AD tab names (`Header`, `Lines`). The matching logic only tried `tabId` (null in contract) and `entityName` (no match).
**Fix:** Added tableName-based fallback in `push-to-neo.js`. Three-level matching: tabId -> name -> tableName. Commit `1343db6`.
**Status:** Fixed.
