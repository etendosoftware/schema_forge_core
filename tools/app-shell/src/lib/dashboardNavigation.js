export function resolveDashboardNavigation(navigation) {
  if (!navigation || typeof navigation !== 'object') return null;

  const windowName = String(navigation.window ?? '').trim();
  if (!windowName) return null;

  if (navigation.type === 'record') {
    const recordId = String(navigation.recordId ?? '').trim();
    return recordId ? `/${windowName}/${recordId}` : `/${windowName}`;
  }

  const params = new URLSearchParams();

  if (navigation.filter) {
    params.set('filter', String(navigation.filter));
  }

  const rawParams = navigation.params;
  if (rawParams && typeof rawParams === 'object') {
    for (const [key, value] of Object.entries(rawParams)) {
      if (value == null || value === '') continue;
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `/${windowName}?${query}` : `/${windowName}`;
}

export function createDashboardNavigation({ type = 'list', window, recordId, filter, params } = {}) {
  const navigation = { type, window };
  if (recordId) navigation.recordId = recordId;
  if (filter) navigation.filter = filter;
  if (params && Object.keys(params).length > 0) navigation.params = params;
  return navigation;
}
