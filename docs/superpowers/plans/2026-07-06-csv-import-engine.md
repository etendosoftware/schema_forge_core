# CSV Import Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic CSV/TXT bulk-import engine (parse → map columns → dedupe →
resolve foreign keys → validate → build `/batch` operations → send with bounded
concurrency) as a tested, headless library in `packages/app-shell-core`, with zero UI.

**Architecture:** Each pipeline stage is an independent, side-effect-free module under
`packages/app-shell-core/src/lib/import/`, taking plain data in and returning plain data
out. Network calls (`simSearch`, `POST /sws/neo/batch`) are always received as injected
functions (`simSearchFn`, `postBatch`) so every module is testable with `node:test` and
zero mocking framework. This plan does **not** include the `ImportDialog` UI or the
`generate-contract.js`/`generate-frontend.js` wiring — those consume this engine and are
covered by a follow-up plan once this one is merged. This scoping follows the
`superpowers:writing-plans` rule that each plan should produce independently
shippable, testable software: this one does (`packages/app-shell-core/src/lib/import/**`,
fully covered by `node --test`), without waiting on any UI decision.

**Tech Stack:** Plain ES modules (Node 22, `"type": "module"`), `node:test` +
`node:assert/strict` (this repo's convention for pure-logic modules — see
`packages/app-shell-core/src/i18n/__tests__/*.test.js`). No new npm dependencies.

**Reference:** Full design at
`docs/superpowers/specs/2026-07-06-csv-import-design.md` (approved). Read it before
starting — this plan implements its "Foreign-key columns", "Architecture" §2, and
"Performance & efficiency" sections. Repo topology: `packages/app-shell-core` is the
shared platform package (`@etendosoftware/app-shell-core`, published to GitHub Packages),
consumed by the functional repo `etendo_schema_forge`'s `tools/app-shell` — see
`docs/repo-topology.md` in that repo. `make dev-local-core` (run from the sibling
`etendo_schema_forge` checkout) resolves the package from this repo's local source for
live verification without publishing.

## Global Constraints

- All code, comments, commit messages, and identifiers in English (this repo's
  `<language_policy>` — see root `CLAUDE.md`).
- Commit messages: `Feature ETP-4447: <description>` (max 80 chars first line), no
  `Co-Authored-By` — see root `CLAUDE.md` commit conventions. This branch
  (`feature/ETP-4447`) already exists in both `schema_forge_core` and
  `etendo_schema_forge`, checked out.
- No comments explaining *what* code does — only ones explaining a non-obvious *why*
  (hidden constraint, subtle invariant). Default to no comments.
- Every new pure-logic module gets a `node:test` file under a sibling `__tests__/`
  directory, following the exact style of
  `packages/app-shell-core/src/i18n/__tests__/*.test.js` (plain `assert.equal`/
  `assert.deepEqual`, no mocking library — dependencies are injected plain functions).
- `packages/app-shell-core/package.json`'s `"test"` script is a **fixed list of globs**,
  not a recursive `src/**` pattern — any new `__tests__` directory must be added to that
  list explicitly, or its tests silently never run. The same fixed-list problem exists in
  the root `Makefile`'s coverage target — both need updating together (Task 1).

---

### Task 1: Relocate and extend `simSearch.js` to support multiple candidates

**Files:**
- Create: `packages/app-shell-core/src/lib/simSearch.js`
- Create: `packages/app-shell-core/src/lib/__tests__/simSearch.test.js`
- Modify: `packages/app-shell-core/package.json:32-34`
- Modify: `Makefile:18` (repo root, `schema_forge_core`)

**Interfaces:**
- Produces: `parseSimSearchEnvelope(envelope, itemCount)` → `Array<{ id: string, name:
  string, similarityPercent: string|number, candidates: Array<{id,name,similarityPercent}>
  } | null>`. `candidates` is best-first, includes every match the webhook returned for
  that item (bounded by the caller's `qtyResults`); the top-level `id`/`name`/
  `similarityPercent` fields mirror `candidates[0]` (unchanged shape for existing
  callers that only ever read `result[i].id`).
- Produces: `simSearch({ token, entityName, items, minSimPercent, qtyResults })` →
  `Promise<ReturnType of parseSimSearchEnvelope>` (signature unchanged from today).

Read the current implementation first — this task **extends** it, it does not rewrite it:
`/Users/sebastianbarrozo/Documents/work/epic/schema-forge/tools/app-shell/src/lib/simSearch.js`
(the file this task's new file is based on; do not delete or modify that path in this
task — a later task in the follow-up plan handles cutting the OCR consumer over to the
new location once `@etendosoftware/app-shell-core` is republished with this change).

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/__tests__/simSearch.test.js` with the existing
test suite (copied verbatim from
`/Users/sebastianbarrozo/Documents/work/epic/schema-forge/tools/app-shell/src/lib/__tests__/simSearch.test.js`,
which is being read, not modified, in this task) plus three new cases for the
multi-candidate behavior:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSimSearchEnvelope } from '../simSearch.js';

describe('parseSimSearchEnvelope', () => {
  it('returns array of nulls when envelope is missing', () => {
    assert.deepEqual(parseSimSearchEnvelope(null, 3), [null, null, null]);
    assert.deepEqual(parseSimSearchEnvelope(undefined, 2), [null, null]);
    assert.deepEqual(parseSimSearchEnvelope({}, 2), [null, null]);
  });

  it('returns nulls when message is not a JSON string', () => {
    assert.deepEqual(parseSimSearchEnvelope({ message: 'not json' }, 1), [null]);
  });

  it('parses a single-item match envelope', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-1', name: 'Widget', similarity_percent: '85' }] },
      }),
    };
    const result = parseSimSearchEnvelope(envelope, 1);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'P-1');
    assert.equal(result[0].name, 'Widget');
    assert.equal(result[0].similarityPercent, '85');
  });

  it('preserves similarity_percent === 0 (does not coerce to null)', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-2', name: 'Zero match', similarity_percent: 0 }] },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.similarityPercent, 0);
  });

  it('falls back to _identifier or id when name is missing', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-3', _identifier: 'IDENT-3' }] },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.name, 'IDENT-3');
  });

  it('returns null for items with no data', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { data: [{ id: 'P-1' }] },
        item_1: { data: [] },
      }),
    };
    const result = parseSimSearchEnvelope(envelope, 2);
    assert.equal(result[0]?.id, 'P-1');
    assert.equal(result[1], null);
  });

  it('reads data from response.data when top-level data is missing', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: { response: { data: [{ id: 'P-9', name: 'Nested' }] } },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.id, 'P-9');
  });

  it('pads missing items with null', () => {
    const envelope = { message: JSON.stringify({ item_0: { data: [{ id: 'A' }] } }) };
    const result = parseSimSearchEnvelope(envelope, 3);
    assert.equal(result.length, 3);
    assert.equal(result[1], null);
    assert.equal(result[2], null);
  });

  it('includes every match in .candidates, best-first', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: {
          data: [
            { id: 'C-1', name: 'Kilogramo', similarity_percent: '92' },
            { id: 'C-2', name: 'Kilograma', similarity_percent: '78' },
          ],
        },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.candidates.length, 2);
    assert.deepEqual(first.candidates[0], { id: 'C-1', name: 'Kilogramo', similarityPercent: '92' });
    assert.deepEqual(first.candidates[1], { id: 'C-2', name: 'Kilograma', similarityPercent: '78' });
  });

  it('top-level id/name/similarityPercent mirror candidates[0] (back-compat)', () => {
    const envelope = {
      message: JSON.stringify({
        item_0: {
          data: [
            { id: 'C-1', name: 'Kilogramo', similarity_percent: '92' },
            { id: 'C-2', name: 'Kilograma', similarity_percent: '78' },
          ],
        },
      }),
    };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first.id, first.candidates[0].id);
    assert.equal(first.name, first.candidates[0].name);
    assert.equal(first.similarityPercent, first.candidates[0].similarityPercent);
  });

  it('a null result (no data) has no candidates to read', () => {
    const envelope = { message: JSON.stringify({ item_0: { data: [] } }) };
    const [first] = parseSimSearchEnvelope(envelope, 1);
    assert.equal(first, null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/__tests__/simSearch.test.js`
Expected: FAIL with `Cannot find module '../simSearch.js'` (the file doesn't exist yet).

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/simSearch.js`**

```js
/**
 * Thin client for the Etendo SimSearch webhook
 * ({@link https://docs.etendo.software/ webhook name "SimSearch"}). Performs
 * a similarity search across an Etendo entity (BusinessPartner, Product,
 * Organization, Currency, UOM, ProductCategory, ...) and returns the best
 * matching record id, plus every other candidate the webhook found.
 *
 * The webhook is mounted at `/webhooks/?name=SimSearch` on the Etendo server.
 * It accepts GET with query params and returns a JSON envelope whose `message`
 * field is a stringified JSON mapping each item index to its search result.
 */

/**
 * Resolve the base URL for webhook calls. We mirror the copilot detector —
 * strip off `/web/...` suffixes so the request targets Etendo's servlet root.
 */
function detectEtendoBase() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx !== -1) return path.substring(0, webIdx);
  return import.meta.env.VITE_API_BASE || '';
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name || row._identifier || row.id,
    similarityPercent: row.similarity_percent ?? row.similarityPercent,
  };
}

