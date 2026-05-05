import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'PartnerAddressPicker.jsx'), 'utf8');

describe('PartnerAddressPicker', () => {
  it('exports a named PartnerAddressPicker function', () => {
    assert.match(src, /export function PartnerAddressPicker/);
  });

  it('accepts field, value, displayValue, onChange, formData, resolvedLabel props', () => {
    assert.match(src, /field/);
    assert.match(src, /value/);
    assert.match(src, /displayValue/);
    assert.match(src, /onChange/);
    assert.match(src, /formData/);
    assert.match(src, /resolvedLabel/);
  });

  it('accepts selectorUrl, selectorContext, token, apiBaseUrl props', () => {
    assert.match(src, /selectorUrl/);
    assert.match(src, /selectorContext/);
    assert.match(src, /token/);
    assert.match(src, /apiBaseUrl/);
  });

  it('composes CreatableSearchSelect for the selector UI', () => {
    assert.match(src, /CreatableSearchSelect/);
    assert.match(src, /from '\.\/CreatableSearchSelect\.jsx'/);
  });

  it('opens LocationEditorModal for inline address creation', () => {
    assert.match(src, /LocationEditorModal/);
    assert.match(src, /from '.*LocationEditorModal\.jsx'/);
  });

  it('derives contactsApiBase by replacing the last path segment with /contacts', () => {
    assert.match(src, /contactsApiBase/);
    assert.match(src, /apiBaseUrl\.replace/);
    assert.match(src, /\/contacts/);
  });

  it('masks value and displayValue when no parent (business partner) is selected', () => {
    assert.match(src, /parentValue \? value : ''/);
    assert.match(src, /parentValue \? displayValue : undefined/);
  });

  it('passes createLabel using the addAddress i18n key', () => {
    assert.match(src, /ui\('addAddress'\)/);
    assert.match(src, /createLabel/);
  });

  it('only enables onCreateRequest when contactsApiBase and parentValue are both present', () => {
    assert.match(src, /contactsApiBase && parentValue \? handleCreateRequest : undefined/);
  });

  it('opens LocationEditorModal when handleCreateRequest is triggered', () => {
    assert.match(src, /handleCreateRequest/);
    assert.match(src, /setModalOpen\(true\)/);
    assert.match(src, /onCreatedRef\.current = onCreated/);
  });

  it('passes the new id and name to the onCreated callback after a successful save', () => {
    assert.match(src, /handleSaved/);
    assert.match(src, /onCreatedRef\.current\(newId, newName\)/);
  });

  it('closes the modal and clears the onCreated ref on handleClose', () => {
    assert.match(src, /handleClose/);
    assert.match(src, /setModalOpen\(false\)/);
    assert.match(src, /onCreatedRef\.current = null/);
  });

  it('passes bpId (parent value) to LocationEditorModal', () => {
    assert.match(src, /bpId=\{parentValue\}/);
  });

  it('passes apiBase derived from apiBaseUrl to LocationEditorModal', () => {
    assert.match(src, /apiBase=\{contactsApiBase\}/);
  });

  it('uses useCallback for stable handler references', () => {
    assert.match(src, /useCallback/);
  });

  it('uses useUI for i18n strings', () => {
    assert.match(src, /useUI/);
  });
});
