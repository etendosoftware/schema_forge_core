import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'QuotationStatusBadge.jsx'), 'utf8');

describe('QuotationStatusBadge', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function QuotationStatusBadge/);
  });

  it('imports useUI from @/i18n', () => {
    assert.match(src, /from\s+['"]@\/i18n['"]/);
    assert.match(src, /useUI/);
  });

  it('returns null when documentStatus is missing', () => {
    assert.match(src, /data\?\.documentStatus/);
    assert.match(src, /return null/);
  });

  describe('STATUS_CONFIG entries', () => {
    const expectedKeys = {
      DR:      'statusDraft',
      UE:      'statusUnderEvaluation',
      CO:      'statusComplete',
      CA:      'statusOrderCreated',
      ETGO_CI: 'statusInvoiceCreated',
      CL:      'statusClosed',
      VO:      'statusVoid',
    };

    for (const [code, key] of Object.entries(expectedKeys)) {
      it(`maps ${code} to i18n key '${key}'`, () => {
        const re = new RegExp(`${code}\\s*:\\s*\\{[^}]*key:\\s*['"]${key}['"]`);
        assert.match(src, re);
      });
    }

    it('has CA recoloured with the success/emerald palette', () => {
      assert.match(src, /CA:\s*\{[^}]*dot:\s*'#10B981'/);
      assert.match(src, /CA:\s*\{[^}]*bg:\s*'#ECFDF5'/);
    });

    it('has ETGO_CI styled with the success/emerald palette', () => {
      assert.match(src, /ETGO_CI:\s*\{[^}]*dot:\s*'#10B981'/);
      assert.match(src, /ETGO_CI:\s*\{[^}]*bg:\s*'#ECFDF5'/);
    });
  });

  describe('i18n compliance', () => {
    it('does not contain a literal label property anywhere (no hardcoded strings)', () => {
      assert.doesNotMatch(src, /\blabel\s*:\s*['"]/);
    });

    it('does not hardcode the English status strings', () => {
      assert.doesNotMatch(src, /['"`](Draft|Under Evaluation|Confirmed|Converted|Closed - Invoice Created|Closed - Invoiced|Voided)['"`]/);
    });

    it('renders the label through ui(cfg.key)', () => {
      assert.match(src, /\{ui\(cfg\.key\)\}/);
    });
  });
});