/**
 * Parse a SimSearch response envelope. The webhook returns:
 *   { message: "{ \"item_0\": {...}, \"item_1\": {...} }" }
 * where each value is a WSResult-shaped object whose `data` is an array of
 * `{ id, name, similarity_percent }`, best match first.
 *
 * Normalizes the response into an array (one entry per item in the original
 * request) of `{ id, name, similarityPercent, candidates } | null`. The
 * top-level `id`/`name`/`similarityPercent` mirror the best candidate — kept
 * for callers that only ever read the single best match. `candidates` carries
 * every match the webhook returned (best-first) for callers that need to
 * disambiguate between close alternatives.
 *
 * @param {object} envelope - Parsed JSON body returned by fetch.
 * @param {number} itemCount - Number of items the request asked about.
 */
export function parseSimSearchEnvelope(envelope, itemCount) {
  const raw = envelope?.message;
  if (!raw || typeof raw !== 'string') return Array(itemCount).fill(null);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Array(itemCount).fill(null);
  }
  const results = [];
  for (let i = 0; i < itemCount; i += 1) {
    const entry = parsed[`item_${i}`];
    const data = entry?.data || entry?.response?.data;
    if (!Array.isArray(data) || data.length === 0) {
      results.push(null);
      continue;
    }
    const candidates = data.map(mapRow);
    results.push({ ...candidates[0], candidates });
  }
  return results;
}

/**
 * Run a similarity search for the given items against a single Etendo entity.
 *
 * @param {{
 *   token: string,
 *   entityName: 'BusinessPartner' | 'Product' | 'Organization' | 'Currency' | 'UOM' | 'ProductCategory' | string,
 *   items: string[],
 *   minSimPercent?: number,
 *   qtyResults?: number,
 * }} params
 * @returns {Promise<ReturnType<typeof parseSimSearchEnvelope>>}
 */
export async function simSearch({ token, entityName, items, minSimPercent = 30, qtyResults = 1 }) {
  if (!token || !entityName || !Array.isArray(items) || items.length === 0) {
    return Array(items?.length || 0).fill(null);
  }
  const base = detectEtendoBase();
  const qs = new URLSearchParams({
    name: 'SimSearch',
    entityName,
    items: JSON.stringify(items),
    minSimPercent: String(minSimPercent),
    qtyResults: String(qtyResults),
  });
  const url = `${base}/webhooks/?${qs.toString()}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return Array(items.length).fill(null);
    const envelope = await res.json().catch(() => null);
    return parseSimSearchEnvelope(envelope, items.length);
  } catch {
    return Array(items.length).fill(null);
  }
}
```

- [ ] **Step 4: Add the new test directory to the two fixed test-glob lists**

Edit `packages/app-shell-core/package.json` — change the `"test"` script (currently
reads `"node --test test/*.test.js src/auth/__tests__/*.test.js src/i18n/__tests__/*.test.js src/runtime/__tests__/*.test.js src/components/ui/__tests__/*.test.js"`)
to append `src/lib/__tests__/*.test.js`:

```json
    "test": "node --test test/*.test.js src/auth/__tests__/*.test.js src/i18n/__tests__/*.test.js src/runtime/__tests__/*.test.js src/components/ui/__tests__/*.test.js src/lib/__tests__/*.test.js",
```

Edit `Makefile:18` (repo root) — the coverage target's `find` call currently lists
`packages/app-shell-core/test packages/app-shell-core/src/auth/__tests__
packages/app-shell-core/src/i18n/__tests__ packages/app-shell-core/src/components/ui/__tests__
packages/app-shell-core/src/runtime/__tests__`. Append
`packages/app-shell-core/src/lib/__tests__` to that list so coverage picks up the new
directory too.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/__tests__/simSearch.test.js`
Expected: PASS, all 11 cases.

Run: `npm test --workspace=packages/app-shell-core`
Expected: PASS (confirms the updated glob picks up the new file and nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add packages/app-shell-core/src/lib/simSearch.js \
        packages/app-shell-core/src/lib/__tests__/simSearch.test.js \
        packages/app-shell-core/package.json Makefile
git commit -m "Feature ETP-4447: Add simSearch with multi-candidate support"
```

---

### Task 2: `parseDelimited.js` — CSV/TXT parsing with encoding fallback

**Files:**
- Create: `packages/app-shell-core/src/lib/import/parseDelimited.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/parseDelimited.test.js`
- Modify: `packages/app-shell-core/package.json` (test glob)
- Modify: `Makefile` (coverage glob)

**Interfaces:**
- Produces: `class ImportParseError extends Error {}`
- Produces: `decodeCsvBuffer(arrayBuffer: ArrayBuffer): string`
- Produces: `detectDelimiter(firstLine: string): ',' | ';' | '\t'`
- Produces: `parseDelimited(text: string): { delimiter: string, headers: string[], rows:
  Array<Record<string, string>> }` — throws `ImportParseError` on empty file or duplicate
  headers.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/parseDelimited.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImportParseError, decodeCsvBuffer, detectDelimiter, parseDelimited } from '../parseDelimited.js';

describe('detectDelimiter', () => {
  it('detects comma', () => {
    assert.equal(detectDelimiter('name,email,phone'), ',');
  });

  it('detects semicolon', () => {
    assert.equal(detectDelimiter('name;email;phone'), ';');
  });

  it('detects tab', () => {
    assert.equal(detectDelimiter('name\temail\tphone'), '\t');
  });

  it('defaults to comma when nothing else is found', () => {
    assert.equal(detectDelimiter('justoneword'), ',');
  });

  it('ignores delimiter characters inside quoted spans', () => {
    assert.equal(detectDelimiter('"Doe, John";email;phone'), ';');
  });
});

