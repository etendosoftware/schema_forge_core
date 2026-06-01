import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

/**
 * Unit tests for the helper functions extracted (and exported) from useEntity.js.
 * These are pure functions, so they are imported and exercised directly
 * (no mirror / re-implementation).
 *
 * useEntity.js is a Vite/React module: it uses `@/` path aliases and pulls in
 * `.jsx` transitive dependencies (AuthContext, i18n). Plain `node --test` knows
 * neither the alias nor how to parse JSX, so before importing the module we
 * install two synchronous module customization hooks:
 *   - resolve: rewrites `@/foo` → <app-shell>/src/foo (dir specifiers → /index.js)
 *   - load:    transpiles `.jsx` source to plain JS via esbuild on the fly
 * This lets the test import the REAL exported helpers without modifying source.
 */
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Monorepo root (schema_forge/) — workspace packages live under it, e.g.
// tools/app-shell/src and packages/app-shell-core/src.
const REPO_ROOT_URL = pathToFileURL(resolve(SRC_DIR, '..', '..', '..') + '/').href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      let target = resolve(SRC_DIR, specifier.slice(2));
      if (!extname(target) && existsSync(`${target}/index.js`)) {
        target = `${target}/index.js`;
      }
      return nextResolve(pathToFileURL(target).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    // Transpile workspace JSX, and any workspace JS that uses Vite-only
    // constructs (import.meta.env). node_modules are left to the default loader.
    const isWorkspace = url.startsWith(REPO_ROOT_URL) && !url.includes('/node_modules/');
    if (url.endsWith('.jsx') || (isWorkspace && url.endsWith('.js'))) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      const { code } = transformSync(source, {
        loader: url.endsWith('.jsx') ? 'jsx' : 'js',
        format: 'esm',
        sourcefile: url,
        // Vite-only construct: replace `import.meta.env` with an empty object
        // so import-time reads (e.g. VITE_API_BASE) resolve to undefined, not throw.
        define: {
          'import.meta.env': '{}',
          // import.meta.glob (Vite) inlines matched modules; route it to a
          // global no-op stub (define values must be identifiers/literals).
          'import.meta.glob': '__viteGlobStub__',
        },
      });
      return { format: 'module', shortCircuit: true, source: code };
    }
    return nextLoad(url, context);
  },
});

// Vite's import.meta.glob is rewritten to this global no-op (returns {}).
globalThis.__viteGlobStub__ = () => ({});

