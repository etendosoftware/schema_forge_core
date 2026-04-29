import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'RejectQuotationModal.jsx'), 'utf8');

describe('RejectQuotationModal', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function RejectQuotationModal/);
  });

  it('imports useUI from @/i18n', () => {
    assert.match(src, /from\s+['"]@\/i18n['"]/);
    assert.match(src, /useUI\(\)/);
  });

  describe('reject reasons fetch', () => {
    it('builds the selectors URL targeting C_Reject_Reason_ID', () => {
      assert.match(src, /\/quotation\/selectors\/C_Reject_Reason_ID/);
    });

    it('uses a search-typeahead input (regression: was a native select)', () => {
      assert.match(src, /<input/);
      assert.doesNotMatch(src, /<select\b/);
    });

    it('filters the loaded reasons by query (case-insensitive)', () => {
      assert.match(src, /toLowerCase/);
      assert.match(src, /filteredReasons/);
    });

    it('shows a no-results placeholder when the query has no matches', () => {
      assert.match(src, /rejectReasonNoResults/);
    });
  });

  describe('inline create flow', () => {
    it('imports CreateRejectReasonModal sub-modal', () => {
      assert.match(src, /import\s+CreateRejectReasonModal\s+from\s+['"]\.\/CreateRejectReasonModal['"]/);
    });

    it('renders a "+ Crear razón" button via the createRejectReason key', () => {
      assert.match(src, /\+\s*\{ui\(\s*['"]createRejectReason['"]\s*\)\}/);
    });

    it('renders the sub-modal via createPortal when triggered', () => {
      assert.match(src, /showCreate\s*&&\s*createPortal\(\s*<CreateRejectReasonModal/);
    });

    it('seeds the sub-modal with the typed query only when nothing is selected (regression: pre-filled the selected reason name)', () => {
      assert.match(src, /initialName=\{selected\s*\?\s*['"]{2}\s*:\s*query\}/);
      assert.doesNotMatch(src, /initialName=\{query\}/);
    });

    it('appends the created reason to the cached list and preselects it', () => {
      assert.match(src, /handleCreated/);
      assert.match(src, /handleSelect\(created\)/);
    });
  });

  describe('confirm action', () => {
    it('POSTs to the rejectQuotation action endpoint', () => {
      assert.match(
        src,
        /fetch\(\s*`\$\{entityUrl\}\/\$\{quotationId\}\/action\/rejectQuotation`/,
      );
    });

    it('sends the selected reason as { rejectReason }', () => {
      assert.match(src, /JSON\.stringify\(\s*\{\s*rejectReason:\s*selected\.id/);
    });

    it('disables the confirm button until a reason is selected', () => {
      assert.match(src, /disabled=\{loading\s*\|\|\s*!selected\}/);
    });

    it('reloads the page on success', () => {
      assert.match(src, /window\.location\.reload\(\)/);
    });
  });

  describe('i18n compliance', () => {
    it('does not hardcode English copy', () => {
      assert.doesNotMatch(src, /['"`](Reject quotation|Rejection reason|Choose a reason|Search reasons|Create reason)['"`]/);
    });

    it('renders the title via the rejectQuotationTitle key', () => {
      assert.match(src, /ui\(\s*['"]rejectQuotationTitle['"]\s*\)/);
    });

    it('renders the search placeholder via the rejectReasonSearchPlaceholder key', () => {
      assert.match(src, /ui\(\s*['"]rejectReasonSearchPlaceholder['"]\s*\)/);
    });

    it('uses the rejectQuotationError key when surfacing backend failures', () => {
      assert.match(src, /ui\(\s*['"]rejectQuotationError['"]\s*\)/);
    });
  });
});
