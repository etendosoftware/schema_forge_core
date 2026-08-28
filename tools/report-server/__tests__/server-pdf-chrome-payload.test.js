/**
 * ETP-5013 — every PDF gets page numbers via jsreport's `chrome-pdf` recipe.
 *
 * `payload.template.chrome` grew `displayHeaderFooter`/`headerTemplate`/
 * `footerTemplate` and `marginBottom` was bumped 10mm -> 14mm to leave room
 * for the new footer. `server.js` starts an HTTP listener on import, so —
 * following the same replication convention as `server-neo-accept-language.
 * test.js` — the exact block is asserted against the real source text.
 *
 * A full behavioral drive of this block (stubbing jsreport's fetch and
 * inspecting the payload) is covered for the identical code in the dev-time
 * engine, `schema_forge/tools/app-shell/vite-plugins/report-api.js`
 * (`report-api-pdf-chrome-payload.test.js`) — the two engines are
 * hand-maintained copies by design, so this suite pins server.js to that same
 * shape rather than re-deriving a second live harness for a listener that
 * can't be instantiated without a real DB + jsreport.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SERVER_SRC = readFileSync(fileURLToPath(new URL('../server.js', import.meta.url)), 'utf8');

function extractChromeBlock(src) {
  const match = src.match(/if \(recipe === 'chrome-pdf'\) \{[\s\S]*?payload\.template\.chrome = \{[\s\S]*?\};\s*\}/);
  return match?.[0];
}

describe('server.js PDF payload — page-number footer (ETP-5013)', () => {
  it('locates the chrome-pdf payload block', () => {
    assert.ok(extractChromeBlock(SERVER_SRC), 'could not find the chrome-pdf payload block in server.js');
  });

  it('bumps marginBottom to 14mm', () => {
    const block = extractChromeBlock(SERVER_SRC);
    assert.match(block, /marginBottom: '14mm'/);
  });

  it('leaves the other Chrome margins and format untouched', () => {
    const block = extractChromeBlock(SERVER_SRC);
    assert.match(block, /format: 'A4'/);
    assert.match(block, /marginTop: '10mm'/);
    assert.match(block, /marginLeft: '10mm'/);
    assert.match(block, /marginRight: '10mm'/);
  });

  it('enables displayHeaderFooter with an empty header template', () => {
    const block = extractChromeBlock(SERVER_SRC);
    assert.match(block, /displayHeaderFooter: true/);
    assert.match(block, /headerTemplate: '<span><\/span>'/);
  });

  it('builds the footer from ui.printedOn/ui.page + a formatted date, with the live pageNumber class', () => {
    const block = extractChromeBlock(SERVER_SRC);
    assert.match(block, /footerTemplate:[\s\S]*\$\{ui\.printedOn\}/);
    assert.match(block, /footerTemplate:[\s\S]*\$\{ui\.page\}/);
    assert.match(block, /footerTemplate:[\s\S]*class="pageNumber"/);
  });

  it('never shows a page total — Classic\'s own footer only shows "Page N" (ETP-5013)', () => {
    const block = extractChromeBlock(SERVER_SRC);
    assert.doesNotMatch(block, /totalPages/);
  });

  it('formats the printed-on date as DD/MM/YYYY via Intl.DateTimeFormat en-GB', () => {
    const block = extractChromeBlock(SERVER_SRC);
    assert.match(block, /new Intl\.DateTimeFormat\('en-GB', \{ day: '2-digit', month: '2-digit', year: 'numeric' \}\)/);
  });

  it('still derives landscape from the contract/param, unchanged by this fix', () => {
    const block = extractChromeBlock(SERVER_SRC);
    assert.match(block, /landscape: contract\.orientation === 'landscape' \|\| params\.showLandscape === 'true'/);
  });

  it('only applies the chrome block for the chrome-pdf recipe, never html/xlsx/text', () => {
    // The gating `if` is part of the extracted block itself; asserting the
    // block only fires under `recipe === 'chrome-pdf'` guards against a future
    // refactor accidentally widening it to every recipe.
    assert.match(SERVER_SRC, /if \(recipe === 'chrome-pdf'\) \{[\s\S]*?payload\.template\.chrome = \{/);
  });
});