// Minimal browser-global stubs: transitive deps (auth/api.js) read
// window.location at import time. The helpers under test never use these.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { pathname: '/', origin: 'http://localhost', href: 'http://localhost/' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = globalThis.window.localStorage;
}
if (typeof globalThis.document === 'undefined') {
  const noopEl = {
    setAttribute: () => {},
    appendChild: () => {},
    insertBefore: () => {},
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  };
  globalThis.document = {
    documentElement: { lang: 'en', style: {} },
    head: noopEl,
    body: noopEl,
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({ ...noopEl }),
    createTextNode: () => ({}),
    getElementsByTagName: () => [noopEl],
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

const {
  pickMessage,
  pickMessageObjectCase,
  setNameContactCase,
  criteriaCase,
  normalizeKey,
  saveContinueClauses,
} = await import('../useEntity.js');

describe('pickMessage', () => {
  it('returns the trimmed string for a string input', () => {
    assert.equal(pickMessage('  hello  '), 'hello');
  });

  it('returns null for a whitespace-only string', () => {
    assert.equal(pickMessage('   '), null);
  });

  it('returns null for null', () => {
    assert.equal(pickMessage(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(pickMessage(undefined), null);
  });

  it('returns null for 0 (falsy)', () => {
    assert.equal(pickMessage(0), null);
  });

  it('returns null for empty string', () => {
    assert.equal(pickMessage(''), null);
  });

  it('returns the first non-empty message in a nested array', () => {
    assert.equal(pickMessage(['', '  ', 'first', 'second']), 'first');
  });

  it('returns null for an array of empty values', () => {
    assert.equal(pickMessage(['', '   ', null]), null);
  });

  it('honors preferredKeys priority (message wins over other keys)', () => {
    assert.equal(
      pickMessage({ description: 'desc', message: 'msg', title: 'ttl' }),
      'msg'
    );
  });

  it('falls through to Object.values for objects with only non-preferred keys', () => {
    assert.equal(pickMessage({ foo: 'bar' }), 'bar');
  });

  it('returns null for a fully empty object', () => {
    assert.equal(pickMessage({}), null);
  });

  it('recurses into nested objects and arrays', () => {
    assert.equal(
      pickMessage({ wrapper: { items: ['', { message: 'deep' }] } }),
      'deep'
    );
  });
});

describe('pickMessageObjectCase', () => {
  it('returns null for a string (non-object)', () => {
    assert.equal(pickMessageObjectCase('hello'), null);
  });

  it('returns null for a number (non-object)', () => {
    assert.equal(pickMessageObjectCase(42), null);
  });

  it('honors preferredKeys order', () => {
    assert.equal(
      pickMessageObjectCase({ text: 'text-val', errorMessage: 'err', message: 'm' }),
      'm'
    );
  });

  it('uses errorMessage when message is absent', () => {
    assert.equal(
      pickMessageObjectCase({ text: 'text-val', errorMessage: 'err' }),
      'err'
    );
  });

  it('falls back to arbitrary values when no preferred key matches', () => {
    assert.equal(pickMessageObjectCase({ random: 'value' }), 'value');
  });

  it('returns null for an empty object', () => {
    assert.equal(pickMessageObjectCase({}), null);
  });
});

describe('setNameContactCase', () => {
  it('derives name from payload firstName/lastName', () => {
    const payload = { firstName: 'John', lastName: 'Doe' };
    setNameContactCase(payload, {});
    assert.equal(payload.name, 'John Doe');
  });

  it('falls back to source firstName/lastName when payload lacks them', () => {
    const payload = {};
    setNameContactCase(payload, { firstName: 'Jane', lastName: 'Roe' });
    assert.equal(payload.name, 'Jane Roe');
  });

  it('prefers payload names over source names', () => {
    const payload = { firstName: 'Pay' };
    setNameContactCase(payload, { firstName: 'Src', lastName: 'Last' });
    assert.equal(payload.name, 'Pay Last');
  });

  it('does NOT overwrite an existing name', () => {
    const payload = { name: 'Existing', firstName: 'John', lastName: 'Doe' };
    setNameContactCase(payload, {});
    assert.equal(payload.name, 'Existing');
  });

  it('sets username from name', () => {
    const payload = { firstName: 'John', lastName: 'Doe' };
    setNameContactCase(payload, {});
    assert.equal(payload.username, 'John Doe');
  });

  it('does not set username when name is absent', () => {
    const payload = {};
    setNameContactCase(payload, {});
    assert.equal(payload.name, undefined);
    assert.equal(payload.username, undefined);
  });

  it('does not overwrite an existing username', () => {
    const payload = { name: 'Some Name', username: 'keepme' };
    setNameContactCase(payload, {});
    assert.equal(payload.username, 'keepme');
  });

  it('slices a long derived name to 60 chars (name and username)', () => {
    const longFirst = 'a'.repeat(40);
    const longLast = 'b'.repeat(40);
    const payload = { firstName: longFirst, lastName: longLast };
    setNameContactCase(payload, {});
    // "aaa... aaa bbb...": joined with a space then sliced to 60
    const expected = `${longFirst} ${longLast}`.slice(0, 60);
    assert.equal(payload.name, expected);
    assert.equal(payload.name.length, 60);
    assert.equal(payload.username, expected.slice(0, 60));
    assert.equal(payload.username.length, 60);
  });
});

describe('criteriaCase', () => {
  it('spreads a valid JSON array into out', () => {
    const out = [];
    criteriaCase('[1, 2, 3]', out);
    assert.deepEqual(out, [1, 2, 3]);
  });

  it('pushes a valid JSON object as a single element', () => {
    const out = [];
    criteriaCase('{"a": 1}', out);
    assert.deepEqual(out, [{ a: 1 }]);
  });

  it('leaves out unchanged for malformed JSON (no throw)', () => {
    const out = [];
    assert.doesNotThrow(() => criteriaCase('{not valid', out));
    assert.deepEqual(out, []);
  });

  it('appends to a pre-populated out array', () => {
    const out = ['existing'];
    criteriaCase('["a", "b"]', out);
    assert.deepEqual(out, ['existing', 'a', 'b']);
  });
});

describe('normalizeKey', () => {
  it('converts dd-mm-yyyy to yyyy-mm-dd', () => {
    const normalized = {};
    normalizeKey('25-12-2024', normalized, 'orderDate');
    assert.equal(normalized.orderDate, '2024-12-25');
  });

  it('unquotes a quoted string and unescapes doubled single-quotes', () => {
    const normalized = {};
    normalizeKey("'O''Brien'", normalized, 'name');
    assert.equal(normalized.name, "O'Brien");
  });

  it('converts an integer to a String', () => {
    const normalized = {};
    normalizeKey(7, normalized, 'lineNo');
    assert.equal(normalized.lineNo, '7');
  });

  it('leaves a non-matching string untouched (key not added)', () => {
    const normalized = {};
    normalizeKey('plain text', normalized, 'note');
    assert.equal('note' in normalized, false);
  });

  it('leaves a float untouched (key not added)', () => {
    const normalized = {};
    normalizeKey(3.14, normalized, 'amount');
    assert.equal('amount' in normalized, false);
  });

  it('leaves a boolean untouched (key not added)', () => {
    const normalized = {};
    normalizeKey(true, normalized, 'active');
    assert.equal('active' in normalized, false);
  });
});

describe('saveContinueClauses', () => {
  const emptyRef = () => ({ current: new Set() });
  const refWith = (...keys) => ({ current: new Set(keys) });

  it('returns true for the id key', () => {
    assert.equal(
      saveContinueClauses('id', 'abc', emptyRef(), emptyRef(), new Set(), false, {}),
      true
    );
  });

  it('returns true for an $_identifier companion key', () => {
    assert.equal(
      saveContinueClauses('product$_identifier', 'Some Product', emptyRef(), emptyRef(), new Set(), false, {}),
      true
    );
  });

  it('returns true for a locale-suffixed legacy key pattern (name_US)', () => {
    // /^[a-zA-Z]+_[A-Z]{2,4}$/ matches keys like name_US, description_EN.
    assert.equal(
      saveContinueClauses('name_US', 'Acme', emptyRef(), emptyRef(), new Set(), false, {}),
      true
    );
  });

  it('returns true for an empty string value', () => {
    assert.equal(
      saveContinueClauses('description', '', emptyRef(), emptyRef(), new Set(), false, {}),
      true
    );
  });

  it('returns true for a null value', () => {
    assert.equal(
      saveContinueClauses('description', null, emptyRef(), emptyRef(), new Set(), false, {}),
      true
    );
  });

  it('returns true for a NEO sequence placeholder', () => {
    assert.equal(
      saveContinueClauses('documentNo', '<10000>', emptyRef(), emptyRef(), new Set(), false, {}),
      true
    );
  });

  it('returns true for a short numeric default that is not user-changed and not required', () => {
    assert.equal(
      saveContinueClauses(
        'businessPartner',
        '12345',
        refWith('businessPartner'),
        emptyRef(),
        new Set(),
        false,
        {}
      ),
      true
    );
  });

  it('returns true for a contacts billing field during business partner create', () => {
    assert.equal(
      saveContinueClauses('priceList', 'SomeList', emptyRef(), emptyRef(), new Set(), true, {}),
      true
    );
  });

  it('returns true for a SmartClient temp import ref when companion identifier exists', () => {
    assert.equal(
      saveContinueClauses(
        'businessPartner',
        '100_BusinessPartner',
        emptyRef(),
        emptyRef(),
        new Set(),
        false,
        { 'businessPartner$_identifier': 'Acme' }
      ),
      true
    );
  });

  it('returns false for a normal user value', () => {
    assert.equal(
      saveContinueClauses('description', 'Hello world', emptyRef(), emptyRef(), new Set(), false, {}),
      false
    );
  });

  it('returns false for a required short-numeric field even if from defaults', () => {
    assert.equal(
      saveContinueClauses(
        'businessPartner',
        '12345',
        refWith('businessPartner'),
        emptyRef(),
        new Set(['businessPartner']),
        false,
        {}
      ),
      false
    );
  });

  it('returns false for a short numeric the user changed', () => {
    assert.equal(
      saveContinueClauses(
        'businessPartner',
        '12345',
        refWith('businessPartner'),
        refWith('businessPartner'),
        new Set(),
        false,
        {}
      ),
      false
    );
  });
});
