import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'SendToEvaluationModal.jsx'), 'utf8');

describe('SendToEvaluationModal', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function SendToEvaluationModal/);
  });

  it('accepts quotationId, data, token, apiBaseUrl, onClose props', () => {
    assert.match(src, /quotationId.*token.*apiBaseUrl.*onClose/s);
  });

  it('POSTs to DocAction endpoint on confirm', () => {
    assert.match(src, /action\/DocAction/);
    assert.match(src, /method.*POST/s);
  });

  it('calls window.location.reload after successful confirm', () => {
    assert.match(src, /window\.location\.reload/);
  });

  it('calls onClose after successful confirm', () => {
    assert.match(src, /onClose\(\)/);
  });

  it('renders sqSendToEvalTitle i18n key', () => {
    assert.match(src, /sqSendToEvalTitle/);
  });

  it('renders sqSendToEvalDesc i18n key', () => {
    assert.match(src, /sqSendToEvalDesc/);
  });

  it('renders sqSendToEvalConfirm i18n key on confirm button', () => {
    assert.match(src, /sqSendToEvalConfirm/);
  });

  it('fetches fresh record and line count on mount', () => {
    assert.match(src, /quotationLine\?parentId/);
    assert.match(src, /useEffect/);
  });

  it('shows loading spinner while processing', () => {
    assert.match(src, /soProcessing/);
    assert.match(src, /loading/);
  });

  it('displays error message on failure', () => {
    assert.match(src, /setError/);
    assert.match(src, /soErrorOccurred/);
  });

  it('has cancel button that calls onClose', () => {
    assert.match(src, /ui\('cancel'\)/);
  });
});