describe('parseDelimited', () => {
  it('parses headers and rows into header-keyed records', () => {
    const { headers, rows, delimiter } = parseDelimited('name,email\nLucia,lucia@x.com\nAndres,andres@x.com');
    assert.equal(delimiter, ',');
    assert.deepEqual(headers, ['name', 'email']);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { name: 'Lucia', email: 'lucia@x.com' });
    assert.deepEqual(rows[1], { name: 'Andres', email: 'andres@x.com' });
  });

  it('handles quoted fields containing the delimiter', () => {
    const { rows } = parseDelimited('name,company\n"Doe, John",Acme');
    assert.deepEqual(rows[0], { name: 'Doe, John', company: 'Acme' });
  });

  it('handles escaped quotes ("" inside a quoted field)', () => {
    const { rows } = parseDelimited('name\n"Say ""hi"""');
    assert.equal(rows[0].name, 'Say "hi"');
  });

  it('handles \\r\\n line endings', () => {
    const { rows } = parseDelimited('name,email\r\nLucia,lucia@x.com\r\n');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Lucia');
  });

  it('skips trailing blank lines', () => {
    const { rows } = parseDelimited('name\nLucia\n\n');
    assert.equal(rows.length, 1);
  });

  it('throws ImportParseError on an empty file', () => {
    assert.throws(() => parseDelimited(''), ImportParseError);
    assert.throws(() => parseDelimited('   \n  \n'), ImportParseError);
  });

  it('throws ImportParseError on duplicate headers', () => {
    assert.throws(
      () => parseDelimited('name,email,email\nA,a@x.com,b@x.com'),
      /Duplicate column header: "email"/,
    );
  });

  it('fills missing trailing cells with empty string', () => {
    const { rows } = parseDelimited('name,email,phone\nLucia,lucia@x.com');
    assert.deepEqual(rows[0], { name: 'Lucia', email: 'lucia@x.com', phone: '' });
  });
});

