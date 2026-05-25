import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { buildHeaders, detectBaseUrl } from '@/auth/api.js';

/**
 * Per-user, per-window named filter presets backed by
 * AD_Preference (ETGO_WindowFilters).
 *
 * Server endpoints (NeoServlet):
 *   GET    /sws/neo/filters/{window}
 *   PUT    /sws/neo/filters/{window}/{preset}
 *   DELETE /sws/neo/filters/{window}/{preset}
 *
 * A preset payload is an opaque JSON object; this hook does not interpret it.
 * Callers decide what to put in (e.g., { columnFilters, advancedFilter }).
 */
export function useWindowFilterPresets(windowName) {
  const { token } = useAuth();
  const [presets, setPresets] = useState({});
  const [loading, setLoading] = useState(false);

  const baseUrl = useCallback(
    () => `${detectBaseUrl()}/sws/neo/filters/${encodeURIComponent(windowName || '')}`,
    [windowName],
  );

  const refresh = useCallback(() => {
    if (!windowName || !token) return;
    setLoading(true);
    fetch(baseUrl(), { headers: buildHeaders(token), credentials: 'include' })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        setPresets(data && typeof data === 'object' ? data : {});
      })
      .catch(() => setPresets({}))
      .finally(() => setLoading(false));
  }, [windowName, token, baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const savePreset = useCallback(
    async (presetName, payload) => {
      if (!windowName || !token || !presetName) return;
      const url = `${baseUrl()}/${encodeURIComponent(presetName)}`;
      await fetch(url, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify(payload ?? {}),
        credentials: 'include',
      });
      setPresets((prev) => ({ ...prev, [presetName]: payload ?? {} }));
    },
    [windowName, token, baseUrl],
  );

  const deletePreset = useCallback(
    async (presetName) => {
      if (!windowName || !token || !presetName) return;
      const url = `${baseUrl()}/${encodeURIComponent(presetName)}`;
      await fetch(url, {
        method: 'DELETE',
        headers: buildHeaders(token),
        credentials: 'include',
      });
      setPresets((prev) => {
        const next = { ...prev };
        delete next[presetName];
        return next;
      });
    },
    [windowName, token, baseUrl],
  );

  return { presets, loading, refresh, savePreset, deletePreset };
}

export default useWindowFilterPresets;
