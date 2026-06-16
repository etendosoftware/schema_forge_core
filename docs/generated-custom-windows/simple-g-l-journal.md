# Simple G/L Journal (Manual Journals)

## Intent

Use this window to record simplified manual accounting journals ("Asientos Manuales") in Etendo GO. It ports the Classic `Simple G/L Journal` window (AD id `B917E8A7B0864ACEA9D941E3B7494E53`) as a 2-level master-detail surface: a journal header plus debit/credit lines. The defining domain rule is that an entry must be **balanced** — the sum of the debit column must equal the sum of the credit column, with a total greater than zero — before it can be saved.

This is **slice 1 of workstream C (Manual Journals Simplified)** under ETP-4244. It provides full CRUD over journals and lines. **Posting is deferred** to workstream D (see Gap assessment).

## What this window should allow

- Create and review journal headers with Description, Document Type, Document Date, Accounting Date, Period, and Currency.
- Capture optional header accounting dimensions (Business Partner, Product, Project, Cost Center, Asset, Sales Campaign, 1st/2nd Dimension) and the Opening / Multi-Ledger flags.
- Add one or more journal lines under a header, each with an account, an optional description, a debit amount, a credit amount, and optional line dimensions.
- See a live **balance footer** below the lines: total debit, total credit, the difference, and a balanced ✓ / unbalanced ✗ badge.
- Be prevented from saving the document while the entry is unbalanced (the Save button is disabled with an explanatory tooltip).

## Interaction model

- **Route:** `/simple-g-l-journal`, `/simple-g-l-journal/:recordId`.
- **Visibility:** visible from the **Finance** menu as **Manual Journals** (es: **Asientos Manuales**), wired via `menus["Manual Journals"]` in both locales.
- **Implementation type:** fully generated window (no custom components, no `NeoHandler` for this slice). CRUD runs through NEO Headless generic CRUD.
- **Window shape:** master-detail. The header entity is `gLJournal` (table `GL_Journal`) and the line entity is `gLJournalLine` (table `GL_JournalLine`). The two Classic auxiliary tabs — `Fact_Acct` (posting result) and `C_Conversion_Rate_Document` (document rates) — are **dropped** (`exclude: true`) for V1.
- **Lines tab layout:** `window.linesLayout = "inlineEditable"`. Rows render inline with pencil/trash hover actions; clicking pencil flips the row into inline edit, trash removes the row after confirmation. See `docs/ui-customization.md` section 13 for the full inline-editable reference.
- An **Attachments** tab is available in the detail tab strip.

## Header fields

| Field (curated) | Column | Visibility | Notes |
|---|---|---|---|
| `documentNo` | DocumentNo | system (read-only) | Auto-sequenced by NEO on POST; shown in the grid, not user-editable. |
| `description` | Description | editable | Required; grid + searchable. |
| `documentType` | C_DocType_ID | editable | Document type selector. |
| `documentDate` | DateDoc | editable | Defaults to today (`@#Date@`). |
| `accountingDate` | DateAcct | editable | Defaults to today. |
| `period` | C_Period_ID | editable | Accounting period. |
| `currency` | C_Currency_ID | editable | Journal currency. |
| `opening` | IsOpening | editable | Marks an opening-balance journal. |
| `multigeneralLedger` | Multi_Gl | editable | Multi-ledger flag. |
| dimensions | C_Bpartner_ID, M_Product_ID, C_Project_ID, C_Costcenter_ID, A_Asset_ID, C_Campaign_ID, User1_ID, User2_ID | editable | Optional accounting dimensions. |
| `rate` | CurrencyRate | system | Derived currency rate, hidden. |
| `posted` | Posted | read-only | Posting status display only (posting deferred). |
| `documentAction`, `accountingSchema`, `totalDebitAmount`, `totalCreditAmount`, `controlAmount`, `currencyRateType`, `gLCategory`, `postingType`, `documentStatus` | — | discarded | Posting/completion-flow and header-total fields not needed in the simplified UI (totals are replaced by the live balance footer). |