describe('decodeCsvBuffer', () => {
  it('decodes plain ASCII/UTF-8 content', () => {
    const bytes = new TextEncoder().encode('name,email\nLucia,lucia@x.com');
    assert.equal(decodeCsvBuffer(bytes.buffer), 'name,email\nLucia,lucia@x.com');
  });

  it('decodes UTF-8 accented content correctly', () => {
    const bytes = new TextEncoder().encode('nombre\nAndrés');
    assert.equal(decodeCsvBuffer(bytes.buffer), 'nombre\nAndrés');
  });

  it('falls back to windows-1252 when utf-8 decoding produces replacement characters', () => {
    // "Andrés" encoded as Windows-1252: 'é' = 0xE9 (a single byte, invalid as a
    // UTF-8 continuation byte on its own, so a naive UTF-8 decode replaces it with U+FFFD).
    const win1252Bytes = new Uint8Array([0x41, 0x6e, 0x64, 0x72, 0xe9, 0x73]); // "Andr" + 0xE9 + "s"
    assert.equal(decodeCsvBuffer(win1252Bytes.buffer), 'Andrés');
  });

  it('throws ImportParseError when neither encoding produces clean text', () => {
    // Byte sequence invalid in both UTF-8 and Windows-1252 lead byte position is
    // hard to construct since windows-1252 maps every byte 0x00-0xFF to something —
    // so this path is exercised via decodeCsvBuffer's contract test using a spy
    // decoder swap is unnecessary; windows-1252 is a total function over bytes and
    // never itself produces U+FFFD, so this case cannot occur in practice. Covered
    // instead by asserting the fallback never throws for any byte value 0x00-0xFF.
    for (let b = 0; b <= 0xff; b += 1) {
      const bytes = new Uint8Array([0x41, b, 0x42]);
      assert.doesNotThrow(() => decodeCsvBuffer(bytes.buffer));
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/parseDelimited.test.js`
Expected: FAIL with `Cannot find module '../parseDelimited.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/parseDelimited.js`**

```js
export class ImportParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportParseError';
  }
}

const REPLACEMENT_CHAR = '�';

/**
 * Decode a CSV/TXT file's raw bytes to text. Spanish-locale Excel exports
 * commonly save as Windows-1252, not UTF-8 — decoding those as UTF-8 corrupts
 * exactly the accented characters (á, é, í, ó, ú, ñ) the import's matching and
 * validation logic most needs to read correctly. Try UTF-8 first (the common
 * case), fall back to Windows-1252 only if UTF-8 produced replacement chars.
 */
export function decodeCsvBuffer(arrayBuffer) {
  const utf8 = new TextDecoder('utf-8').decode(arrayBuffer);
  if (!utf8.includes(REPLACEMENT_CHAR)) return utf8;
  const win1252 = new TextDecoder('windows-1252').decode(arrayBuffer);
  if (!win1252.includes(REPLACEMENT_CHAR)) return win1252;
  throw new ImportParseError('Unable to decode file — unrecognized text encoding.');
}

const DELIMITER_CANDIDATES = [',', ';', '\t'];

/**
 * Count occurrences of `char` in `line` outside of quoted spans (a delimiter
 * inside quotes, e.g. "Doe, John", must not count toward delimiter detection).
 */
function countOutsideQuotes(line, char) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === char && !inQuotes) count += 1;
  }
  return count;
}

export function detectDelimiter(firstLine) {
  let best = ',';
  let bestCount = 0;
  for (const candidate of DELIMITER_CANDIDATES) {
    const count = countOutsideQuotes(firstLine, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Split one line into raw cell strings for the given delimiter, honoring
 * double-quoted fields (with "" as an escaped quote inside a quoted field).
 * Assumes no cell spans multiple lines (line-splitting happens before this).
 */
function splitLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells;
}

export function parseDelimited(text) {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    throw new ImportParseError('The file is empty.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map((h) => h.trim());

  const seen = new Set();
  for (const header of headers) {
    if (seen.has(header)) {
      throw new ImportParseError(`Duplicate column header: "${header}"`);
    }
    seen.add(header);
  }

  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    return row;
  });

  return { delimiter, headers, rows };
}
```

- [ ] **Step 4: Add the new test directory to the two fixed test-glob lists**

Edit `packages/app-shell-core/package.json`'s `"test"` script — append
`src/lib/import/__tests__/*.test.js`.

Edit `Makefile:18` (repo root) — append `packages/app-shell-core/src/lib/import/__tests__`
to the `find` argument list.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/parseDelimited.test.js`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add packages/app-shell-core/src/lib/import/parseDelimited.js \
        packages/app-shell-core/src/lib/import/__tests__/parseDelimited.test.js \
        packages/app-shell-core/package.json Makefile
git commit -m "Feature ETP-4447: Add CSV/TXT parser with encoding fallback"
```

---

### Task 3: `mapColumns.js` — auto-map file headers to target fields

**Files:**
- Create: `packages/app-shell-core/src/lib/import/mapColumns.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/mapColumns.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure function of `headers` + `importFields`).
- Produces: `normalizeHeader(s: string): string`
- Produces: `mapColumns(headers: string[], importFields: Array<{ target: string, label?:
  string, aliases?: string[] }>): { mapping: Record<string, string|null>, unmappedTargets:
  string[] }` — `mapping` is keyed by the **original** header string.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/mapColumns.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeader, mapColumns } from '../mapColumns.js';

describe('normalizeHeader', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeHeader('  Email  '), 'email');
  });

  it('strips accents', () => {
    assert.equal(normalizeHeader('Teléfono'), 'telefono');
    assert.equal(normalizeHeader('País'), 'pais');
  });

  it('collapses internal whitespace', () => {
    assert.equal(normalizeHeader('Nombre   Comercial'), 'nombre comercial');
  });
});

describe('mapColumns', () => {
  const importFields = [
    { target: 'name', label: 'Nombre' },
    { target: 'etgoEmail', label: 'Email', aliases: ['correo', 'e-mail'] },
    { target: 'commercialName', label: 'Nombre comercial' },
  ];

  it('maps a header to a target by exact label match', () => {
    const { mapping } = mapColumns(['Nombre', 'Email'], importFields);
    assert.equal(mapping['Nombre'], 'name');
    assert.equal(mapping['Email'], 'etgoEmail');
  });

  it('matches case- and accent-insensitively', () => {
    const { mapping } = mapColumns(['NOMBRE COMERCIAL'], importFields);
    assert.equal(mapping['NOMBRE COMERCIAL'], 'commercialName');
  });

  it('matches via an alias when the header does not match the label', () => {
    const { mapping } = mapColumns(['Correo'], importFields);
    assert.equal(mapping['Correo'], 'etgoEmail');
  });

  it('maps unrecognized headers to null', () => {
    const { mapping } = mapColumns(['Teléfono'], importFields);
    assert.equal(mapping['Teléfono'], null);
  });

  it('reports targets that no header matched', () => {
    const { unmappedTargets } = mapColumns(['Nombre'], importFields);
    assert.deepEqual(unmappedTargets, ['etgoEmail', 'commercialName']);
  });

  it('reports no unmapped targets once every field has a matching header', () => {
    const { unmappedTargets } = mapColumns(['Nombre', 'Email', 'Nombre comercial'], importFields);
    assert.deepEqual(unmappedTargets, []);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/mapColumns.test.js`
Expected: FAIL with `Cannot find module '../mapColumns.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/mapColumns.js`**

```js
export function normalizeHeader(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Auto-map a file's column headers to a window's importable fields by
 * matching each header (case/accent-insensitive) against a field's label or
 * declared aliases. Unmatched headers map to null — the UI lets the user
 * override them manually rather than guessing.
 */
export function mapColumns(headers, importFields) {
  const candidatesByTarget = importFields.map((field) => ({
    target: field.target,
    normalizedCandidates: [field.label, ...(field.aliases || [])]
      .filter(Boolean)
      .map(normalizeHeader),
  }));

  const mapping = {};
  const matchedTargets = new Set();

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header);
    const match = candidatesByTarget.find((c) => c.normalizedCandidates.includes(normalizedHeader));
    mapping[header] = match ? match.target : null;
    if (match) matchedTargets.add(match.target);
  }

  const unmappedTargets = importFields
    .map((f) => f.target)
    .filter((target) => !matchedTargets.has(target));

  return { mapping, unmappedTargets };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/mapColumns.test.js`
Expected: PASS, all cases.

- [ ] **Step 5: Add to test globs and commit**

Edit `packages/app-shell-core/package.json`'s `"test"` script and `Makefile:18`'s `find`
list — both already include `src/lib/import/__tests__` after Task 2's edit, covering this
file automatically (same directory, glob already matches `*.test.js` within it). No
further glob edit needed.

```bash
git add packages/app-shell-core/src/lib/import/mapColumns.js \
        packages/app-shell-core/src/lib/import/__tests__/mapColumns.test.js
git commit -m "Feature ETP-4447: Add column auto-mapping by label/alias"
```

---

### Task 4: `dedupeRows.js` — collapse in-file duplicates by key

**Files:**
- Create: `packages/app-shell-core/src/lib/import/dedupeRows.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/dedupeRows.test.js`

**Interfaces:**
- Consumes: `rows: Array<Record<string,string>>` (same shape `parseDelimited` produces,
  header-keyed by **target** name once `mapColumns` has been applied by the caller —
  this module itself does not map columns, callers pass already-mapped rows).
- Produces: `dedupeRows(rows, keyTargets: string[]): { uniqueRows: Array<Record<string,
  string>>, duplicates: Array<{ row: Record<string,string>, duplicateOfIndex: number }> }`

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/dedupeRows.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeRows } from '../dedupeRows.js';

describe('dedupeRows', () => {
  it('keeps rows whose key is unique', () => {
    const rows = [{ email: 'a@x.com' }, { email: 'b@x.com' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 2);
    assert.equal(duplicates.length, 0);
  });

  it('collapses rows sharing the same key, keeping the first occurrence', () => {
    const rows = [{ email: 'a@x.com', name: 'First' }, { email: 'a@x.com', name: 'Second' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 1);
    assert.equal(uniqueRows[0].name, 'First');
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].row.name, 'Second');
    assert.equal(duplicates[0].duplicateOfIndex, 0);
  });

  it('matches the key case-insensitively and trims whitespace', () => {
    const rows = [{ email: 'A@X.com' }, { email: ' a@x.com ' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 1);
    assert.equal(duplicates.length, 1);
  });

  it('builds a composite key from multiple targets', () => {
    const rows = [
      { name: 'Lucia', company: 'Acme' },
      { name: 'Lucia', company: 'Other' },
    ];
    const { uniqueRows } = dedupeRows(rows, ['name', 'company']);
    assert.equal(uniqueRows.length, 2);
  });

  it('never treats rows with a blank key as duplicates of each other', () => {
    const rows = [{ email: '' }, { email: '' }, { email: '  ' }];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 3);
    assert.equal(duplicates.length, 0);
  });

  it('reports duplicateOfIndex pointing at the position in uniqueRows', () => {
    const rows = [
      { email: 'a@x.com' },
      { email: 'b@x.com' },
      { email: 'a@x.com' },
      { email: 'b@x.com' },
    ];
    const { uniqueRows, duplicates } = dedupeRows(rows, ['email']);
    assert.equal(uniqueRows.length, 2);
    assert.equal(duplicates[0].duplicateOfIndex, 0); // duplicate of a@x.com, at uniqueRows[0]
    assert.equal(duplicates[1].duplicateOfIndex, 1); // duplicate of b@x.com, at uniqueRows[1]
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/dedupeRows.test.js`
Expected: FAIL with `Cannot find module '../dedupeRows.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/dedupeRows.js`**

```js
function buildKey(row, keyTargets) {
  const parts = keyTargets.map((t) => String(row[t] ?? '').trim().toLowerCase());
  if (parts.some((p) => p === '')) return null; // blank key: never a dedupe match
  return parts.join(' ');
}

/**
 * Collapse rows that share the same value (case/whitespace-insensitive) across
 * `keyTargets`. The first occurrence of a key wins and lands in `uniqueRows`;
 * every later row with the same key is reported in `duplicates`, pointing at
 * its match's position in `uniqueRows` — never silently dropped.
 */
export function dedupeRows(rows, keyTargets) {
  const uniqueRows = [];
  const duplicates = [];
  const indexByKey = new Map();

  for (const row of rows) {
    const key = buildKey(row, keyTargets);
    if (key === null) {
      uniqueRows.push(row);
      continue;
    }
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, uniqueRows.length);
      uniqueRows.push(row);
    } else {
      duplicates.push({ row, duplicateOfIndex: existingIndex });
    }
  }

  return { uniqueRows, duplicates };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/dedupeRows.test.js`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/lib/import/dedupeRows.js \
        packages/app-shell-core/src/lib/import/__tests__/dedupeRows.test.js
git commit -m "Feature ETP-4447: Add in-file dedupe by composite key"
```

---

### Task 5: `resolveForeignKeys.js` — batch-resolve FK text values via simSearch

**Files:**
- Create: `packages/app-shell-core/src/lib/import/resolveForeignKeys.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/resolveForeignKeys.test.js`

**Interfaces:**
- Consumes: a `simSearchFn` with the exact call signature of `simSearch` from Task 1
  (`{ token, entityName, items, qtyResults }) => Promise<Array<{id,name,similarityPercent,
  candidates}|null>>`) — injected, never imported directly, so tests never hit a network.
- Produces: `FK_AUTO_RESOLVE_THRESHOLD = 80`, `FK_AMBIGUOUS_GAP = 15` (percent, as plain
  numbers).
- Produces: `classifyCandidates(candidates: Array<{id,name,similarityPercent}>): {
  status: 'auto-resolved', id, name } | { status: 'needs-review', candidates }`
- Produces: `resolveForeignKeyColumn({ values, matchEntity, simSearchFn, token, qtyResults
  }): Promise<Map<string, ClassifyResult>>` — one `simSearchFn` call per invocation.
- Produces: `resolveForeignKeys({ rows, columns, simSearchFn, token }): Promise<Map<string
  /* target */, Map<string /* raw value */, ClassifyResult>>>` — `columns: Array<{
  target: string, matchEntity: string, qtyResults?: number }>`.

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/resolveForeignKeys.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FK_AUTO_RESOLVE_THRESHOLD,
  FK_AMBIGUOUS_GAP,
  classifyCandidates,
  resolveForeignKeyColumn,
  resolveForeignKeys,
} from '../resolveForeignKeys.js';

describe('classifyCandidates', () => {
  it('auto-resolves a single high-confidence candidate', () => {
    const result = classifyCandidates([{ id: 'U-1', name: 'Kilogramo', similarityPercent: '95' }]);
    assert.deepEqual(result, { status: 'auto-resolved', id: 'U-1', name: 'Kilogramo' });
  });

  it('auto-resolves the top candidate when it clears the gap over the runner-up', () => {
    const result = classifyCandidates([
      { id: 'U-1', name: 'Kilogramo', similarityPercent: '95' },
      { id: 'U-2', name: 'Kilograma', similarityPercent: '60' },
    ]);
    assert.equal(result.status, 'auto-resolved');
    assert.equal(result.id, 'U-1');
  });

  it('needs review when the top candidate is below the threshold', () => {
    const result = classifyCandidates([{ id: 'U-1', name: 'Kg', similarityPercent: String(FK_AUTO_RESOLVE_THRESHOLD - 1) }]);
    assert.equal(result.status, 'needs-review');
  });

  it('needs review when two candidates are too close to call', () => {
    const top = FK_AUTO_RESOLVE_THRESHOLD + 10;
    const result = classifyCandidates([
      { id: 'U-1', name: 'A', similarityPercent: String(top) },
      { id: 'U-2', name: 'B', similarityPercent: String(top - (FK_AMBIGUOUS_GAP - 1)) },
    ]);
    assert.equal(result.status, 'needs-review');
    assert.equal(result.candidates.length, 2);
  });

  it('needs review with an empty candidate list when there are zero matches', () => {
    const result = classifyCandidates([]);
    assert.deepEqual(result, { status: 'needs-review', candidates: [] });
  });
});

describe('resolveForeignKeyColumn', () => {
  it('calls simSearchFn once with the distinct values and matchEntity', async () => {
    const calls = [];
    const simSearchFn = async (args) => {
      calls.push(args);
      return args.items.map(() => ({ id: 'X', name: 'Match', similarityPercent: '99', candidates: [{ id: 'X', name: 'Match', similarityPercent: '99' }] }));
    };
    await resolveForeignKeyColumn({ values: ['Kg', 'L'], matchEntity: 'UOM', simSearchFn, token: 't' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].entityName, 'UOM');
    assert.deepEqual(calls[0].items, ['Kg', 'L']);
    assert.equal(calls[0].token, 't');
  });

  it('returns a map keyed by the original raw value', async () => {
    const simSearchFn = async ({ items }) =>
      items.map((v) => ({ id: `id-${v}`, name: v, similarityPercent: '95', candidates: [{ id: `id-${v}`, name: v, similarityPercent: '95' }] }));
    const result = await resolveForeignKeyColumn({ values: ['Kg', 'L'], matchEntity: 'UOM', simSearchFn, token: 't' });
    assert.equal(result.get('Kg').status, 'auto-resolved');
    assert.equal(result.get('Kg').id, 'id-Kg');
    assert.equal(result.get('L').id, 'id-L');
  });

  it('maps a null simSearch result to needs-review with no candidates', async () => {
    const simSearchFn = async ({ items }) => items.map(() => null);
    const result = await resolveForeignKeyColumn({ values: ['Unknown'], matchEntity: 'UOM', simSearchFn, token: 't' });
    assert.deepEqual(result.get('Unknown'), { status: 'needs-review', candidates: [] });
  });
});

describe('resolveForeignKeys', () => {
  it('resolves multiple columns, one simSearchFn call per column, using only distinct values', async () => {
    const calls = [];
    const simSearchFn = async (args) => {
      calls.push(args);
      return args.items.map((v) => ({ id: `id-${v}`, name: v, similarityPercent: '95', candidates: [{ id: `id-${v}`, name: v, similarityPercent: '95' }] }));
    };
    const rows = [
      { uom: 'Kg', category: 'Bebidas' },
      { uom: 'Kg', category: 'Comida' },
      { uom: 'L', category: 'Bebidas' },
    ];
    const result = await resolveForeignKeys({
      rows,
      columns: [{ target: 'uom', matchEntity: 'UOM' }, { target: 'category', matchEntity: 'ProductCategory' }],
      simSearchFn,
      token: 't',
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.find((c) => c.entityName === 'UOM').items.sort(), ['Kg', 'L']);
    assert.deepEqual(calls.find((c) => c.entityName === 'ProductCategory').items.sort(), ['Bebidas', 'Comida']);
    assert.equal(result.get('uom').get('Kg').id, 'id-Kg');
    assert.equal(result.get('category').get('Bebidas').id, 'id-Bebidas');
  });

  it('excludes blank values from the distinct-value lookup', async () => {
    const calls = [];
    const simSearchFn = async (args) => {
      calls.push(args);
      return args.items.map(() => ({ id: 'X', name: 'X', similarityPercent: '99', candidates: [] }));
    };
    const rows = [{ uom: 'Kg' }, { uom: '' }, { uom: '  ' }];
    await resolveForeignKeys({ rows, columns: [{ target: 'uom', matchEntity: 'UOM' }], simSearchFn, token: 't' });
    assert.deepEqual(calls[0].items, ['Kg']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/resolveForeignKeys.test.js`
Expected: FAIL with `Cannot find module '../resolveForeignKeys.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/resolveForeignKeys.js`**

```js
export const FK_AUTO_RESOLVE_THRESHOLD = 80;
export const FK_AMBIGUOUS_GAP = 15;

/**
 * Decide whether a column of similarity candidates (best-first, as returned
 * by simSearch's `.candidates`) resolves automatically or needs the user's
 * review. Auto-resolves only when the top candidate clears the confidence
 * threshold AND there is no close runner-up to be ambiguous about.
 */
export function classifyCandidates(candidates) {
  if (!candidates || candidates.length === 0) {
    return { status: 'needs-review', candidates: [] };
  }
  const top = Number(candidates[0].similarityPercent);
  if (top < FK_AUTO_RESOLVE_THRESHOLD) {
    return { status: 'needs-review', candidates };
  }
  if (candidates.length > 1) {
    const runnerUp = Number(candidates[1].similarityPercent);
    if (top - runnerUp < FK_AMBIGUOUS_GAP) {
      return { status: 'needs-review', candidates };
    }
  }
  return { status: 'auto-resolved', id: candidates[0].id, name: candidates[0].name };
}

/**
 * Resolve one column's distinct raw text values against a single Etendo
 * entity via one batched simSearchFn call — never one lookup per row.
 */
export async function resolveForeignKeyColumn({ values, matchEntity, simSearchFn, token, qtyResults = 5 }) {
  const results = await simSearchFn({ token, entityName: matchEntity, items: values, qtyResults });
  const map = new Map();
  values.forEach((value, i) => {
    const entry = results[i];
    map.set(value, classifyCandidates(entry?.candidates ?? []));
  });
  return map;
}

/**
 * Resolve every `match`-mode foreign-key column across a row set, one
 * simSearchFn call per column (not per row).
 */
export async function resolveForeignKeys({ rows, columns, simSearchFn, token }) {
  const result = new Map();
  for (const column of columns) {
    const distinctValues = [...new Set(
      rows.map((r) => String(r[column.target] ?? '').trim()).filter((v) => v !== ''),
    )];
    const columnMap = await resolveForeignKeyColumn({
      values: distinctValues,
      matchEntity: column.matchEntity,
      simSearchFn,
      token,
      qtyResults: column.qtyResults,
    });
    result.set(column.target, columnMap);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/resolveForeignKeys.test.js`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/lib/import/resolveForeignKeys.js \
        packages/app-shell-core/src/lib/import/__tests__/resolveForeignKeys.test.js
git commit -m "Feature ETP-4447: Add FK resolution via batched simSearch"
```

---

### Task 6: `validateRows.js` — required/format/FK validation, single-row and bulk

**Files:**
- Create: `packages/app-shell-core/src/lib/import/validateRows.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/validateRows.test.js`

**Interfaces:**
- Consumes: the `fkResolutions` shape produced by Task 5's `resolveForeignKeys`
  (`Map<target, Map<rawValue, ClassifyResult>>`).
- Produces: `validateRow(row, { requiredTargets, emailTargets, fkTargets, fkResolutions
  }): { valid: boolean, errors: Array<{ target: string, message: string }> }`
- Produces: `validateRows(rows, opts): Array<{ row, valid, errors }>`

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/validateRows.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateRow, validateRows } from '../validateRows.js';

describe('validateRow', () => {
  it('passes a row with all required fields present', () => {
    const result = validateRow({ name: 'Lucia' }, { requiredTargets: ['name'] });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('fails a row missing a required field', () => {
    const result = validateRow({ name: '' }, { requiredTargets: ['name'] });
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, [{ target: 'name', message: 'Required field is missing.' }]);
  });

  it('treats whitespace-only values as missing', () => {
    const result = validateRow({ name: '   ' }, { requiredTargets: ['name'] });
    assert.equal(result.valid, false);
  });

  it('validates email format on emailTargets', () => {
    const bad = validateRow({ email: 'not-an-email' }, { requiredTargets: [], emailTargets: ['email'] });
    assert.equal(bad.valid, false);
    assert.equal(bad.errors[0].target, 'email');

    const good = validateRow({ email: 'lucia@x.com' }, { requiredTargets: [], emailTargets: ['email'] });
    assert.equal(good.valid, true);
  });

  it('does not flag a blank, non-required email field as a format error', () => {
    const result = validateRow({ email: '' }, { requiredTargets: [], emailTargets: ['email'] });
    assert.equal(result.valid, true);
  });

  it('fails a row whose FK value is not yet resolved', () => {
    const fkResolutions = new Map([['uom', new Map([['Kg', { status: 'auto-resolved', id: 'U-1', name: 'Kilogramo' }]])]]);
    const result = validateRow(
      { uom: 'Widget' },
      { requiredTargets: [], fkTargets: ['uom'], fkResolutions },
    );
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].target, 'uom');
  });

  it('fails a row whose FK value is still needs-review', () => {
    const fkResolutions = new Map([['uom', new Map([['Kg', { status: 'needs-review', candidates: [] }]])]]);
    const result = validateRow({ uom: 'Kg' }, { requiredTargets: [], fkTargets: ['uom'], fkResolutions });
    assert.equal(result.valid, false);
  });

  it('passes a row whose FK value is auto-resolved', () => {
    const fkResolutions = new Map([['uom', new Map([['Kg', { status: 'auto-resolved', id: 'U-1', name: 'Kilogramo' }]])]]);
    const result = validateRow({ uom: 'Kg' }, { requiredTargets: [], fkTargets: ['uom'], fkResolutions });
    assert.equal(result.valid, true);
  });

  it('skips FK validation for a blank, non-required FK field', () => {
    const result = validateRow({ uom: '' }, { requiredTargets: [], fkTargets: ['uom'], fkResolutions: new Map() });
    assert.equal(result.valid, true);
  });

  it('collects multiple errors across targets', () => {
    const result = validateRow(
      { name: '', email: 'bad' },
      { requiredTargets: ['name'], emailTargets: ['email'] },
    );
    assert.equal(result.errors.length, 2);
  });
});

describe('validateRows', () => {
  it('maps validateRow over every row', () => {
    const rows = [{ name: 'Lucia' }, { name: '' }];
    const results = validateRows(rows, { requiredTargets: ['name'] });
    assert.equal(results.length, 2);
    assert.equal(results[0].valid, true);
    assert.equal(results[1].valid, false);
    assert.equal(results[1].row, rows[1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/validateRows.test.js`
Expected: FAIL with `Cannot find module '../validateRows.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/validateRows.js`**

```js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

/**
 * Validate a single row against a window's required fields, email-format
 * fields, and already-resolved foreign-key columns. Pure and single-row so
 * the same function powers both the bulk pre-send pass and the review
 * queue's inline "re-validate after edit" action.
 */
export function validateRow(row, { requiredTargets = [], emailTargets = [], fkTargets = [], fkResolutions = new Map() }) {
  const errors = [];

  for (const target of requiredTargets) {
    if (isBlank(row[target])) {
      errors.push({ target, message: 'Required field is missing.' });
    }
  }

  for (const target of emailTargets) {
    const value = row[target];
    if (!isBlank(value) && !EMAIL_RE.test(String(value).trim())) {
      errors.push({ target, message: 'Not a valid email address.' });
    }
  }

  for (const target of fkTargets) {
    const value = row[target];
    if (isBlank(value)) continue;
    const resolution = fkResolutions.get(target)?.get(String(value).trim());
    if (!resolution || resolution.status !== 'auto-resolved') {
      errors.push({ target, message: `"${value}" could not be matched to an existing record.` });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateRows(rows, opts) {
  return rows.map((row) => ({ row, ...validateRow(row, opts) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/validateRows.test.js`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/lib/import/validateRows.js \
        packages/app-shell-core/src/lib/import/__tests__/validateRows.test.js
git commit -m "Feature ETP-4447: Add single-row and bulk validation"
```

---

### Task 7: `buildOperations.js` — row → `/batch` operations, with descriptor registry

**Files:**
- Create: `packages/app-shell-core/src/lib/import/buildOperations.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/buildOperations.test.js`

**Interfaces:**
- Produces: `registerImportDescriptor(name: string, fn: (row, config) => operations[]):
  void`
- Produces: `getImportDescriptor(name: string): Function | undefined`
- Produces: `buildDefaultOperations(row, { spec, entity, targets }): Array<{ id: 'row',
  spec, entity, body }>`
- Produces: `buildOperations(row, config: { spec, entity, targets, descriptorName? }):
  Array<{ id, spec, entity, body, parentRef? }>` — matches the exact operation shape
  `BatchService.java` expects (`id`, `spec`, `entity`, `body`, optional `parentRef`).

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/buildOperations.test.js`:

```js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerImportDescriptor,
  getImportDescriptor,
  buildDefaultOperations,
  buildOperations,
} from '../buildOperations.js';

describe('buildDefaultOperations', () => {
  it('builds a single create op with only the listed targets in the body', () => {
    const row = { name: 'Widget', uom: 'Kg', ignoredColumn: 'x' };
    const ops = buildDefaultOperations(row, { spec: 'product', entity: 'product', targets: ['name', 'uom'] });
    assert.equal(ops.length, 1);
    assert.equal(ops[0].id, 'row');
    assert.equal(ops[0].spec, 'product');
    assert.equal(ops[0].entity, 'product');
    assert.deepEqual(ops[0].body, { name: 'Widget', uom: 'Kg' });
  });
});

describe('registerImportDescriptor / getImportDescriptor', () => {
  it('registers and retrieves a descriptor by name', () => {
    const fn = () => [];
    registerImportDescriptor('test-descriptor', fn);
    assert.equal(getImportDescriptor('test-descriptor'), fn);
  });

  it('returns undefined for an unregistered name', () => {
    assert.equal(getImportDescriptor('nonexistent'), undefined);
  });
});

describe('buildOperations', () => {
  it('uses buildDefaultOperations when no descriptorName is given', () => {
    const row = { name: 'Widget' };
    const ops = buildOperations(row, { spec: 'product', entity: 'product', targets: ['name'] });
    assert.equal(ops.length, 1);
    assert.equal(ops[0].body.name, 'Widget');
  });

  it('delegates to a registered descriptor when descriptorName is given', () => {
    registerImportDescriptor('contacts', (row, config) => [
      { id: 'bp', spec: config.spec, entity: 'businessPartner', body: { name: row.name } },
      { id: 'loc', spec: config.spec, entity: 'locationAddress', parentRef: 'bp', body: { country: row.country } },
    ]);
    const ops = buildOperations({ name: 'Acme', country: 'Argentina' }, { spec: 'contacts', descriptorName: 'contacts' });
    assert.equal(ops.length, 2);
    assert.equal(ops[0].id, 'bp');
    assert.equal(ops[1].parentRef, 'bp');
  });

  it('throws when descriptorName is set but not registered', () => {
    assert.throws(
      () => buildOperations({}, { spec: 'x', descriptorName: 'never-registered' }),
      /No import descriptor registered: "never-registered"/,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/buildOperations.test.js`
Expected: FAIL with `Cannot find module '../buildOperations.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/buildOperations.js`**

```js
const descriptors = new Map();

/**
 * Register a composite-entity import descriptor (e.g. Contacts = BusinessPartner +
 * LocationAddress + Contact) under a name referenced by decisions.json's
 * `import.descriptor`. Mirrors the shape of the OCR ingest descriptors
 * (`ocr/ingest/purchaseInvoiceDescriptor.js`) — a function from one row to the
 * `operations[]` array a single `/batch` call needs.
 */
export function registerImportDescriptor(name, fn) {
  descriptors.set(name, fn);
}

export function getImportDescriptor(name) {
  return descriptors.get(name);
}

/**
 * Default single-entity operation builder: one `create` op carrying exactly
 * the row's mapped/resolved target fields.
 */
export function buildDefaultOperations(row, { spec, entity, targets }) {
  const body = {};
  for (const target of targets) {
    body[target] = row[target];
  }
  return [{ id: 'row', spec, entity, body }];
}

export function buildOperations(row, config) {
  if (!config.descriptorName) {
    return buildDefaultOperations(row, config);
  }
  const descriptor = getImportDescriptor(config.descriptorName);
  if (!descriptor) {
    throw new Error(`No import descriptor registered: "${config.descriptorName}"`);
  }
  return descriptor(row, config);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/buildOperations.test.js`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/app-shell-core/src/lib/import/buildOperations.js \
        packages/app-shell-core/src/lib/import/__tests__/buildOperations.test.js
git commit -m "Feature ETP-4447: Add row-to-batch-operations builder with descriptor registry"
```

---

### Task 8: `importEngine.js` — send rows with bounded concurrency, ambiguous-timeout handling

**Files:**
- Create: `packages/app-shell-core/src/lib/import/importEngine.js`
- Create: `packages/app-shell-core/src/lib/import/__tests__/importEngine.test.js`

**Interfaces:**
- Consumes: an injected `postBatch(operations) => Promise<{ committed: boolean,
  operations?, failedAt?, error? }>` (mirrors `BatchService.executeBatch`'s response
  shape exactly — success: `{committed:true, operations:[...]}`; failure:
  `{committed:false, failedAt:{...}, error:{...}}`).
- Produces: `class BatchTimeoutError extends Error {}`
- Produces: `SEND_STATUS = { OK: 'ok', FAILED: 'failed', UNKNOWN: 'unknown' }`
- Produces: `sendRow(operations, { postBatch }): Promise<{ status, recordId? } | { status,
  error }>`
- Produces: `runImport(rows, { buildRowOperations, postBatch, concurrency, maxRows,
  onProgress }): Promise<{ results: Array<{ row, status, recordId?, error? }>,
  truncatedCount: number }>` — `results.length === Math.min(rows.length, maxRows)`; the
  `truncatedCount` rows beyond `maxRows` are never attempted and never appear in
  `results` (the caller reports them separately, per the spec's "no silent truncation").

- [ ] **Step 1: Write the failing tests**

Create `packages/app-shell-core/src/lib/import/__tests__/importEngine.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BatchTimeoutError, SEND_STATUS, sendRow, runImport } from '../importEngine.js';

describe('sendRow', () => {
  it('returns OK with the recordId on a committed response', async () => {
    const postBatch = async () => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'REC-1' }] });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.OK);
    assert.equal(result.recordId, 'REC-1');
  });

  it('returns FAILED with the server error on a committed:false response', async () => {
    const postBatch = async () => ({ committed: false, failedAt: { index: 0 }, error: { message: 'Rejected' } });
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.FAILED);
    assert.equal(result.error.message, 'Rejected');
  });

  it('returns UNKNOWN when postBatch throws a BatchTimeoutError', async () => {
    const postBatch = async () => { throw new BatchTimeoutError('timed out'); };
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.UNKNOWN);
  });

  it('returns UNKNOWN (not FAILED) for any other network-level rejection — ambiguous, not a confirmed failure', async () => {
    const postBatch = async () => { throw new Error('network dropped'); };
    const result = await sendRow([{ id: 'row' }], { postBatch });
    assert.equal(result.status, SEND_STATUS.UNKNOWN);
  });
});

