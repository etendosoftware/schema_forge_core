export class BatchTimeoutError extends Error {
  constructor(message = 'batch request timed out') {
    super(message);
    this.name = 'BatchTimeoutError';
  }
}

export const SEND_STATUS = { OK: 'ok', FAILED: 'failed', UNKNOWN: 'unknown', DUPLICATE: 'duplicate' };

/**
 * English fallbacks for each classified error KIND — used verbatim only when the caller
 * injects no `translate` function. This mirrors the DEFAULT_LABELS fallback the import UI
 * components already use: a controlled, friendly default, NEVER the raw backend text. The
 * raw text is always preserved separately on `error.raw` for the console/telemetry and the
 * system-error dialog's collapsible report — it is just never the user-facing `message`.
 * Keys match the genericLabels keys the functional app defines, so an injected `translate`
 * (e.g. useUI's `ui`) resolves the same key to a localized string.
 */
const IMPORT_ERROR_FALLBACKS = {
  importErrorRequiredField: (p) => `The field "${p.field}" is required.`,
  importErrorRequiredGeneric: () => 'A required field is missing.',
  importErrorDuplicate: () => 'A record with the same value already exists.',
  importErrorDuplicateIdentifier: () => 'A record with this identifier already exists.',
  importErrorDuplicateUser: () => 'A user with this name already exists for the contact. Try a different name.',
  importErrorValueTooLong: () => 'A value is too long for one of its fields.',
  importErrorGeneric: () => 'This row could not be imported. Open the details for the technical report or contact support.',
};

