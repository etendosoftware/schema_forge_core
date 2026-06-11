import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'documentEmailSend.js'), 'utf8');

test('documentEmailSend exports preview cache and contract send helpers', () => {
  assert.match(src, /export function buildPreviewFileName/);
  assert.match(src, /export async function cacheDocumentPreviewFile/);
  assert.match(src, /export async function sendDocumentEmail/);
});

test('documentEmailSend sanitizes preview file names before preview-file upload', () => {
  assert.match(src, /function sanitizeFileNamePart/);
  assert.match(src, /function isSafeFileNameChar/);
  assert.match(src, /function trimDashes/);
  assert.match(src, /fileName: buildPreviewFileName\(specName, documentNo, documentId\)/);
});
