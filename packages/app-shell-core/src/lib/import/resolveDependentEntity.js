/**
 * Normalize a text string for comparison (trim, lowercase, remove diacritics / accents).
 */
export function normalizeText(str) {
  if (str == null) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Deterministically derive an uppercase alphanumeric code/slug from a human-readable name.
 */
export function deriveCodeFromName(name) {
  const normalized = normalizeText(name);
  if (!normalized) return '';
  return normalized
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

/**
 * Registry of active in-flight or completed entity resolutions per run,
 * preventing duplicate creations during concurrent import row processing.
 */
const resolutionCaches = new Map();

export function getResolutionCache(cacheKey = 'default') {
  if (!resolutionCaches.has(cacheKey)) {
    resolutionCaches.set(cacheKey, new Map());
  }
  return resolutionCaches.get(cacheKey);
}

export function clearResolutionCache(cacheKey) {
  if (cacheKey) {
    resolutionCaches.delete(cacheKey);
  } else {
    resolutionCaches.clear();
  }
}

/**
 * Resolve or prepare auto-creation for a dependent entity (e.g. ProductCategory, Brand, TaxCategory).
 *
 * Matching semantics:
 * 1. If `code` is provided, attempt exact searchKey match.
 * 2. If no code match or no code provided, attempt normalized name match against `name` or `searchKey`.
 * 3. If multiple normalized name matches exist, fail with ambiguity.
 * 4. If no match exists and `allowCreate` is true, return creation payload or create via `createFn`.
 *
 * @param {Object} params
 * @param {string} [params.code] - Explicit code/searchKey
 * @param {string} [params.name] - Human-readable name
 * @param {string} [params.fallbackValue] - Fallback value if code/name are absent
 * @param {Array<Object>} params.existingRecords - Pre-fetched or known existing records [{ id, searchKey, name, ... }]
 * @param {boolean} [params.allowCreate=true] - Whether to allow auto-creation
 * @param {Function} [params.createFn] - Optional async function to create record immediately: async ({ searchKey, name }) => ({ id, searchKey, name })
 * @param {Map} [params.cache] - In-run resolution cache
 * @param {Function} [params.translate] - Translator function for localized errors
 * @returns {Promise<{ status: 'resolved' | 'created' | 'pending-create' | 'unresolved' | 'error' | 'empty', id?: string, searchKey?: string, name?: string, error?: Error, createBody?: Object }>}
 */
export async function resolveOrAutoCreateDependentEntity({
  code,
  name,
  fallbackValue,
  existingRecords = [],
  allowCreate = true,
  createFn,
  cache,
  translate,
}) {
  const rawCode = (code != null ? String(code).trim() : '') || '';
  const rawName = (name != null ? String(name).trim() : '') || '';
  const rawFallback = (fallbackValue != null ? String(fallbackValue).trim() : '') || '';

  // Determine effective search target
  const effectiveCode = rawCode;
  const effectiveName = rawName || (!rawCode ? rawFallback : '');

  // If no input at all, return empty resolution (blank/omitted)
  if (!effectiveCode && !effectiveName) {
    return { status: 'empty' };
  }

  // Deduplication key for per-run cache
  const cacheKey = `${effectiveCode}:::${effectiveName}`;
  if (cache && cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const resolutionPromise = (async () => {
    // 1. Exact match on searchKey / code
    if (effectiveCode) {
      const codeMatch = existingRecords.find(
        (r) => String(r.searchKey ?? r.value ?? r.code ?? '').trim() === effectiveCode,
      );
      if (codeMatch) {
        return {
          status: 'resolved',
          id: codeMatch.id,
          searchKey: codeMatch.searchKey ?? codeMatch.value ?? effectiveCode,
          name: codeMatch.name ?? effectiveName,
        };
      }
    }

    // 2. Normalized match on name
    if (effectiveName) {
      const normalizedInput = normalizeText(effectiveName);
      const nameMatches = existingRecords.filter(
        (r) => normalizeText(r.name) === normalizedInput,
      );

      if (nameMatches.length === 1) {
        const match = nameMatches[0];
        return {
          status: 'resolved',
          id: match.id,
          searchKey: match.searchKey ?? match.value,
          name: match.name ?? effectiveName,
        };
      }

      if (nameMatches.length > 1) {
        const errorMsg = typeof translate === 'function'
          ? translate('importErrorDependentAmbiguous', { value: effectiveName })
          : `Multiple records match "${effectiveName}". Please specify an exact code.`;
        const err = new Error(errorMsg);
        err.code = 'AMBIGUOUS';
        return { status: 'error', error: err };
      }
    }

    // 3. No match found -> Auto-create if permitted
    if (!allowCreate) {
      const errorMsg = typeof translate === 'function'
        ? translate('importErrorDependentUnresolved', { value: effectiveCode || effectiveName })
        : `Record "${effectiveCode || effectiveName}" could not be resolved.`;
      const err = new Error(errorMsg);
      err.code = 'NOT_FOUND';
      return { status: 'unresolved', error: err };
    }

    const searchKeyToCreate = effectiveCode || deriveCodeFromName(effectiveName);
    const nameToCreate = effectiveName || effectiveCode;

    if (!searchKeyToCreate) {
      const errorMsg = typeof translate === 'function'
        ? translate('importErrorDependentInvalidName', { value: effectiveName })
        : `Cannot generate a valid identifier from "${effectiveName}".`;
      const err = new Error(errorMsg);
      err.code = 'INVALID_IDENTIFIER';
      return { status: 'error', error: err };
    }

    // Check if derived searchKey conflicts with another existing record with a different name
    const keyConflict = existingRecords.find(
      (r) => String(r.searchKey ?? r.value ?? '').trim().toUpperCase() === searchKeyToCreate.toUpperCase(),
    );
    if (keyConflict && normalizeText(keyConflict.name) !== normalizeText(nameToCreate)) {
      const errorMsg = typeof translate === 'function'
        ? translate('importErrorDependentKeyConflict', { key: searchKeyToCreate, existing: keyConflict.name })
        : `Derived code "${searchKeyToCreate}" conflicts with existing record "${keyConflict.name}".`;
      const err = new Error(errorMsg);
      err.code = 'KEY_CONFLICT';
      return { status: 'error', error: err };
    }

    if (typeof createFn === 'function') {
      const created = await createFn({ searchKey: searchKeyToCreate, name: nameToCreate });
      return {
        status: 'created',
        id: created.id,
        searchKey: created.searchKey ?? searchKeyToCreate,
        name: created.name ?? nameToCreate,
      };
    }

    return {
      status: 'pending-create',
      searchKey: searchKeyToCreate,
      name: nameToCreate,
      createBody: {
        searchKey: searchKeyToCreate,
        name: nameToCreate,
      },
    };
  })();

  if (cache) {
    cache.set(cacheKey, resolutionPromise);
  }

  return resolutionPromise;
}
