/**
 * Creates a mock fetch function that intercepts API calls and simulates
 * CRUD operations against an in-memory data store.
 *
 * @param {Record<string, Array<Record<string, unknown>>>} mockData - Entity data keyed by entity name
 * @param {string} basePath - API base path to intercept (e.g. '/etendo_sf/api')
 * @returns {function} A fetch-like async function
 */
export function createMockFetch(mockData, basePath) {
  // Deep clone to avoid mutation across calls
  const store = JSON.parse(JSON.stringify(mockData));

  return async function mockFetch(url, options = {}) {
    // Only intercept URLs starting with basePath
    if (!url.startsWith(basePath)) {
      return undefined;
    }

    const method = (options.method || 'GET').toUpperCase();
    const path = url.slice(basePath.length);
    const segments = path.split('/').filter(Boolean);

    // POST /process/{name}
    if (method === 'POST' && segments[0] === 'process') {
      const processName = segments[1];
      let body;
      try {
        body = JSON.parse(options.body);
      } catch {
        return makeResponse(400, { error: 'Invalid request body' });
      }
      // Search all entities in the store to find the record by id
      for (const collection of Object.values(store)) {
        const record = collection.find(r => r.id === body.id);
        if (record) {
          record.docStatus = processName === 'voidOrder' ? 'VO' : 'CO';
          break;
        }
      }
      return makeResponse(200, { status: 'success', message: `${processName} executed` });
    }

    const entity = segments[0];

    if (method === 'GET') {
      // GET /{entity}
      if (segments.length === 1) {
        const data = store[entity];
        if (!data) return makeResponse(404, { error: 'Entity not found' });
        return makeResponse(200, data);
      }

      // GET /{entity}/{id}
      if (segments.length === 2) {
        const id = segments[1];
        const data = store[entity];
        if (!data) return makeResponse(404, { error: 'Entity not found' });
        const record = data.find(r => r.id === id);
        if (!record) return makeResponse(404, { error: 'Record not found' });
        return makeResponse(200, record);
      }

      // GET /{entity}/{id}/{child}
      if (segments.length === 3) {
        const parentId = segments[1];
        const childEntity = segments[2];
        const childData = store[childEntity];
        if (!childData) return makeResponse(404, { error: 'Child entity not found' });
        const parentKey = `${entity}Id`;
        const filtered = childData.filter(r => r[parentKey] === parentId);
        return makeResponse(200, filtered);
      }
    }

    if (method === 'POST' && segments.length === 1) {
      let body;
      try {
        body = JSON.parse(options.body);
      } catch {
        return makeResponse(400, { error: 'Invalid request body' });
      }
      const newRecord = { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...body };
      if (!store[entity]) store[entity] = [];
      store[entity].push(newRecord);
      return makeResponse(201, newRecord);
    }

    if (method === 'PUT' && segments.length === 2) {
      const id = segments[1];
      const data = store[entity];
      if (!data) return makeResponse(404, { error: 'Entity not found' });
      const index = data.findIndex(r => r.id === id);
      if (index === -1) return makeResponse(404, { error: 'Record not found' });
      let body;
      try {
        body = JSON.parse(options.body);
      } catch {
        return makeResponse(400, { error: 'Invalid request body' });
      }
      data[index] = { ...data[index], ...body };
      return makeResponse(200, data[index]);
    }

    return makeResponse(404, { error: 'Not found' });
  };
}

function makeResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}