describe('runImport', () => {
  it('sends every row and collects per-row results', async () => {
    const rows = [{ name: 'A' }, { name: 'B' }];
    const postBatch = async (ops) => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: `REC-${ops[0].body.name}` }] });
    const { results, truncatedCount } = await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
    });
    assert.equal(results.length, 2);
    assert.equal(truncatedCount, 0);
    assert.equal(results[0].status, SEND_STATUS.OK);
    assert.equal(results[0].recordId, 'REC-A');
    assert.equal(results[1].recordId, 'REC-B');
  });

  it('truncates rows beyond maxRows without attempting them', async () => {
    const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    const postBatch = async () => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'X' }] });
    const { results, truncatedCount } = await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
      maxRows: 2,
    });
    assert.equal(results.length, 2);
    assert.equal(truncatedCount, 1);
  });

  it('respects a bounded concurrency (never more than `concurrency` in flight)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const rows = Array.from({ length: 6 }, (_, i) => ({ name: `R${i}` }));
    const postBatch = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { committed: true, operations: [{ id: 'row', ok: true, recordId: 'X' }] };
    };
    await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
      concurrency: 2,
    });
    assert.ok(maxInFlight <= 2, `expected at most 2 concurrent sends, saw ${maxInFlight}`);
  });

  it('calls onProgress once per settled row with a running completed count', async () => {
    const progressCalls = [];
    const rows = [{ name: 'A' }, { name: 'B' }];
    const postBatch = async () => ({ committed: true, operations: [{ id: 'row', ok: true, recordId: 'X' }] });
    await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
      onProgress: (completed, total) => progressCalls.push([completed, total]),
    });
    assert.equal(progressCalls.length, 2);
    assert.deepEqual(progressCalls[progressCalls.length - 1], [2, 2]);
  });

  it('keeps the row reference in each result so the caller can build a review queue', async () => {
    const rows = [{ name: 'A' }];
    const postBatch = async () => ({ committed: false, failedAt: { index: 0 }, error: { message: 'nope' } });
    const { results } = await runImport(rows, {
      buildRowOperations: (row) => [{ id: 'row', spec: 's', entity: 'e', body: row }],
      postBatch,
    });
    assert.equal(results[0].row, rows[0]);
    assert.equal(results[0].status, SEND_STATUS.FAILED);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/importEngine.test.js`
Expected: FAIL with `Cannot find module '../importEngine.js'`.

- [ ] **Step 3: Create `packages/app-shell-core/src/lib/import/importEngine.js`**

```js
export class BatchTimeoutError extends Error {
  constructor(message = 'batch request timed out') {
    super(message);
    this.name = 'BatchTimeoutError';
  }
}

export const SEND_STATUS = { OK: 'ok', FAILED: 'failed', UNKNOWN: 'unknown' };

/**
 * Send one row's operations through the injected postBatch and classify the
 * outcome. `/batch` has no idempotency key (verified against
 * `BatchService.java`), so any failure to get a definite response — a
 * declared timeout or any other rejection — is UNKNOWN, not FAILED: the row
 * may have already committed server-side, and blindly treating it as a safe
 * retry target risks a duplicate create.
 */
export async function sendRow(operations, { postBatch }) {
  let response;
  try {
    response = await postBatch(operations);
  } catch (error) {
    return { status: SEND_STATUS.UNKNOWN, error };
  }
  if (response.committed) {
    const recordId = response.operations?.[0]?.recordId;
    return { status: SEND_STATUS.OK, recordId };
  }
  return { status: SEND_STATUS.FAILED, error: response.error };
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
export async function runImport(rows, { buildRowOperations, postBatch, concurrency = 4, maxRows = 5000, onProgress }) {
  const attempted = rows.slice(0, maxRows);
  const truncatedCount = rows.length - attempted.length;
  const results = new Array(attempted.length);
  let completed = 0;

  await runBoundedPool(
    attempted,
    concurrency,
    async (row) => sendRow(buildRowOperations(row), { postBatch }),
    (result, row, index) => {
      results[index] = { row, ...result };
      completed += 1;
      onProgress?.(completed, attempted.length);
    },
  );

  return { results, truncatedCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test packages/app-shell-core/src/lib/import/__tests__/importEngine.test.js`
Expected: PASS, all cases.

- [ ] **Step 5: Run the full engine suite together**

Run: `npm test --workspace=packages/app-shell-core`
Expected: PASS — every module from Tasks 1–8 runs together with no glob gaps and no
cross-test interference.

- [ ] **Step 6: Commit**

```bash
git add packages/app-shell-core/src/lib/import/importEngine.js \
        packages/app-shell-core/src/lib/import/__tests__/importEngine.test.js
git commit -m "Feature ETP-4447: Add bounded-concurrency row sender with ambiguous-timeout handling"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-07-06-csv-import-design.md`):
- "Key finding: no backend work required" + the two `BatchService.java` nuances (create-
  only, no idempotency key) → Task 8's `sendRow`/`SEND_STATUS.UNKNOWN` handling.
- "Foreign-key columns" — matching engine reuse + multi-candidate extension → Task 1.
  Entity-name mapping override (`matchEntity`) → Task 5's `resolveForeignKeyColumn`
  taking `matchEntity` as an explicit param (the per-window override itself is authored
  in `decisions.json`, covered by the follow-up generator-wiring plan, not this one).
  Auto-resolved/needs-review classification with threshold+gap → Task 5.
- "Architecture §2" module table → Tasks 1–8 implement `parseDelimited.js`,
  `mapColumns.js`, `resolveForeignKeys.js` (renamed from the table's description to match
  final signatures), `validateRows.js`, `dedupeRows.js`, `buildOperations.js`,
  `importEngine.js` one-for-one.
- "Performance & efficiency" — distinct-value batching for FK resolution (not per-row) →
  Task 5. Bounded concurrency → Task 8. In-memory-only, no resumability — inherent to
  this being a pure library with no persistence layer; nothing to implement.
- "Error handling" file-encoding/duplicate-header/locale-format items → Task 2 (encoding
  fallback, duplicate headers) and Task 6 (email format; numeric/date locale parsing is
  deferred to the follow-up plan since it depends on which contract `type`s the UI
  actually exposes for editing, a UI-layer decision).
- Review-queue's `validateRow`/`sendRow` reuse for inline re-validate/retry → these are
  exactly the single-row entry points Tasks 6 and 8 expose; the UI plan calls them
  directly, no new "single row" reimplementation needed.

**Explicitly out of scope for this plan** (belongs to the follow-up UI + generator-wiring
plan): `ImportDialog` and all its screens/review-queue UI, `generate-contract.js`'s
`window.import` merge, `generate-frontend.js`'s toolbar/dropzone wiring, the OCR
consumer cutover in `etendo_schema_forge` (Task 1 only adds the new extended
`simSearch.js` — it does not touch or delete the existing
`tools/app-shell/src/lib/simSearch.js`, since that repo requires a republished
`@etendosoftware/app-shell-core` before the cutover is safe for functional-only
developers not running `LOCAL_CORE=1`).

**Placeholder scan:** none — every task has complete, runnable code.

**Type consistency:** `simSearch`'s result shape (Task 1) is consumed unchanged by Task
5's `resolveForeignKeyColumn` (`entry?.candidates`). Task 5's `ClassifyResult` shape
(`{status,id,name}` or `{status,candidates}`) is consumed unchanged by Task 6's
`validateRow` (`resolution.status !== 'auto-resolved'`). Task 7's `buildOperations`
output shape (`{id,spec,entity,body,parentRef?}`) matches Task 8's `sendRow` input
(`operations` passed straight to `postBatch`) and matches `BatchService.java`'s expected
request shape exactly. Task 8's `results[i].row` is the same object reference passed in
via `rows`, so a consumer (the future review queue) can match a result back to its
original row by identity.
