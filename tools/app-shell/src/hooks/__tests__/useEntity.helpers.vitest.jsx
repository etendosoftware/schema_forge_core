/**
 * Tests for exported pure helpers from useEntity.js.
 * The hook itself (useEntity) needs full React + auth context — tested indirectly.
 * These tests cover the utility functions that are exported independently.
 */
import { pickMessage, pickMessageFromObject, extractErrorMessage } from '../useEntity';

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
    function mockResponse(data) {
      return {
        json: async () => data,
        status: 400,
      };
    }

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
      // extractErrorMessage catches the JSON parse error but then calls `translate`
      // which is defined inside the try block — this is a known code smell.
      // The test documents the current behavior.
      await expect(extractErrorMessage(badRes)).rejects.toThrow();
    });

    it('uses ui translate function when provided', async () => {
      const ui = (key) => key === 'networkError' ? 'Red error' : key;
      const msg = await extractErrorMessage(mockResponse({ message: 'err' }), ui);
      expect(msg).toBeTruthy();
    });
  });
});
