import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'useOcrFlow.jsx'), 'utf8');

describe('useOcrFlow generic orchestration', () => {
  it('looks up the buildBatch descriptor by docType id', () => {
    assert.match(src, /DESCRIPTORS\[docType\.id\]/);
  });

  it('does not call findBp directly anymore', () => {
    assert.doesNotMatch(src, /findBp\(/);
  });

  it('passes docType headerFields and lineColumns to the generic review modals', () => {
    assert.match(src, /fields=\{docType\.headerFields\}/);
    assert.match(src, /columns=\{docType\.lineColumns\}/);
  });
});
