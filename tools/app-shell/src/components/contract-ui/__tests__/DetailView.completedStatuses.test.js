import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'DetailView.jsx'), 'utf8');

/**
 * Regression guard for the framework feature introduced in ETP-3873:
 * `draftMode.completedStatuses` lets a window declare an explicit list of
 * documentStatus values that should hide Save/Confirm. Without this branch,
 * `processed === 'Y'` alone triggers the lock — which broke sales-quotation
 * during Under Evaluation (UE), where Etendo flips processed to Y but the
 * pair must remain visible until the user confirms or rejects.
 */
describe('DetailView — draftMode.completedStatuses (ETP-3873 regression)', () => {
  it('reads draftMode.completedStatuses as an array branch', () => {
    assert.match(src, /Array\.isArray\(\s*draftMode\.completedStatuses\s*\)/);
  });

  it('matches against the live documentStatus when the array is declared', () => {
    assert.match(
      src,
      /draftMode\.completedStatuses\.includes\(\s*_headerData\?\.documentStatus\s*\)/,
    );
  });

  it('keeps the legacy fallback (processed===Y or status===CO) when the array is absent', () => {
    assert.match(src, /isProcessed\s*\|\|\s*_headerData\?\.documentStatus\s*===\s*['"]CO['"]/);
  });

  it('only triggers the lock when draftMode is enabled', () => {
    assert.match(src, /draftMode\?\.enabled\s*&&/);
  });

  it('feeds the result to the Save-button gate', () => {
    assert.match(
      src,
      /!hideSaveStatuses\.includes\(\s*_headerData\?\.documentStatus\s*\)\s*&&\s*!isDraftModeCompleted/,
    );
  });
});