## Line entry

| Field (curated) | Column | Visibility | Notes |
|---|---|---|---|
| `lineNo` | Line | system | Auto-sequenced line number. |
| `gLItems` | Account_ID | editable | Account selector (lookup). |
| `accountingCombination` | C_ValidCombination_ID | editable | Accounting-combination selector. |
| `description` | Description | editable | Optional line note. |
| `foreignCurrencyDebit` | AmtSourceDr | editable, amount, required | **Debit** — feeds the balance footer Σ debit. |
| `foreignCurrencyCredit` | AmtSourceCr | editable, amount, required | **Credit** — feeds the balance footer Σ credit. |
| dimensions | C_Bpartner_ID, M_Product_ID, C_Project_ID, C_Activity_ID, C_Campaign_ID, C_Salesregion_ID, User1_ID, User2_ID, A_Asset_ID, C_Costcenter_ID | editable | Optional line accounting dimensions. |
| `debit` / `credit` | AmtAcctDr / AmtAcctCr | system | Posting-derived accounted amounts, hidden from the user. |
| `rate` | CurrencyRate | system | Line currency rate, derived. |
| `openItems`, `financialAccount`, `paymentMethod`, `paymentDate`, `relatedPayment`, `aPRMAddPayment`, `gLItem` | Open_Items, FIN_Financial_Account_ID, FIN_Paymentmethod_ID, Paymentdate, FIN_Payment_ID, EM_Aprm_Addpayment, C_Glitem_ID | discarded | Payment-integration fields dropped for V1 (spec §2). `EM_*` also caught by `discardPatterns`. |

## Balance rule (core behavior)

This window declares `window.balanceFooter = { "debitField": "foreignCurrencyDebit", "creditField": "foreignCurrencyCredit" }`.

- A generic `BalanceFooterPanel` renders below the lines, showing **Total debit**, **Total credit**, **Difference**, and a balanced ✓ / unbalanced ✗ badge.
- The footer sums the saved lines plus any in-progress add-row and any sidebar editing snapshot, so it reflects the live state as the user types.
- The entry is **balanced** only when `Σ debit === Σ credit` **and** the total is greater than zero. An all-zero set is not balanced.
- While the entry is unbalanced, the document **Save** button is disabled and shows the tooltip "El debe y el haber deben ser iguales antes de guardar" / "Debit and credit must be equal before saving".
- Validator rule **F17** enforces that the `debitField` / `creditField` named here exist on the line entity in the generated contract.

## Gap assessment

- **Posting is out of scope for this slice.** There is no Post action, no posting integration, and no scheduled auto-posting. `Posted` is shown read-only for information only; `DocAction` and posting-only fields are discarded. Posting arrives in workstream D (which itself depends on the predefined accounting schema, ETP-4245).
- **Multi-currency document rates** (`C_Conversion_Rate_Document`) and the **posting result view** (`Fact_Acct`) are dropped for V1.
- **Payment integration** on lines (`FIN_*`, add-payment, open items, payment date/id) is dropped for V1.
- The balance footer enforces debit = credit at the UI level; it does not assert that NEO's generic CRUD performs any additional server-side accounting validation beyond persisting the rows.

## Manual verification

1. Open `/simple-g-l-journal` and create a new header. Confirm Description, Document Type, Document/Accounting Date, Period, and Currency can be entered; confirm Document No is shown but not editable.
2. Open the saved record and add a line with a debit of 100 and credit of 0. Confirm the balance footer shows the entry as **unbalanced** and the Save button is disabled.
3. Add a second line with a credit of 100 (debit 0). Confirm the footer flips to **balanced ✓**, the difference reads 0, and Save becomes enabled.
4. Save successfully, then edit a line to make the totals differ (e.g. credit 60). Confirm the footer returns to **unbalanced ✗** and Save is blocked again.
5. Confirm `Posted` is visible but read-only and that no Post/Complete action is offered (posting deferred).
6. Confirm the window appears in the Finance menu as **Manual Journals** (es: **Asientos Manuales**).
