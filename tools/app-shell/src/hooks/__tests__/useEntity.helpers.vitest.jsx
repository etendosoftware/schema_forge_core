/**
 * Tests for exported pure helpers from useEntity.js.
 * The hook itself (useEntity) needs full React + auth context — tested indirectly.
 * These tests cover the utility functions that are exported independently.
 */
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { toast } from 'sonner';
import {
  pickMessage,
  pickMessageFromObject,
  extractErrorMessage,
  applyContactNameDefaults,
  parseCriteriaInto,
  normalizeDefaultValue,
  shouldSkipPayloadField,
  getReadOnly,
  getVisible,
  getUrl,
  getMethod,
  buildPatchPayload,
  handleSaveErrorResponse,
  getSaveSuccessMessage,
  buildCreatePayload,
  reportMissingRequiredFields,
  shouldRefetchAfterSave,
  showSaveSuccessToast,
  getFilteredKey,
} from '../useEntity';

describe('useEntity helpers', () => {
  describe('pickMessage', () => {
    it('returns null for falsy input', () => {
      expect(pickMessage(null)).toBeNull();
      expect(pickMessage(undefined)).toBeNull();
      expect(pickMessage('')).toBeNull();
      expect(pickMessage(0)).toBeNull();
    });

    it('returns trimmed string for string input', () => {
      expect(pickMessage('Error occurred')).toBe('Error occurred');
      expect(pickMessage('  spaced  ')).toBe('spaced');
    });

    it('returns null for whitespace-only string', () => {
      expect(pickMessage('   ')).toBeNull();
    });

    it('extracts message from array (first non-null)', () => {
      expect(pickMessage([null, '', 'Found it'])).toBe('Found it');
    });

    it('extracts message from nested arrays', () => {
      expect(pickMessage([null, ['deep message']])).toBe('deep message');
    });

    it('extracts from object via preferred keys', () => {
      expect(pickMessage({ message: 'The error' })).toBe('The error');
      expect(pickMessage({ errorMessage: 'Bad thing' })).toBe('Bad thing');
      expect(pickMessage({ text: 'Info' })).toBe('Info');
    });

    it('falls back to any string value in object', () => {
      expect(pickMessage({ customKey: 'fallback msg' })).toBe('fallback msg');
    });

    it('returns null for empty object', () => {
      expect(pickMessage({})).toBeNull();
    });
  });

  describe('pickMessageFromObject', () => {
    it('prefers message key', () => {
      expect(pickMessageFromObject({ message: 'Main', description: 'Alt' })).toBe('Main');
    });

    it('tries keys in order: message > errorMessage > text > description > title', () => {
      expect(pickMessageFromObject({ title: 'T', description: 'D' })).toBe('D');
      expect(pickMessageFromObject({ title: 'T' })).toBe('T');
    });

    it('falls back to iterating values', () => {
      expect(pickMessageFromObject({ x: null, y: 'found' })).toBe('found');
    });

    it('returns null for undefined', () => {
      expect(pickMessageFromObject(undefined)).toBeNull();
    });

    it('throws on null (typeof null === object — known JS quirk)', () => {
      // pickMessageFromObject does `if (typeof node === 'object')` which is true for null
      // Then Object.values(null) throws. pickMessage guards against this by checking !node first.
      expect(() => pickMessageFromObject(null)).toThrow();
    });
  });

  describe('extractErrorMessage', () => {
    function mockResponse(data, status = 400) {
      return {
        json: async () => data,
        status,
      };
    }

    const ui = vi.fn((key, params) => {
      if (params) {
        let text = key;
        Object.keys(params).forEach((p) => { text = text.replace(`{${p}}`, params[p]); });
        return text;
      }
      return key;
    });

    beforeEach(() => { ui.mockClear(); });

    it('extracts message from simple error object', async () => {
      const msg = await extractErrorMessage(mockResponse({ message: 'Something failed' }));
      expect(msg).toContain('Something failed');
    });

    it('extracts from nested error structures', async () => {
      const msg = await extractErrorMessage(mockResponse({
        response: { error: { message: 'Deep error' } },
      }));
      expect(msg).toBeTruthy();
    });

    it('handles response.json() failure — throws ReferenceError (known bug: translate not in scope)', async () => {
      const badRes = { json: async () => { throw new Error('parse fail'); }, status: 500 };
      await expect(extractErrorMessage(badRes)).rejects.toThrow();
    });

    it('uses ui translate function when provided', async () => {
      const msg = await extractErrorMessage(mockResponse({ message: 'err' }), ui);
      expect(msg).toBeTruthy();
    });

    // --- null value in column branch (with table-specific labels) ---
    it('detects null value in column of known table (c_bpartner.value)', async () => {
      const data = { error: { message: 'null value in column "value" of relation "c_bpartner" violates not-null constraint' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      // translate falls back to 'The field "{field}" is required.'
      expect(msg).toContain('is required');
    });

    it('detects null value in column of known table (c_bpartner.name)', async () => {
      const data = { error: { message: 'null value in column "name" of relation "c_bpartner" violates not-null' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('is required');
    });

    it('detects null value in column of unknown table', async () => {
      const data = { error: { message: 'null value in column "somefield" of relation "unknown_table"' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('is required');
    });

    it('detects null value in column with global label (ad_org_id)', async () => {
      const data = { error: { message: 'null value in column "ad_org_id" of relation "some_table"' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      // ui returns key as-is, translate falls through to fallback with field param
      expect(msg).toContain('is required');
    });

    // --- violates not-null (generic, without column name) ---
    it('detects generic not-null constraint violation', async () => {
      const data = { error: { message: 'ERROR: violates not-null constraint on some column' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      // ui mock returns key as-is, but translate() sees key === translated so uses fallback
      expect(msg).toBe('A required field is missing.');
    });

    // --- duplicate key ---
    it('detects duplicate key violation', async () => {
      const data = { error: { message: 'duplicate key value violates unique constraint "pk_something"' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      // ui mock returns key as-is, translate falls back to literal string
      expect(msg).toBe('A record with the same value already exists.');
    });

    // --- response.status -4 branch ---
    it('returns validationError when response.status is -4', async () => {
      const data = { response: { status: -4 } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      // translate returns fallback since ui(key) === key
      expect(msg).toBe('Validation error');
    });

    // --- NEO error path (data.error) ---
    it('extracts NEO top-level error message', async () => {
      const data = { error: { message: 'Record not found' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('Record not found');
    });

    // --- service error (data.response.error) ---
    it('extracts Etendo service error from response.error', async () => {
      const data = { response: { error: { message: 'Service unavailable' } } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('Service unavailable');
    });

    // --- validation error (data.response.errors) ---
    it('extracts validation error from response.errors', async () => {
      const data = { response: { errors: { message: 'Invalid field value' } } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('Invalid field value');
    });

    it('extracts validation error from response.errors array', async () => {
      const data = { response: { errors: ['Field X is invalid'] } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toBe('Field X is invalid');
    });

    // --- fallback: data.message ---
    it('uses data.message as fallback', async () => {
      const data = { message: 'Top-level fallback' };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('Top-level fallback');
    });

    // --- ultimate fallback: Error + status ---
    // translate() is defined inside the try block. When json() succeeds but no
    // message is found, the code exits the try normally and reaches line 167
    // which calls translate() — translate IS still in scope because it was defined
    // earlier in the same try block and the try completed normally (no throw).
    // But wait — re-reading the code: the `return` on line 167 is OUTSIDE the try.
    // `translate` was declared with `const` inside the try block, so it IS in scope
    // only inside that try. This means the return on line 167 hits a ReferenceError.
    // This is a known source bug — document the behavior.
    it('throws ReferenceError for fallback path (translate out of scope bug)', async () => {
      const data = { someIrrelevantKey: 42 };
      await expect(extractErrorMessage(mockResponse(data, 422), ui)).rejects.toThrow();
    });

    // --- translate without ui function ---
    it('falls back to fallback text when ui is not a function', async () => {
      const data = { error: { message: 'duplicate key value violates unique constraint' } };
      const msg = await extractErrorMessage(mockResponse(data));
      // Without ui, translate uses the fallback string
      expect(msg).toBe('A record with the same value already exists.');
    });

    // --- HTML entity decoding ---
    it('decodes HTML entities in error messages', async () => {
      const data = { error: { message: 'Field &quot;Name&quot; can&apos;t be &lt;empty&gt; &amp; null' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('Field "Name" can\'t be <empty> & null');
    });

    it('decodes &#34; and &#39; numeric entities', async () => {
      const data = { error: { message: 'Value &#34;test&#34; with &#39;quotes&#39;' } };
      const msg = await extractErrorMessage(mockResponse(data), ui);
      expect(msg).toContain('"test"');
      expect(msg).toContain("'quotes'");
    });

    // --- translate with ui function that returns key (missing translation) ---
    it('uses fallback when ui returns the key unchanged', async () => {
      const keyPassthrough = (key) => key;
      const data = { error: { message: 'duplicate key value violates unique constraint "x"' } };
      const msg = await extractErrorMessage(mockResponse(data), keyPassthrough);
      expect(msg).toBe('A record with the same value already exists.');
    });
  });

  // -------------------------------------------------------------------
  // pickMessage with deeply nested structures
  // -------------------------------------------------------------------
  describe('pickMessage — deep nesting', () => {
    it('handles array of objects', () => {
      expect(pickMessage([{ message: 'found in array obj' }])).toBe('found in array obj');
    });

    it('handles nested object in object', () => {
      expect(pickMessage({ outer: { inner: { message: 'deeply nested' } } })).toBe('deeply nested');
    });

    it('handles mixed arrays and objects', () => {
      expect(pickMessage([null, { x: [{ text: 'deep' }] }])).toBe('deep');
    });

    it('returns null for empty arrays', () => {
      expect(pickMessage([])).toBeNull();
    });

    it('returns null for array of nulls', () => {
      expect(pickMessage([null, null])).toBeNull();
    });

    it('returns null for object with all-null values', () => {
      expect(pickMessage({ a: null, b: undefined })).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // applyContactNameDefaults
  // -------------------------------------------------------------------
  describe('applyContactNameDefaults', () => {
    it('derives name from firstName + lastName', () => {
      const payload = { firstName: 'John', lastName: 'Doe' };
      applyContactNameDefaults(payload, {});
      expect(payload.name).toBe('John Doe');
    });

    it('derives name from source when payload has no firstName/lastName', () => {
      const payload = {};
      applyContactNameDefaults(payload, { firstName: 'Jane', lastName: 'Smith' });
      expect(payload.name).toBe('Jane Smith');
    });

    it('does not overwrite existing name', () => {
      const payload = { name: 'Already Set', firstName: 'John', lastName: 'Doe' };
      applyContactNameDefaults(payload, {});
      expect(payload.name).toBe('Already Set');
    });

    it('sets username to name when username is empty', () => {
      const payload = { firstName: 'John', lastName: 'Doe' };
      applyContactNameDefaults(payload, {});
      expect(payload.username).toBe('John Doe');
    });

    it('does not set username when name is empty', () => {
      const payload = {};
      applyContactNameDefaults(payload, {});
      expect(payload.username).toBeUndefined();
    });

    it('handles only firstName (no lastName)', () => {
      const payload = { firstName: 'Solo' };
      applyContactNameDefaults(payload, {});
      expect(payload.name).toBe('Solo');
    });

    it('handles only lastName (no firstName)', () => {
      const payload = { lastName: 'Only' };
      applyContactNameDefaults(payload, {});
      expect(payload.name).toBe('Only');
    });

    it('truncates name to 60 chars', () => {
      const payload = { firstName: 'A'.repeat(40), lastName: 'B'.repeat(40) };
      applyContactNameDefaults(payload, {});
      expect(payload.name.length).toBe(60);
    });
  });

  // -------------------------------------------------------------------
  // parseCriteriaInto
  // -------------------------------------------------------------------
  describe('parseCriteriaInto', () => {
    it('parses a JSON object and pushes it', () => {
      const out = [];
      parseCriteriaInto('{"fieldName":"x","operator":"equals","value":"1"}', out);
      expect(out).toHaveLength(1);
      expect(out[0].fieldName).toBe('x');
    });

    it('parses a JSON array and spreads into out', () => {
      const out = [];
      parseCriteriaInto('[{"fieldName":"a"},{"fieldName":"b"}]', out);
      expect(out).toHaveLength(2);
    });

    it('silently skips malformed JSON', () => {
      const out = [];
      parseCriteriaInto('not-json', out);
      expect(out).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // normalizeDefaultValue
  // -------------------------------------------------------------------
  describe('normalizeDefaultValue', () => {
    it('converts dd-MM-yyyy to yyyy-MM-dd', () => {
      const n = {};
      normalizeDefaultValue('25-12-2024', n, 'date');
      expect(n.date).toBe('2024-12-25');
    });

    it('strips surrounding single quotes', () => {
      const n = {};
      normalizeDefaultValue("'hello world'", n, 'val');
      expect(n.val).toBe('hello world');
    });

    it('unescapes escaped quotes inside single-quoted strings', () => {
      const n = {};
      normalizeDefaultValue("'it''s fine'", n, 'val');
      expect(n.val).toBe("it's fine");
    });

    it('converts integer to string (enum coercion)', () => {
      const n = {};
      normalizeDefaultValue(5, n, 'priority');
      expect(n.priority).toBe('5');
    });

    it('does not convert float to string', () => {
      const n = {};
      normalizeDefaultValue(5.5, n, 'amount');
      expect(n.amount).toBeUndefined();
    });

    it('does not modify a plain string', () => {
      const n = {};
      normalizeDefaultValue('hello', n, 'val');
      expect(n.val).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // shouldSkipPayloadField
  // -------------------------------------------------------------------
  describe('shouldSkipPayloadField', () => {
    const defaultRefs = {
      current: new Set(),
    };
    const userRefs = { current: new Set() };
    const reqKeys = new Set();

    it('skips id field', () => {
      expect(shouldSkipPayloadField('id', 'xxx', defaultRefs, userRefs, reqKeys, false, {})).toBe(true);
    });

    it('skips $_identifier companion fields', () => {
      expect(shouldSkipPayloadField('bp$_identifier', 'Acme', defaultRefs, userRefs, reqKeys, false, {})).toBe(true);
    });

    it('skips empty string values', () => {
      expect(shouldSkipPayloadField('name', '', defaultRefs, userRefs, reqKeys, false, {})).toBe(true);
    });

    it('skips null values', () => {
      expect(shouldSkipPayloadField('name', null, defaultRefs, userRefs, reqKeys, false, {})).toBe(true);
    });

    it('skips NEO sequence placeholders', () => {
      expect(shouldSkipPayloadField('docNo', '<10000000>', defaultRefs, userRefs, reqKeys, false, {})).toBe(true);
    });

    it('skips short numeric legacy FK IDs from backend defaults', () => {
      const bRef = { current: new Set(['language']) };
      expect(shouldSkipPayloadField('language', '181', bRef, { current: new Set() }, new Set(), false, {})).toBe(true);
    });

    it('does not skip numeric FK ID if user changed it', () => {
      const bRef = { current: new Set(['language']) };
      const uRef = { current: new Set(['language']) };
      expect(shouldSkipPayloadField('language', '181', bRef, uRef, new Set(), false, {})).toBe(false);
    });

    it('does not skip numeric FK ID if it is a required field', () => {
      const bRef = { current: new Set(['language']) };
      expect(shouldSkipPayloadField('language', '181', bRef, { current: new Set() }, new Set(['language']), false, {})).toBe(false);
    });

    it('skips contacts billing fields on create', () => {
      expect(shouldSkipPayloadField('priceList', 'someVal', defaultRefs, userRefs, reqKeys, true, {})).toBe(true);
      expect(shouldSkipPayloadField('paymentMethod', 'someVal', defaultRefs, userRefs, reqKeys, true, {})).toBe(true);
    });

    it('does not skip billing fields when not contacts create', () => {
      expect(shouldSkipPayloadField('priceList', 'someVal', defaultRefs, userRefs, reqKeys, false, {})).toBe(false);
    });

    it('skips SmartClient temporary import references', () => {
      const editing = { 'bp$_identifier': 'Acme Corp' };
      expect(shouldSkipPayloadField('bp', '100_BusinessPartner', defaultRefs, userRefs, reqKeys, false, editing)).toBe(true);
    });

    it('does not skip non-temporary FK values', () => {
      const editing = { 'bp$_identifier': 'Acme Corp' };
      expect(shouldSkipPayloadField('bp', 'valid-uuid-123', defaultRefs, userRefs, reqKeys, false, editing)).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // getReadOnly
  // -------------------------------------------------------------------
  describe('getReadOnly', () => {
    it('returns true when field.readOnly is true', () => {
      const isRO = getReadOnly({});
      expect(isRO({ readOnly: true })).toBe(true);
    });

    it('returns false when field.readOnly is false and no logic', () => {
      const isRO = getReadOnly({});
      expect(isRO({ readOnly: false })).toBe(false);
    });

    it('evaluates readOnlyLogic function', () => {
      const editing = { documentStatus: 'CO' };
      const isRO = getReadOnly(editing);
      expect(isRO({ readOnlyLogic: (row) => row.documentStatus === 'CO' })).toBe(true);
      expect(isRO({ readOnlyLogic: (row) => row.documentStatus === 'DR' })).toBe(false);
    });

    it('returns false when readOnlyLogic throws', () => {
      const isRO = getReadOnly({});
      expect(isRO({ readOnlyLogic: () => { throw new Error('boom'); } })).toBe(false);
    });

    it('returns false when readOnlyLogic is not a function', () => {
      const isRO = getReadOnly({});
      expect(isRO({ readOnlyLogic: 'not-a-function' })).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // getVisible
  // -------------------------------------------------------------------
  describe('getVisible', () => {
    it('returns true when no displayLogic', () => {
      const isVis = getVisible({});
      expect(isVis({})).toBe(true);
    });

    it('evaluates displayLogic function', () => {
      const editing = { showField: true };
      const isVis = getVisible(editing);
      expect(isVis({ displayLogic: (row) => row.showField })).toBe(true);
      expect(isVis({ displayLogic: (row) => !row.showField })).toBe(false);
    });

    it('returns true when displayLogic throws', () => {
      const isVis = getVisible({});
      expect(isVis({ displayLogic: () => { throw new Error('boom'); } })).toBe(true);
    });

    it('handles null editing', () => {
      const isVis = getVisible(null);
      expect(isVis({ displayLogic: (row) => !!row })).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // getUrl / getMethod
  // -------------------------------------------------------------------
  describe('getUrl', () => {
    it('returns POST url for new record', () => {
      expect(getUrl(true, '/api', 'order', {})).toBe('/api/order');
    });

    it('returns PATCH url for existing record', () => {
      expect(getUrl(false, '/api', 'order', { id: '123' })).toBe('/api/order/123');
    });
  });

  describe('getMethod', () => {
    it('returns POST for new', () => {
      expect(getMethod(true)).toBe('POST');
    });

    it('returns PATCH for existing', () => {
      expect(getMethod(false)).toBe('PATCH');
    });
  });

  // -------------------------------------------------------------------
  // buildPatchPayload
  // -------------------------------------------------------------------
  describe('buildPatchPayload', () => {
    it('includes only changed fields', () => {
      const editing = { id: '1', name: 'New Name', status: 'DR' };
      const selected = { id: '1', name: 'Old Name', status: 'DR' };
      const payload = buildPatchPayload(editing, selected, 'order');
      expect(payload).toEqual({ name: 'New Name' });
    });

    it('returns empty object when nothing changed', () => {
      const record = { id: '1', name: 'Same' };
      expect(buildPatchPayload(record, record, 'order')).toEqual({});
    });

    it('skips id field', () => {
      const editing = { id: '2', name: 'X' };
      const selected = { id: '1', name: 'X' };
      const payload = buildPatchPayload(editing, selected, 'order');
      expect(payload.id).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // handleSaveErrorResponse
  // -------------------------------------------------------------------
  describe('handleSaveErrorResponse', () => {
    it('parses MISSING_REQUIRED_FIELDS and sets field errors', async () => {
      const res = {
        clone: () => ({
          json: async () => ({
            error: {
              code: 'MISSING_REQUIRED_FIELDS',
              fields: ['name', 'bp'],
            },
          }),
        }),
        json: async () => ({ error: { message: 'Required fields missing' } }),
        status: 400,
      };
      const uiFn = (key) => key;
      const setFieldErrors = vi.fn();
      const setSaveError = vi.fn();
      await handleSaveErrorResponse(res, uiFn, setFieldErrors, setSaveError);
      expect(setFieldErrors).toHaveBeenCalledWith({
        name: 'fieldRequired',
        bp: 'fieldRequired',
      });
      expect(setSaveError).toHaveBeenCalledWith('requiredFieldsMissing');
    });

    it('falls back to extractErrorMessage for other error shapes', async () => {
      const res = {
        clone: () => ({
          json: async () => ({ error: { message: 'Generic error' } }),
        }),
        json: async () => ({ error: { message: 'Generic error' } }),
        status: 500,
      };
      const uiFn = (key) => key;
      const setFieldErrors = vi.fn();
      const setSaveError = vi.fn();
      await handleSaveErrorResponse(res, uiFn, setFieldErrors, setSaveError);
      expect(setFieldErrors).not.toHaveBeenCalled();
      expect(setSaveError).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // getSaveSuccessMessage
  // -------------------------------------------------------------------
  describe('getSaveSuccessMessage', () => {
    it('returns recordCreated for new', () => {
      expect(getSaveSuccessMessage(true, (k) => k)).toBe('recordCreated');
    });

    it('returns recordSaved for existing', () => {
      expect(getSaveSuccessMessage(false, (k) => k)).toBe('recordSaved');
    });
  });

  // -------------------------------------------------------------------
  // buildCreatePayload
  // -------------------------------------------------------------------
  describe('buildCreatePayload', () => {
    it('builds payload skipping internal fields', () => {
      const editing = { id: '1', name: 'Test', bp$_identifier: 'Acme', status: 'DR' };
      const payload = {};
      buildCreatePayload(editing, { current: new Set() }, { current: new Set() }, new Set(), false, payload);
      expect(payload.name).toBe('Test');
      expect(payload.status).toBe('DR');
      expect(payload.id).toBeUndefined();
      expect(payload['bp$_identifier']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // reportMissingRequiredFields
  // -------------------------------------------------------------------
  describe('reportMissingRequiredFields', () => {
    it('sets field errors, save error, and calls setIsSaving(false)', () => {
      const uiFn = (key) => key;
      const setFieldErrors = vi.fn();
      const setSaveError = vi.fn();
      const setIsSaving = vi.fn();
      const result = reportMissingRequiredFields(['name', 'bp'], uiFn, setFieldErrors, setSaveError, setIsSaving);
      expect(result).toBeNull();
      expect(setFieldErrors).toHaveBeenCalledWith({ name: 'fieldRequired', bp: 'fieldRequired' });
      expect(setSaveError).toHaveBeenCalledWith('requiredFieldsMissing');
      expect(setIsSaving).toHaveBeenCalledWith(false);
    });
  });

  // -------------------------------------------------------------------
  // shouldRefetchAfterSave
  // -------------------------------------------------------------------
  describe('shouldRefetchAfterSave', () => {
    it('returns true when saved has id and refetchAfterSave is true', () => {
      expect(shouldRefetchAfterSave({ id: '1' }, true)).toBe(true);
    });

    it('returns false when refetchAfterSave is false', () => {
      expect(shouldRefetchAfterSave({ id: '1' }, false)).toBe(false);
    });

    it('returns falsy when saved has no id', () => {
      expect(shouldRefetchAfterSave({}, true)).toBeFalsy();
      expect(shouldRefetchAfterSave(null, true)).toBeFalsy();
    });
  });

  // -------------------------------------------------------------------
  // showSaveSuccessToast
  // -------------------------------------------------------------------
  describe('showSaveSuccessToast', () => {
    it('shows toast when not silent', () => {
      showSaveSuccessToast(false, true, (k) => k);
      expect(toast.success).toHaveBeenCalledWith('recordCreated');
    });

    it('does not show toast when silent', () => {
      toast.success.mockClear();
      showSaveSuccessToast(true, true, (k) => k);
      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
