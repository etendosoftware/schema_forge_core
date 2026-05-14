# Generic Preview Infrastructure

**Status:** Fully Implemented (Phases 1 and 2)
**Created:** 2026-05-11
**Completed:** 2026-05-13
**Branch:** feature/ETP-3951
**Author:** Forge (coordinator) + jortolano

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture (Before)](#current-architecture-before)
3. [Target Architecture (After)](#target-architecture-after)
4. [Phase 1 — Generic Preview Infrastructure (Implemented)](#phase-1--generic-preview-infrastructure-implemented)
   - [Piece 1 — ListView preview slot](#piece-1--listview-preview-slot)
   - [Piece 2 — GenericPreviewModal shell](#piece-2--genericpreviewmodal-shell)
   - [Piece 3 — useInvoicePreview hook](#piece-3--useinvoicepreview-hook)
   - [Piece 4 — InvoicePreview component](#piece-4--invoicepreview-component)
   - [Piece 5 — Invoice window migration](#piece-5--invoice-window-migration)
5. [Phase 2 — File Persistence (Implemented)](#phase-2--file-persistence-implemented)
   - [Piece A — Classic table ETGO_PREVIEW_FILE](#piece-a--classic-table-etgo_preview_file)
   - [Piece B — NEO Headless endpoint](#piece-b--neo-headless-endpoint)
   - [Piece C — usePreviewAttachment hook](#piece-c--usepreviewattachment-hook)
   - [Piece D — GenericPreviewModal attachmentConfig prop](#piece-d--genericpreviewmodal-attachmentconfig-prop)
   - [Piece E — Invoice wiring](#piece-e--invoice-wiring)
6. [Technical Gotchas Resolved](#technical-gotchas-resolved)
7. [How to Add a Preview to Any Window](#how-to-add-a-preview-to-any-window)
8. [Design Decisions](#design-decisions)
9. [Files Changed](#files-changed)
10. [Out of Scope](#out-of-scope)

---

## Problem Statement

`InvoicePreviewModal` was a lateral slide-in panel that showed a summary of an invoice when the user clicked a row in the list view. It was built ad-hoc for `sales-invoice` and `purchase-invoice`, and the mechanism that activated it was a workaround:

```js
// purchase-invoice/index.jsx and sales-invoice/index.jsx
let previewRowSetterRef = null;   // mutable module-level ref

function SalesInvoiceTable(props) {
  return (
    <InvoiceHeaderTable
      {...props}
      onNavigate={(row) => previewRowSetterRef?.(row)}   // intercepts navigation
    />
  );
}

export default function SalesInvoiceWindow(props) {
  const [previewRow, setPreviewRow] = useState(null);
  previewRowSetterRef = setPreviewRow;                   // wired at render time
  // ...
}
```

This approach had several problems:

- **Not reusable.** Any other window that wanted a preview panel had to replicate the same hack.
- **Fragile.** `previewRowSetterRef` was a module-level mutable variable. In concurrent renders or HMR scenarios it could point to a stale setter.
- **Not discoverable.** A developer reading `ListView` or a window's `index.jsx` had no indication that this pattern was supported.
- **Coupled layout.** The animation, backdrop, layout, and tab switcher lived inside `InvoicePreviewModal` mixed with invoice-specific business logic. Nothing was reusable.

Additionally, every preview open regenerated the PDF from scratch (1–3 seconds per click), and user-uploaded purchase invoice attachments were lost on modal close.

---

## Current Architecture (Before)

```
ListView
  └─ onNavigate={(row) => navigate(`/${windowName}/${row.id}`)}  ← hardcoded

SalesInvoiceWindow / PurchaseInvoiceWindow
  ├─ previewRowSetterRef (module-level mutable ref)              ← workaround
  ├─ useState(null) → previewRow
  ├─ Table intercepts onNavigate → previewRowSetterRef?.(row)
  └─ renders InvoicePreviewModal manually at JSX root

InvoicePreviewModal
  ├─ Animation, layout, backdrop, tabs                           ← tightly coupled
  ├─ Invoice data (PDF, payments, SIF)                           ← mixed together
  └─ Sub-modals (payment, email, SIF)
```

---

## Target Architecture (After)

```
ListView
  ├─ [existing] onNavigate={(row) => navigate(...)}   ← unchanged when renderPreview absent
  └─ [NEW] renderPreview prop
       └─ row click → setPreviewRow(row) → renderPreview({ row, onClose, onEdit })

GenericPreviewModal                   ← THE modal — shell only, no domain logic
  ├─ Animation state machine
  ├─ Backdrop + click-outside-to-close
  ├─ Two-column layout
  ├─ Right panel: close button, title, subtitle, actionButtons slot, tab switcher, tab content
  └─ Optional left panel management via attachmentConfig (persistence layer)

usePreviewAttachment (hook)           ← generic file persistence layer
  ├─ GET on mount: restores cached file from ETGO_PREVIEW_FILE
  ├─ storeBlob / storeUrl / storeFile: POST to backend
  └─ deleteFile: DELETE from backend

useInvoicePreview (hook)              ← invoice data layer
  ├─ PDF fetching, payment fetching, SIF logic
  └─ All sub-modal state (payment, email, SIF)

InvoicePreview (component)            ← thin wiring layer, NOT a modal itself
  ├─ Calls useInvoicePreview
  ├─ Assembles leftPanel, tabs, actionButtons JSX from hook data
  ├─ Renders GenericPreviewModal with those slots + attachmentConfig
  └─ Renders sub-modals (InvoicePaymentModal, SendDocumentModal, SIF inline modal)

InvoicePreviewModal.jsx               ← re-export stub (backwards compat for tests)
  └─ export { default } from './InvoicePreview.jsx'
```

The key principle: **`GenericPreviewModal` is the only component that acts as a modal.** `InvoicePreview` is content configuration — it has no animation, no backdrop, no layout. When a new window (e.g., sales order) wants a preview, it also uses `GenericPreviewModal` directly (or via its own thin content component).

---

## Phase 1 — Generic Preview Infrastructure (Implemented)

---

### Piece 1 — ListView preview slot

**File:** `tools/app-shell/src/components/contract-ui/ListView.jsx`

#### New props

```ts
// When provided, row clicks open a preview instead of navigating to the detail page.
renderPreview?: (props: {
  row: object,
  onClose: () => void,
  onEdit: (id: string) => void,
}) => ReactNode

// Used when the window needs to open the preview from outside (e.g., after saving
// a new record the user is redirected back to the list and the preview should open).
externalPreviewRow?: object | null

// Called when the user closes a preview that was opened via externalPreviewRow.
onExternalPreviewClose?: () => void
```

#### Behavior

- Without `renderPreview`: existing behavior unchanged (row click navigates to detail page).
- With `renderPreview`: row click sets internal `previewRow` state, calls `renderPreview`.
- `onEdit` passed to `renderPreview` clears the preview state and navigates to `/${windowName}/${id}`.
- `externalPreviewRow` opens the preview from outside (e.g., after-save redirect).

---

### Piece 2 — GenericPreviewModal shell

**File (new):** `tools/app-shell/src/windows/custom/shared/GenericPreviewModal.jsx`

#### Props

```ts
interface GenericPreviewModalProps {
  title: string                  // Bold heading in the right panel header
  subtitle?: string              // Smaller line below the title (e.g. client name)
  leftPanel?: ReactNode          // Left column content. Pass null/undefined to hide the column.
  onClose: () => void            // Called after the slide-out animation (280ms)
  onEdit?: () => void            // Called after the slide-up-right animation (280ms)
  actionButtons?:                // Header actions row
    | ReactNode
    | (controls: { triggerClose: () => void, triggerEdit: () => void }) => ReactNode
  tabs?: Array<{ key: string, label: string, content: ReactNode }>
  initialTab?: string
  attachmentConfig?: AttachmentConfig   // See Phase 2
}
```

#### actionButtons — function form

Use the function form when a button needs to trigger the exit animation:

```jsx
actionButtons={({ triggerEdit }) => (
  <>
    <Button onClick={someAction}>Send</Button>
    <Button onClick={triggerEdit}>Edit</Button>   {/* plays closingUp animation */}
  </>
)}
```

#### Animation state machine

```
opening → open → closing  → onClose() → caller unmounts
                → closingUp → onEdit()  → caller unmounts
```

**IMPORTANT:** Do not unmount this component on the first close signal. Always wait for `onClose` / `onEdit` to be called (after the 280ms exit animation). `ListView` handles this automatically.

---

### Piece 3 — useInvoicePreview hook

**File (new):** `tools/app-shell/src/windows/custom/shared/useInvoicePreview.js`

Centralises all invoice-specific data-fetching, state, and handlers. Returns no JSX — only data and callbacks.

#### Signature

```js
function useInvoicePreview({ invoice, token, apiBaseUrl, specName, onInvoiceUpdated })
```

#### Returns

```ts
{
  // Invoice data
  displayInvoice, isSalesInvoice,
  // PDF (sales invoice) — pdfUrl is the generation endpoint; used as sourceBlob source
  pdfBlob, pdfUrl, pdfLoading, pdfError, handleDownloadPdf,
  // Payments
  installments, payments, loadingPayments,
  totalOutstanding, canAddPayment, isFullyPaid, isDraft, fetchPayments,
  // Display
  status, badgeProps, statusLabel, partnerName, grandTotal,
  // Payment sub-modal
  showPaymentModal, setShowPaymentModal,
  // Email sub-modal
  showSendModal, sendModalClosing, openEmailModal, closeEmailModal,
  // SIF sub-modal
  showSifModal, setShowSifModal, sifPhase, sifResults,
  handleSendToSif, closeSifModal, canSendToSif, sifBodyKey,
}
```

---

### Piece 4 — InvoicePreview component

**File (new):** `tools/app-shell/src/windows/custom/shared/InvoicePreview.jsx`

Thin wiring component. Calls `useInvoicePreview`, assembles JSX slots, renders `GenericPreviewModal` + sub-modals. Contains no data-fetching or business logic.

#### Signature (same as old InvoicePreviewModal)

```jsx
export default function InvoicePreview({
  invoice,
  token,
  apiBaseUrl,
  windowName,
  specName = 'purchase-invoice',
  onClose,
  onEdit,
  onInvoiceUpdated = null,
})
```

#### Internal structure

```
InvoicePreview
  ├─ useInvoicePreview(...)  → p (all data + handlers)
  ├─ leftPanel = isSalesInvoice ? <PdfViewer (pdfBlob)> : null (managed by attachmentConfig)
  ├─ tabs = [{ general: <StatsPanel> }, { messages: <EmptyPanel> }, { history: <EmptyPanel> }]
  ├─ <GenericPreviewModal title subtitle leftPanel tabs actionButtons attachmentConfig onClose onEdit />
  ├─ {p.showPaymentModal && <InvoicePaymentModal>}
  ├─ {p.showSifModal && <SifInlineModal>}
  └─ {p.showSendModal && <SendDocumentModal>}
```

Sub-components (`StatsPanel`, `SectionCard`, `InfoRow`, `EmptyPanel`) are local to this file.

---

### Piece 5 — Invoice window migration

**Files:** `purchase-invoice/index.jsx`, `sales-invoice/index.jsx`

#### Changes

- Removed `previewRowSetterRef` module-level variable.
- Removed `previewRow` state from window component.
- Removed `onNavigate` override in the Table wrapper component.
- Removed manual `<InvoicePreviewModal>` render at the end of the return.
- Added `renderPreview`, `externalPreviewRow`, `onExternalPreviewClose` to `<ListView>`.
- Import updated: `InvoicePreviewModal` → `InvoicePreview`.

```jsx
// purchase-invoice/index.jsx (sales-invoice is identical except specName)
<ListView
  {...props}
  renderPreview={({ row, onClose, onEdit }) => (
    <InvoicePreview
      invoice={row}
      token={token}
      apiBaseUrl={apiBaseUrl}
      windowName={windowName}
      specName="purchase-invoice"
      onClose={onClose}
      onEdit={onEdit}
    />
  )}
  externalPreviewRow={effectiveRecord}
  onExternalPreviewClose={clearSavedRecord}
/>
```

---

## Phase 2 — File Persistence (Implemented)

### Problem

Two pain points remained after Phase 1:

1. **Sales invoice PDF is regenerated on every preview open.** The PDF generation endpoint is slow (1–3 seconds). Every row click triggered a fresh generation, even for completed invoices whose content never changes.
2. **Purchase invoice attachment is lost on close.** When a user drops a file onto the purchase invoice preview it is shown in the UI but never persisted. Reopening the preview starts from an empty drop zone.

### Goal

Allow `GenericPreviewModal` to optionally persist a binary file (PDF or attachment) tied to a document record. The caller declares the persistence rules via a single `attachmentConfig` prop; the infrastructure handles storage and retrieval transparently.

---

### Piece A — Classic table ETGO_PREVIEW_FILE

**Repo:** `com.etendoerp.go`
**Location:** `src-db/database/model/tables/ETGO_PREVIEW_FILE.xml`

#### Table definition

| Column | Type | Notes |
|--------|------|-------|
| `ETGO_PREVIEW_FILE_ID` | `VARCHAR(32)` PK | UUID without hyphens, uppercase |
| `AD_CLIENT_ID` | `VARCHAR(32)` FK | Standard multi-tenancy |
| `AD_ORG_ID` | `VARCHAR(32)` FK | Standard multi-tenancy |
| `ISACTIVE` | `CHAR(1)` | Default `'Y'` |
| `CREATED` | `TIMESTAMP` | Audit |
| `CREATEDBY` | `VARCHAR(32)` FK | Audit |
| `UPDATED` | `TIMESTAMP` | Audit |
| `UPDATEDBY` | `VARCHAR(32)` FK | Audit |
| `RECORD_ID` | `VARCHAR(32)` | PK of the source document (e.g. invoice ID) |
| `SPEC_NAME` | `VARCHAR(100)` | Spec identifier (e.g. `'sales-invoice'`) |
| `FILE_NAME` | `VARCHAR(255)` | Original filename including extension |
| `MIME_TYPE` | `VARCHAR(100)` | MIME type (e.g. `'application/pdf'`) |
| `FILE_DATA` | `CLOB` (text) | Base64-encoded file content |

#### Unique constraint

```sql
UNIQUE (AD_CLIENT_ID, RECORD_ID, SPEC_NAME)
```

One file per (client, document, spec) tuple. Uploading a new file replaces the previous one — no versioning.

#### Important AD metadata

- `FILE_DATA` column must have `AD_REFERENCE_ID = '34'` (Memo). Reference `17` (List) would validate the base64 string against a predefined option list and throw `ValidationException`. See [Technical Gotchas Resolved](#technical-gotchas-resolved).
- `ETGO_PREVIEW_FILE` table must have `ACCESSLEVEL = '3'` (Client + Organization). Level `4` (System Only) restricts writes to client `'0'` only and causes `OBSecurityException` for real users. See [Technical Gotchas Resolved](#technical-gotchas-resolved).

#### Why a dedicated table

Re-using `AD_Image` or `C_Invoice_Attachment` would couple the infrastructure to specific document types. A generic table keyed by `(RECORD_ID, SPEC_NAME)` makes the feature window-agnostic and keeps `GenericPreviewModal` usable for any future window.

#### Why CLOB (Base64) instead of BYTEA

Openbravo OBDal entity layer uses JDBC-mapped types per `AD_REFERENCE_ID`. A CLOB-backed column with reference `34` (Memo) is the simplest path to store arbitrary text content without binary encoding layers. The Base64 overhead (~33%) is acceptable for preview files; the tradeoff avoids custom JDBC binary handling in the NEO servlet.

---

### Piece B — NEO Headless endpoint

**Repo:** `com.etendoerp.go`
**Location:** `src/com/etendoerp/go/schemaforge/NeoPreviewFileService.java`
**Wired in:** `NeoServlet.java` (method dispatch, no new servlet class needed)

#### Endpoint contract

```
GET    /sws/neo/preview-file?specName=<name>&recordId=<id>
       → 200 { fileName, mimeType, fileData: "<base64>" }   (file found)
       → 200 {}                                              (file not found — NOT 404)

POST   /sws/neo/preview-file
       Body: { specName, recordId, fileName, mimeType, fileData: "<base64>" }
       → 200 { id }

DELETE /sws/neo/preview-file?specName=<name>&recordId=<id>
       → 200 {}
       → 404 { error: "Preview file not found" }
```

`fileData` is Base64-encoded to avoid multipart complexity from the React side.

**Why GET returns 200+empty instead of 404:** For documents that have never had a file cached, the frontend fires GET on every modal open. A 404 response causes the browser to log a red network error in the console, which looks alarming to developers even though the missing file is a normal expected state (the user simply hasn't uploaded one yet). Returning `200 + {}` keeps the console clean while allowing `usePreviewAttachment` to distinguish the two cases via `!json.fileData`.

#### Authentication

Standard NEO Bearer token (`Authorization: Bearer <token>`). The endpoint resolves `AD_CLIENT_ID` and `AD_ORG_ID` from the OBContext session — callers never pass these directly.

#### Implementation: native SQL for writes

All write operations (INSERT, UPDATE, DELETE) bypass OBDal entity validation and use `OBDal.getInstance().getSession().createNativeQuery()`. This is intentional — see [Technical Gotchas Resolved](#technical-gotchas-resolved) for why OBDal `save()` and `remove()` cannot be used here.

GET uses a standard `OBQuery` with `setFilterOnReadableClients(false)` and `setFilterOnReadableOrganization(false)` for cross-org reads.

#### Upsert semantics on POST

`savePreviewFile` checks `findByTuple` first:
- Row absent → `INSERT` with a new UUID PK.
- Row present → `UPDATE` of `FILE_NAME`, `MIME_TYPE`, `FILE_DATA`, `UPDATED`, `UPDATEDBY`.

This implements silent replacement (same row, same PK) rather than delete-then-insert, preserving referential integrity.

---

### Piece C — usePreviewAttachment hook

**File (new):** `tools/app-shell/src/windows/custom/shared/usePreviewAttachment.js`

Generic hook that abstracts GET / POST / DELETE against the `preview-file` endpoint. No invoice-specific logic.

#### Signature

```js
function usePreviewAttachment({
  documentId,       // string — PK of the source document
  specName,         // string — e.g. 'sales-invoice'
  storeCondition,   // boolean — when false the hook is a no-op
  token,
  apiBaseUrl,       // window base URL — the hook strips the last path segment to get the neo base
})
```

#### Returns

```ts
{
  storedFile: {
    fileName: string,
    mimeType: string,
    objectUrl: string,   // Blob URL (URL.createObjectURL) — revoked on unmount
  } | null,
  isBusy: boolean,
  storeFailed: boolean,
  storeFile: (file: File) => Promise<void>,              // POST then update storedFile
  storeBlob: (blob: Blob, fileName: string) => Promise<void>,  // POST then update storedFile
  storeUrl: (url: string, fileName: string) => Promise<void>,  // fetch URL → POST
  deleteFile: () => Promise<void>,                       // DELETE + revoke blob URL
}
```

#### Behavior notes

- **On mount (when active):** fires GET. Sets `storedFile` if a cached file is found. Sets `isBusy` during fetch; clears on completion.
- **`storeBlob`:** receives a `Blob` directly (preferred for the sales invoice PDF — avoids re-fetching a Blob URL). POSTs Base64, then calls `applyBlob` to create the local object URL.
- **`storeUrl`:** fetches the URL (with the Bearer token), gets a `Blob`, then calls `storeBlob`. Used as fallback when a Blob is not available.
- **`storeFile`:** wraps a `File` from a drop event — same as `storeBlob` with `file.type`.
- **`deleteFile`:** sends DELETE, revokes the blob URL, sets `storedFile` to `null`.
- **`active` guard:** when `storeCondition=false` or any required param is missing, all methods are no-ops and GET is skipped.
- **Blob URL lifecycle:** `URL.createObjectURL` is called in `applyBlob`. `URL.revokeObjectURL` is called in `revokeUrl`, triggered on unmount and before each new blob is applied.

---

### Piece D — GenericPreviewModal attachmentConfig prop

`GenericPreviewModal` gained one optional prop that wires the persistence layer to the left panel. When `attachmentConfig` is absent, behaviour is identical to Phase 1.

#### New prop

```ts
attachmentConfig?: {
  documentId: string         // PK of the source document
  specName: string           // e.g. 'sales-invoice'
  storeCondition: boolean    // true = manage persistence; false = pass-through (caller's leftPanel used)
  sourceBlob?: Blob          // Blob to cache on first open (preferred over sourceUrl)
  sourceUrl?: string         // URL to fetch and cache (fallback when sourceBlob absent)
  autoFetch?: boolean        // true = show caller's leftPanel while caching in background
  token: string
  apiBaseUrl: string
}
```

#### Left panel behavior with attachmentConfig

```
storeCondition === false  (or documentId/specName absent)
  → left panel uses caller's leftPanel prop as-is (no persistence, same as Phase 1)

storeCondition === true + storedFile !== null
  → left panel shows the cached file:
      · PDF   → <PdfViewer url={objectUrl} />
      · Image → <img src={objectUrl} />
    Delete button (Trash2 icon, top-left) calls deleteFile() — only shown when autoFetch=false

storeCondition === true + storedFile === null + (sourceBlob or sourceUrl) + autoFetch === false
  → shows spinner while caching runs; switches to file view once done

storeCondition === true + storedFile === null + (sourceBlob or sourceUrl) + autoFetch === true
  → shows caller's leftPanel while caching runs in background
    (used for sales invoice: show live PDF immediately, cache silently)
    switches to cached file view on next open

storeCondition === true + storedFile === null + no sourceBlob/sourceUrl
  → shows drop zone (drag & drop UI)
    on file drop → storeFile(file) → switch to file view
```

#### Auto-store effect

`GenericPreviewModal` contains a `useEffect` that fires once per (documentId, specName) pair when `storeCondition=true` and a source is available:

```js
useEffect(() => {
  if (!cfg.storeCondition) return;
  const hasSource = cfg.sourceBlob || cfg.sourceUrl;
  if (!hasSource) return;
  if (attachment.storedFile || attachment.isBusy) return;
  if (autoStoreAttempted.current) return;
  autoStoreAttempted.current = true;
  const fileName = `${cfg.documentId ?? 'preview'}.pdf`;
  if (cfg.sourceBlob) {
    attachment.storeBlob(cfg.sourceBlob, fileName).catch(() => {});
  } else {
    attachment.storeUrl(cfg.sourceUrl, fileName).catch(() => {});
  }
}, [cfg.storeCondition, cfg.sourceBlob, cfg.sourceUrl, cfg.documentId, attachment.storedFile, attachment.isBusy]);
```

The `autoStoreAttempted` ref prevents re-triggering on re-renders within the same modal open.

---

### Piece E — Invoice wiring

**Files:** `InvoicePreview.jsx` (`useInvoicePreview.js` required minor changes)

#### Sales invoice

Sales invoice caches the generated PDF **only when the invoice is completed** (`documentStatus === 'CO'`). For draft invoices the left panel renders a live `<PdfViewer>` from `pdfBlob` (regenerated each open — intentional, since draft content can change).

```jsx
// InvoicePreview.jsx — sales invoice branch
<GenericPreviewModal
  title={...}
  subtitle={...}
  onClose={onClose}
  onEdit={onEdit}
  actionButtons={...}
  tabs={tabs}
  leftPanel={isSalesInvoice && !isCompleted ? <PdfViewer blob={p.pdfBlob} /> : undefined}
  attachmentConfig={isSalesInvoice && isCompleted ? {
    documentId: invoice.id,
    specName: 'sales-invoice',
    storeCondition: true,
    sourceBlob: p.pdfBlob,    // Blob already fetched by useInvoicePreview — no re-fetch
    autoFetch: true,          // show live PDF on first open while caching in background
    token,
    apiBaseUrl,
  } : undefined}
/>
```

`useInvoicePreview` fetches the PDF blob early so it is available as `sourceBlob`. This avoids `usePreviewAttachment` having to re-fetch a Blob URL (which would require a second network round-trip and would not work cross-origin for blob: URLs).

#### Purchase invoice

Purchase invoice always persists whatever the user drops. `storeCondition` is always `true`. The drop zone and file view are fully managed by `GenericPreviewModal` via `attachmentConfig` — no drop zone JSX in `InvoicePreview`. The delete button (Trash2, top-left of the file view) is shown only for purchase invoices (`autoFetch=false`).

```jsx
// InvoicePreview.jsx — purchase invoice branch
<GenericPreviewModal
  title={...}
  subtitle={...}
  onClose={onClose}
  onEdit={onEdit}
  actionButtons={...}
  tabs={tabs}
  attachmentConfig={{
    documentId: invoice.id,
    specName: 'purchase-invoice',
    storeCondition: true,
    // no sourceBlob / sourceUrl — drop zone is shown until user uploads
    token,
    apiBaseUrl,
  }}
/>
```

---

## Technical Gotchas Resolved

These issues were discovered during implementation and required fixes beyond the original plan. Future developers extending `ETGO_PREVIEW_FILE` or similar tables should be aware of them.

---

### 1. FILE_DATA column: AD_REFERENCE_ID must be 34 (Memo), not 17 (List)

**Symptom:** POST returned HTTP 500. Server log showed `ValidationException: Value 'JVBERi0x...' not valid for column FILE_DATA — field value not in list.`

**Root cause:** When `AD_REFERENCE_ID = '17'` (List type), Openbravo's `BaseOBObject.set()` validates the field value against predefined options in `AD_LIST`. A base64-encoded PDF is obviously not in that list. The fix is to use reference type `'34'` (Memo) which maps to a CLOB column with no list validation.

**Fix:**
- `AD_COLUMN.xml`: changed `AD_REFERENCE_ID` for `FILE_DATA` column from `'17'` to `'34'`
- DB hotfix: `UPDATE ad_column SET ad_reference_id = '34' WHERE ad_column_id = '<FILE_DATA_COLUMN_ID>'`
- All writes also use native SQL to bypass OBDal entity validation entirely (defense in depth)

---

### 2. ETGO_PREVIEW_FILE: ACCESSLEVEL must be 3 (Client+Org), not 4 (System Only)

**Symptom:** DELETE returned HTTP 500. Server log showed `OBSecurityException: Entity ETGO_Preview_File has access level System, but current client is non-zero.`

**Root cause:** When `ACCESSLEVEL = '4'` (System Only), Openbravo's `SecurityChecker.checkWriteAccess()` rejects any write (save or remove via OBDal) where `AD_CLIENT_ID != '0'`. Real users always operate in a non-zero client. The table must be `'3'` (Client + Organization) to allow client-owned records.

**Fix:**
- `AD_TABLE.xml`: changed `ACCESSLEVEL` for `ETGO_PREVIEW_FILE` table from `'4'` to `'3'`
- DB hotfix: `UPDATE ad_table SET accesslevel = '3' WHERE ad_table_id = '<TABLE_ID>'`
- All writes use native SQL (`createNativeQuery`) which bypasses `SecurityChecker` — the ACCESSLEVEL fix ensures that future OBDal-based code (e.g., DAL queries, process handlers) also works correctly

---

### 3. OBDal writes are unsafe for this table — use native SQL

Even after fixing ACCESSLEVEL, using `OBDal.getInstance().save(previewFile)` for INSERT triggers entity property validation (issue #1 above). For a CLOB column storing base64 data, validation must be bypassed.

All write operations in `NeoPreviewFileService` use:
```java
OBDal.getInstance().getSession().createNativeQuery("INSERT/UPDATE/DELETE ...")
    .setParameter(...)
    .executeUpdate();
```

This is intentional and documented. OBQuery is still used for reads (GET) because reads do not trigger validation.

---

### 4. Tomcat class reloading requires mtime update

**Symptom:** After editing `NeoPreviewFileService.java` and running `./gradlew smartbuild`, the old behavior persisted. Tomcat loaded the old class.

**Root cause:** Gradle's incremental compiler compares file modification times. If the source file's mtime is older than the compiled `.class` file (possible after file writes via IDE or Write tool), Gradle skips recompilation and Tomcat reloads the old bytecode.

**Fix:** `touch` the source file before running smartbuild:
```bash
touch modules/com.etendoerp.go/src/com/etendoerp/go/schemaforge/NeoPreviewFileService.java
./gradlew smartbuild -Dlocal.context=etendocorepg
```

---

## How to Add a Preview to Any Window

This section is the developer guide for adding a preview panel to a new window.

### Step 1 — Decide what the preview shows

- **Left panel:** PDF, image, summary card, map, or leave absent to hide the column.
- **Right panel tabs:** what data sections does the user need?
- **Action buttons:** what actions are available without opening the full form?
- **File persistence:** should the preview cache a file? If yes, decide `storeCondition` rule.

### Step 2 — Create your preview component

```jsx
// tools/app-shell/src/windows/custom/sales-order/SalesOrderPreview.jsx

import GenericPreviewModal from '@/windows/custom/shared/GenericPreviewModal.jsx';
import { useUI } from '@/i18n';
import { formatAmount } from '@/lib/formatAmount.js';

export default function SalesOrderPreview({ row, token, apiBaseUrl, onClose, onEdit }) {
  const ui = useUI();

  return (
    <GenericPreviewModal
      title={`${row.documentNo}`}
      subtitle={row.businessPartner$_identifier}
      onClose={onClose}
      actionButtons={({ triggerEdit }) => (
        <Button onClick={triggerEdit}>{ui('edit')}</Button>
      )}
      tabs={[
        {
          key: 'general',
          label: ui('general'),
          content: (
            <div className="p-4">
              <p className="text-sm text-gray-500">{formatAmount(row.grandTotalAmount)}</p>
            </div>
          ),
        },
      ]}
      onEdit={() => onEdit(row.id)}
    />
  );
}
```

> If your preview needs data beyond the list row (e.g., line details, related docs), create a
> `useSalesOrderPreview` hook following the same pattern as `useInvoicePreview`.

### Step 3 — Wire it to ListView

```jsx
// tools/app-shell/src/windows/custom/sales-order/index.jsx
import SalesOrderPreview from './SalesOrderPreview.jsx';

<ListView
  {...props}
  renderPreview={({ row, onClose, onEdit }) => (
    <SalesOrderPreview
      row={row}
      token={token}
      apiBaseUrl={apiBaseUrl}
      onClose={onClose}
      onEdit={onEdit}
    />
  )}
/>
```

That is all. Row clicks now open the preview instead of navigating.

### Step 4 — Handle the savedRecord case (optional)

If after saving a new record you want the preview to open automatically when the user returns to the list:

```jsx
const location = useLocation();
const navigate = useNavigate();
const [savedRecord, setSavedRecord] = useState(null);
const effectiveRecord = savedRecord ?? location.state?.savedRecord ?? null;

const clearSavedRecord = useCallback(() => {
  setSavedRecord(null);
  if (location.state?.savedRecord) {
    navigate(location.pathname, { replace: true, state: {} });
  }
}, [location, navigate]);

<ListView
  {...props}
  renderPreview={...}
  externalPreviewRow={effectiveRecord}
  onExternalPreviewClose={clearSavedRecord}
/>
```

### Step 5 — Add file persistence (optional)

To cache a file (PDF or attachment) for the preview, pass `attachmentConfig` to `GenericPreviewModal`:

```jsx
// Pattern A — auto-cache a generated file (e.g. PDF) on first open for completed documents
attachmentConfig={isCompleted ? {
  documentId: row.id,
  specName: 'sales-order',     // must be unique per document type
  storeCondition: true,
  sourceBlob: pdfBlob,         // Blob already fetched (preferred) — or use sourceUrl
  autoFetch: true,             // show leftPanel while caching; switch to cached file next open
  token,
  apiBaseUrl,
} : undefined}

// Pattern B — user-uploaded attachment (no sourceBlob/sourceUrl → drop zone shown)
attachmentConfig={{
  documentId: row.id,
  specName: 'purchase-order',
  storeCondition: true,
  token,
  apiBaseUrl,
}}
```

No backend changes are needed. `ETGO_PREVIEW_FILE` stores files for any `(specName, recordId)` pair. Just pick a unique `specName` for your window.

### Step 6 — Checklist before shipping

- [ ] `GenericPreviewModal` receives a meaningful `title` (no hardcoded strings — use `useUI()`)
- [ ] All user-visible strings use `useUI()` keys — no hardcoded English or Spanish
- [ ] `onClose` is always passed through (never swallowed)
- [ ] If the preview needs its own data fetches, they handle loading and error states
- [ ] Smoke tested: row click opens preview, X closes it, Edit navigates to detail
- [ ] If using `attachmentConfig`: verified that file persists across close/reopen

---

## Design Decisions

### Why GenericPreviewModal is the only "Modal" component

`GenericPreviewModal` owns all modal behaviour: animation, backdrop, layout, click-outside-to-close. `InvoicePreview` is not a modal — it is content configuration. This distinction matters when adding previews for other windows: developers use `GenericPreviewModal` directly, not a wrapper that wraps another wrapper.

### Why useInvoicePreview is a separate hook

The invoice data layer (PDF fetching, payment fetching, SIF submission, 3 sub-modals) is ~150 lines of logic. It would make `InvoicePreview` unreadable if inlined. Extracting it to a hook makes `InvoicePreview` a thin assembly file and makes the data layer independently testable.

### Why InvoicePreview still exists as a separate file

The 3 sub-modals (`InvoicePaymentModal`, `SendDocumentModal`, SIF modal) need their own state and must be rendered as siblings to `GenericPreviewModal`. State requires a React component boundary — it cannot live in a render prop function body. `InvoicePreview` is that boundary. When kept thin (JSX assembly only), it is not a problem.

### Why actionButtons accepts a function form

`triggerEdit` and `triggerClose` are animation callbacks that live inside `GenericPreviewModal`. A button rendered inside `actionButtons` that needs to trigger an animation (e.g., Edit) must call them. The function form `actionButtons={({ triggerEdit }) => ...}` passes these controls to the caller without exposing internal state.

### Why externalPreviewRow is separate from renderPreview

The `savedRecord` case (opening the preview after a save + redirect) is triggered by navigation state, not a row click. Keeping it as a separate prop (`externalPreviewRow`) preserves the responsibility split: `ListView` handles row-click previews; the window handles redirect-triggered previews.

### Why attachmentConfig lives on GenericPreviewModal, not on InvoicePreview

The file persistence feature is not invoice-specific. Any future window using `GenericPreviewModal` (e.g., sales order) can opt in simply by passing `attachmentConfig`. If the prop lived on `InvoicePreview`, each new window's content component would have to re-implement the same persistence UI.

### Why storeCondition is a boolean, not a function

The rendering logic inside `GenericPreviewModal` only needs to know "should I persist now?" at mount time — it does not need to evaluate the condition reactively. A plain boolean is sufficient. The caller (e.g., `InvoicePreview`) evaluates the rule (`documentStatus === 'CO'`) before passing it in.

### Why file data is transmitted as Base64, not multipart

The NEO Headless infrastructure uses a single JSON API surface. Introducing multipart parsing would require a separate code path in the servlet and different content-type handling on the React side. Base64 over JSON stays consistent with the rest of the NEO API and keeps the hook implementation simple.

### Why one row per (client, document, spec) with silent replacement

Preview files are display artefacts, not audit records. When a sales invoice is re-completed and a new PDF is generated, the old cached PDF is stale. Silent replacement (upsert semantics) keeps the cache correct without requiring the UI to reason about versions or conflicts.

### Why sourceBlob is preferred over sourceUrl

`pdfBlob` is already in memory (fetched by `useInvoicePreview`). Passing it as `sourceBlob` avoids a second network fetch. `sourceUrl` cannot be re-fetched from a `blob:` URL after the original Blob URL is revoked, making it unreliable as a caching source. Always prefer `sourceBlob` when a Blob is already available.

### Why autoFetch shows the caller's leftPanel instead of a spinner

For the sales invoice completed case, the user expects to see the PDF immediately. A spinner while caching would be a regression from Phase 1. `autoFetch=true` lets `GenericPreviewModal` show the caller's `leftPanel` (the live PDF viewer) on the first open while silently posting to the backend. Subsequent opens load from the cache.

### Why InvoicePreviewModal.jsx is kept as a re-export stub

The test file `InvoicePreviewModal.vitest.jsx` imports from this path. The stub re-exports `InvoicePreview` so existing tests continue to pass without modification. The stub can be deleted when the test file is updated.

### Why drop zone i18n keys use the dropZone* namespace

`GenericPreviewModal` is a shared, domain-agnostic component. Using `invoicePreview*` keys in a component that serves any window would force future windows to either share invoice-specific labels or duplicate the keys. The `dropZone*` namespace is self-describing and applies universally.

---

## Files Changed

### Phase 1 (implemented)

All paths relative to `tools/app-shell/src/` in `etendo_schema_forge`.

| File | Change type | Notes |
|------|-------------|-------|
| `components/contract-ui/ListView.jsx` | Extension | 3 new optional props; no breaking changes |
| `windows/custom/shared/GenericPreviewModal.jsx` | **New** | Shell component — animation, layout, tabs |
| `windows/custom/shared/useInvoicePreview.js` | **New** | Invoice data hook — all state and fetching |
| `windows/custom/shared/InvoicePreview.jsx` | **New** | Thin wiring component |
| `windows/custom/shared/InvoicePreviewModal.jsx` | Replaced | Re-export stub pointing to InvoicePreview |
| `windows/custom/purchase-invoice/index.jsx` | Simplified | Removed previewRowSetterRef hack |
| `windows/custom/sales-invoice/index.jsx` | Simplified | Removed previewRowSetterRef hack |

### Phase 2 (implemented)

| File | Repo | Change type | Notes |
|------|------|-------------|-------|
| `src-db/database/model/tables/ETGO_PREVIEW_FILE.xml` | `com.etendoerp.go` | **New** | Table DDL |
| `src-db/database/sourcedata/AD_TABLE.xml` | `com.etendoerp.go` | Updated | `ACCESSLEVEL` changed from `4` to `3` |
| `src-db/database/sourcedata/AD_COLUMN.xml` | `com.etendoerp.go` | Updated | `FILE_DATA` column `AD_REFERENCE_ID` changed from `17` to `34` |
| `src/com/etendoerp/go/schemaforge/data/PreviewFile.java` | `com.etendoerp.go` | **New** | OBDal entity class |
| `src/com/etendoerp/go/schemaforge/NeoPreviewFileService.java` | `com.etendoerp.go` | **New** | GET/POST/DELETE service using native SQL for writes |
| `src/com/etendoerp/go/schemaforge/NeoServlet.java` | `com.etendoerp.go` | Updated | Dispatch to `NeoPreviewFileService` for `preview-file` path |
| `windows/custom/shared/usePreviewAttachment.js` | `etendo_schema_forge` | **New** | Generic file persistence hook |
| `windows/custom/shared/GenericPreviewModal.jsx` | `etendo_schema_forge` | Extended | `attachmentConfig` prop + managed left panel + drop zone |
| `windows/custom/shared/InvoicePreview.jsx` | `etendo_schema_forge` | Updated | Pass `attachmentConfig` to GenericPreviewModal for both invoice types |
| `windows/custom/shared/useInvoicePreview.js` | `etendo_schema_forge` | Updated | Fetch `pdfBlob` for `sourceBlob` pass-through |
| `locales/en_US.json` | `etendo_schema_forge` | Extended | Added `dropZone*` keys (4 new keys) |
| `locales/es_ES.json` | `etendo_schema_forge` | Extended | Added `dropZone*` keys (4 new keys, Spanish) |

---

## Out of Scope

- **Preview content for sales-order or any other window.** Infrastructure is ready; a separate ticket defines the product design and implements the content component.
- **File versioning.** The `ETGO_PREVIEW_FILE` table keeps exactly one file per `(client, document, spec)` tuple. Uploading a new file silently replaces the previous one.
- **Bulk file management UI.** No admin screen is planned for viewing or deleting stored preview files outside the preview panel itself.
- **Messages and History tabs.** Both render empty placeholders. Populating them is a separate feature.
- **Mobile / responsive layout.** Preview panel is desktop-only; no changes.
- **Using GenericPreviewModal outside window previews.** It is designed for the list-row-click use case only.