/** snake_case / camelCase DB column → a human-readable "Title Case" label, self-contained. */
function toReadableFieldLabel(column) {
  const normalized = String(column || '').trim();
  if (!normalized) return 'Field';
  return normalized
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Maps a raw backend diagnostic string to a stable, translatable error KIND — an i18n key,
 * its interpolation params, and whether the outcome is a benign duplicate (a row that
 * already exists server-side: nothing for the user to fix or retry, so it is reported
 * separately from a genuine FAILED outcome — the same wording matches ANY entity's unique
 * index, e.g. "There is already a Business Partner with the same (...). (...) must be
 * unique.").
 *
 * `importEngine.js` is a plain app-shell-core lib and cannot import the functional app's
 * error code (useEntity.normalizeServerError / backendErrors.js), so the KINDS worth
 * recognizing are reimplemented here, self-contained. Anything unrecognized falls through
 * to `importErrorGeneric` — a friendly generic, never the raw dump. Regex gaps are bounded
 * ({1,200}) rather than unbounded to avoid super-linear backtracking (SonarQube S5852).
 */
export function classifyImportError(rawMessage) {
  const msg = typeof rawMessage === 'string' ? rawMessage : '';
  const requiredMatch = msg.match(/null value in column\s+"([^"]+)"\s+of relation/i);
  if (requiredMatch) {
    return { key: 'importErrorRequiredField', params: { field: toReadableFieldLabel(requiredMatch[1]) }, duplicate: false };
  }
  if (/violates\s+not-null\s+constraint/i.test(msg)) {
    return { key: 'importErrorRequiredGeneric', params: {}, duplicate: false };
  }
  if (/duplicate key value violates unique constraint/i.test(msg)) {
    return { key: 'importErrorDuplicate', params: {}, duplicate: true };
  }
  if (
    /ya existe.{1,200}\(.{1,200}\).{1,200}debe ser único/i.test(msg)
    || /there is already.{1,200}\(.{1,200}\).{1,200}must be unique/i.test(msg)
    || /must be unique/i.test(msg)
  ) {
    return { key: 'importErrorDuplicateIdentifier', params: {}, duplicate: true };
  }
  // Etendo auto-creates a portal AD_User for a contact; the derived username can collide
  // with an existing user. Its own top-level `{error:{message}}` shape carries no "must be
  // unique" wording, so it needs its own branch rather than falling into the generic bucket.
  if (/user with the same name already exists/i.test(msg)) {
    return { key: 'importErrorDuplicateUser', params: {}, duplicate: true };
  }
  if (/value too long/i.test(msg)) {
    return { key: 'importErrorValueTooLong', params: {}, duplicate: false };
  }
  return { key: 'importErrorGeneric', params: {}, duplicate: false };
}

/**
 * Turns a classification into the user-facing message. With an injected `translate` it
 * returns the localized string (falling back to the English default if the key is missing —
 * `translate` returning the key unchanged is the "missing" signal, same guard the app's own
 * translate helpers use). With no `translate`, the English default. Never the raw backend text.
 */
function friendlyImportMessage(classification, translate) {
  const { key, params } = classification;
  const fallback = IMPORT_ERROR_FALLBACKS[key](params);
  if (typeof translate !== 'function') return fallback;
  const translated = translate(key, params);
  return translated && translated !== key ? translated : fallback;
}

/**
 * A validation-error op response (NEO status -4, e.g. a field over its AD column length)
 * carries its message under a THIRD shape, distinct from the plain-failure one above:
 * `detail.response.errors` — a map of field name to message (`checkJsonServiceResponse`'s
 * `NeoResponse.error(SC_BAD_REQUEST, responseJson)` passes the whole raw Etendo response
 * through as-is, not a single translated string). Reproduced via a real import row whose
 * commercial name exceeded `C_BPartner.Value`'s 40-char limit: `{"response":{"status":-4,
 * "errors":{"searchKey":"...Value too long..."}}}`. Joins every field's message (usually
 * just one) into a single readable line rather than picking only the first, in case a row
 * fails several field validations at once.
 */
function firstValidationMessage(errors) {
  if (!errors || typeof errors !== 'object') return null;
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;
  return entries.map(([field, msg]) => `${field}: ${msg}`).join('; ');
}

/**
 * Send one row's operations through the injected postBatch and classify the
 * outcome. `/batch` has no idempotency key (verified against
 * `BatchService.java`), so any failure to get a definite response — a
 * declared timeout or any other rejection — is UNKNOWN, not FAILED: the row
 * may have already committed server-side, and blindly treating it as a safe
 * retry target risks a duplicate create.
 */
export async function sendRow(operations, { postBatch, translate } = {}) {
  let response;
  try {
    response = await postBatch(operations);
  } catch (error) {
    // No structured response to inspect at all — the closest thing to a "trace" is the
    // rejection's own stack, which console.error already loses once this bubbles up
    // through a Promise.all in the bounded pool.
    return { status: SEND_STATUS.UNKNOWN, error: Object.assign(error, { raw: error.raw ?? (error.stack || error.message) }) };
  }
  if (response.committed) {
    const recordId = response.operations?.[0]?.recordId;
    return { status: SEND_STATUS.OK, recordId };
  }
  // BatchService.java's documented failure shape is `{ committed: false, error: { message,
  // ... } }`, but a raw unhandled server exception (a genuine 500, not a graceful
  // transactional rollback) doesn't go through that wrapper at all — it comes back as
  // Etendo's generic error envelope, `{ message: "..." }`, with no `.error` key (verified
  // against a real capture: the exact shape `useBatch`'s runBatch returns unmodified for
  // any non-ok response that happens to parse as JSON). Reading only `response.error` for
  // that shape produced `undefined`, so the real backend exception text was silently
  // dropped and the UI showed nothing more useful than "Unknown error" — logged here so
  // the actual server message is visible in the console for diagnosis, not just discarded.
  const error = response.error ?? { message: response.message || 'Unknown error' };
  if (!response.error) {
    // eslint-disable-next-line no-console
    console.error('[import] /batch returned an unrecognized failure shape — raw response:', response);
  }
  // `error.detail` (when BatchService.java's failureBody set one) is the underlying NEO
  // response for the specific op that got rejected — the actual diagnostic content, not
  // just the generic "Operation 'x' rejected by server" wrapper text. Falls back to a
  // dump of the whole response for the unrecognized-shape case, so there is always
  // *something* to inspect beyond the bare message while this integration is still being
  // debugged (per the user's explicit ask: capture uncontrolled backend errors with their
  // full trace, one at a time, until the pipeline stabilizes).
  const raw = error.raw ?? (error.detail ? JSON.stringify(error.detail, null, 2) : JSON.stringify(response, null, 2));
  // error.message is BatchService.java's own generic wrapper ("Operation 'bp' rejected by
  // server") — always the same text regardless of cause, so classification against it can
  // never match. The real diagnostic text (e.g. Etendo's own "... must be unique." message)
  // lives one level deeper, at error.detail.error.message, whenever NeoCrudHandler attached
  // the underlying NEO response as `detail` (verified against a real capture of a
  // duplicate-key /batch failure). Read that nested message first, falling back to the
  // wrapper only when there's no nested detail. A validation-error op (NEO status -4) uses
  // a third shape instead — detail.response.errors — checked second since a plain-failure
  // op never has both. This is the RAW text used only to CLASSIFY the outcome; it is never
  // shown to the user directly.
  const rawDiagnostic =
    error.detail?.error?.message
    || firstValidationMessage(error.detail?.response?.errors)
    || error.message;
  const classification = classifyImportError(rawDiagnostic);
  const status = classification.duplicate ? SEND_STATUS.DUPLICATE : SEND_STATUS.FAILED;
  // The user-facing message is the classified, friendly (and, when `translate` is injected,
  // localized) text — NEVER `rawDiagnostic`, which can be an uncontrolled backend leak
  // (e.g. an unserialized `com.etendoerp.redis.interfaces.CachedSet@55b0cf12`, ETP-4668).
  // The raw text stays on `error.raw` for the console/telemetry and the system-error
  // dialog's collapsible report, so nothing diagnostic is lost — it just isn't the bubble.
  const message = friendlyImportMessage(classification, translate);
  return { status, error: { ...error, message, raw } };
}

/**
 * Run a bounded-concurrency pool of async `worker(item)` calls over `items`,
 * calling `onSettle(result, item, index)` as each one finishes. No external
 * dependency — a manual cursor-based worker pool.
 */
async function runBoundedPool(items, concurrency, worker, onSettle) {
  let cursor = 0;
  async function runNext() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const result = await worker(items[index], index);
      onSettle(result, items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  await Promise.all(workers);
}

/**
 * Send every row (up to `maxRows`) through `sendRow`, `concurrency` at a
 * time. Rows beyond `maxRows` are never attempted and never appear in
 * `results` — the caller reports `truncatedCount` explicitly rather than
 * silently dropping them.
 */
export async function runImport(rows, { buildRowOperations, postBatch, translate, concurrency = 4, maxRows = 5000, onProgress }) {
  const attempted = rows.slice(0, maxRows);
  const truncatedCount = rows.length - attempted.length;
  const results = new Array(attempted.length);
  let completed = 0;

  await runBoundedPool(
    attempted,
    concurrency,
    // buildRowOperations may itself be async (a composite descriptor awaiting FK
    // resolution) and, unlike postBatch, has no built-in isolation — a descriptor is free
    // to throw (e.g. "country could not be resolved") for a single bad row. Without this
    // try/catch that throw propagates out of runBoundedPool's Promise.all, aborting every
    // other row's send mid-flight (even ones on a different worker slot that were about
    // to succeed) and leaving the caller's await on runImport() rejected with nothing to
    // show the user — reproduced via a real browser run that hung at "Importing... 0%"
    // forever. One row's build failure must show up as that row's own FAILED result,
    // exactly like a postBatch rejection already does in sendRow, never take the whole
    // batch down.
    // `operations` is threaded into every result (success or failure) — not just used
    // internally — so a caller building a diagnostic report (which row, what request was
    // actually sent) has it without needing to recompute buildRowOperations itself.
    async (row) => {
      let operations;
      try {
        operations = await buildRowOperations(row);
      } catch (error) {
        return { status: SEND_STATUS.FAILED, error, operations: null };
      }
      const result = await sendRow(operations, { postBatch, translate });
      return { ...result, operations };
    },
    (result, row, index) => {
      results[index] = { row, ...result };
      completed += 1;
      onProgress?.(completed, attempted.length);
    },
  );

  return { results, truncatedCount };
}
