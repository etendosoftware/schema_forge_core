import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OCR_DOC_TYPES,
  matchOcrDocType,
  getOcrDocType,
} from '../../components/copilot/ocr/ocrDocTypes.js';

describe('ocrDocTypes registry', () => {
  it('exposes at least one document type', () => {
    assert.ok(OCR_DOC_TYPES.length >= 1);
  });

  it('every entry declares the required fields', () => {
    for (const entry of OCR_DOC_TYPES) {
      assert.ok(entry.id, 'id missing');
      assert.ok(entry.routePrefix?.startsWith('/'), 'routePrefix must be absolute');
      assert.ok(entry.toolName, 'toolName missing');
      assert.ok(entry.eventName, 'eventName missing');
      assert.ok(entry.question, 'question missing');
    }
  });

  it('event names share the OCR prefill prefix', () => {
    for (const entry of OCR_DOC_TYPES) {
      assert.match(entry.eventName, /^copilot:ocr-prefill:/);
    }
  });
});

describe('matchOcrDocType', () => {
  it('returns null for a missing pathname', () => {
    assert.equal(matchOcrDocType(null), null);
    assert.equal(matchOcrDocType(''), null);
  });

  it('matches when pathname starts with the route prefix', () => {
    const result = matchOcrDocType('/purchase-invoice/new');
    assert.equal(result?.id, 'purchase-invoice');
  });

  it('returns null when pathname does not match', () => {
    assert.equal(matchOcrDocType('/sales-order/123'), null);
  });
});

describe('getOcrDocType', () => {
  it('looks up by id', () => {
    assert.equal(getOcrDocType('purchase-invoice')?.id, 'purchase-invoice');
  });

  it('returns null for unknown id', () => {
    assert.equal(getOcrDocType('does-not-exist'), null);
  });

  it('returns null for empty input', () => {
    assert.equal(getOcrDocType(''), null);
    assert.equal(getOcrDocType(null), null);
  });
});
