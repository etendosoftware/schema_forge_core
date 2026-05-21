// JB-06 — Verify the localized titles (en_US/es_ES) of the three finance
// reports affected by the naming fix. These titles drive both the report
// catalog (ReportViewerPage cards) and the report header.
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const artifactsDir = resolve(__dirname, '../../artifacts');

function loadReportContract(name) {
  const path = resolve(artifactsDir, name, 'report-contract.json');
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const EXPECTED_TITLES = {
  'balance-sheet': {
    en_US: 'Balance Sheet',
    es_ES: 'Balance de Situación',
  },
  'report-journal-entries': {
    en_US: 'Journal Entries',
    es_ES: 'Diario de Asientos',
  },
  'report-trial-balance': {
    en_US: 'Trial Balance',
    es_ES: 'Balance de Sumas y Saldos',
  },
};

describe('JB-06 — Spanish naming of accounting reports', () => {
  for (const [reportName, expected] of Object.entries(EXPECTED_TITLES)) {
    describe(`report-contract.json — ${reportName}`, () => {
      const contract = loadReportContract(reportName);

      it('has a title object with both locales', () => {
        assert.ok(contract.title, 'title block must exist');
        assert.equal(typeof contract.title.en_US, 'string', 'title.en_US must be a string');
        assert.equal(typeof contract.title.es_ES, 'string', 'title.es_ES must be a string');
      });

      it(`uses the expected en_US title "${expected.en_US}"`, () => {
        assert.equal(contract.title.en_US, expected.en_US);
      });

      it(`uses the expected es_ES title "${expected.es_ES}"`, () => {
        assert.equal(contract.title.es_ES, expected.es_ES);
      });

      it('does not use the legacy es_ES label', () => {
        // Regression guards — these are the labels that JB-06 replaced.
        const legacy = {
          'balance-sheet': 'Balance General',
          'report-journal-entries': 'Asientos Contables',
          'report-trial-balance': 'Balance de Comprobación',
        };
        assert.notEqual(contract.title.es_ES, legacy[reportName]);
      });
    });
  }
});

describe('JB-06 — legacy locale key (balanceSheet in es_ES.json)', () => {
  const localePath = resolve(
    __dirname,
    '../../tools/app-shell/src/locales/es_ES.json',
  );
  const locale = JSON.parse(readFileSync(localePath, 'utf-8'));

  it('genericLabels.balanceSheet uses the new Spanish name', () => {
    assert.equal(locale.genericLabels?.balanceSheet, 'Balance de Situación');
  });

  it('genericLabels.balanceSheet is not the legacy "Balance General"', () => {
    assert.notEqual(locale.genericLabels?.balanceSheet, 'Balance General');
  });
});
