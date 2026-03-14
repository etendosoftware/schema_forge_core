import { useState, useEffect, useCallback } from 'react';

function buildHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function useEntity(entity, childEntity, { token, apiBaseUrl }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = buildHeaders(token);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`${apiBaseUrl}/${entity}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => { const rows = data?.response?.data ?? (Array.isArray(data) ? data : []); setItems(rows); setLoading(false); })
      .catch(() => { setItems([]); setLoading(false); });
  }, [apiBaseUrl, entity, token]);

  useEffect(() => { refresh(); }, [refresh]);

  const fetchChildren = useCallback((parentId) => {
    if (!childEntity || !parentId) { setChildren([]); return; }
    // NEO Headless uses ?parentId= to filter child entity records
    fetch(`${apiBaseUrl}/${childEntity}?parentId=${parentId}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => {
        const rows = data?.response?.data ?? (Array.isArray(data) ? data : []);
        setChildren(rows);
      })
      .catch(() => setChildren([]));
  }, [apiBaseUrl, childEntity, token]);

  const fetchById = useCallback((id) => {
    if (!id) return;
    setLoading(true);
    fetch(`${apiBaseUrl}/${entity}/${id}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => {
        const row = data?.response?.data?.[0] ?? data;
        setSelected(row);
        setEditing({ ...row });
        fetchChildren(row?.id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiBaseUrl, entity, token, fetchChildren]);

  const handleSelect = useCallback((row) => {
    setSelected(row);
    setEditing(row ? { ...row } : null);
    fetchChildren(row?.id);
  }, [fetchChildren]);

  const handleNew = useCallback(async () => {
    setSelected(null);
    setEditing({}); // Start with empty so UI is responsive
    try {
      const res = await fetch(`${apiBaseUrl}/${entity}/defaults`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.defaults) {
          setEditing(prev => ({ ...prev, ...data.defaults }));
        }
      }
    } catch {
      // Defaults are best-effort; proceed with empty form if endpoint fails
    }
  }, [apiBaseUrl, entity, token]);

  const handleChange = useCallback((field, value) => {
    setEditing(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    const isNew = !editing.id;
    const url = isNew ? `${apiBaseUrl}/${entity}` : `${apiBaseUrl}/${entity}/${editing.id}`;
    // Use PATCH for existing records (partial update), POST for new
    const method = isNew ? 'POST' : 'PATCH';
    // For PATCH, only send changed fields
    let payload;
    if (!isNew && selected) {
      const changes = {};
      for (const [key, value] of Object.entries(editing)) {
        if (key === 'id') continue;
        if (value !== selected[key]) changes[key] = value;
      }
      payload = changes;
    } else {
      payload = editing;
    }
    // NEO Headless expects flat field values — NeoServlet handles wrapping for JsonDataService
    const body = JSON.stringify(payload);
    try {
      const res = await fetch(url, { method, headers, body });
      if (res.ok) {
        const data = await res.json();
        const saved = data?.response?.data?.[0] ?? data;
        setSelected(saved);
        setEditing({ ...saved });
        refresh();
      }
    } catch { /* caller handles */ }
  }, [editing, selected, apiBaseUrl, entity, token, refresh]);

  const handleDelete = useCallback(async () => {
    if (!selected?.id) return;
    try {
      await fetch(`${apiBaseUrl}/${entity}/${selected.id}`, { method: 'DELETE', headers });
      setSelected(null);
      setEditing(null);
      setChildren([]);
      refresh();
    } catch { /* caller handles */ }
  }, [selected, apiBaseUrl, entity, token, refresh]);

  const handleAddChild = useCallback((childData) => {
    const newChild = { id: `new-${Date.now()}`, ...childData };
    setChildren(prev => [...prev, newChild]);
  }, []);

  const handleUpdateChild = useCallback((childId, field, value) => {
    setChildren(prev => prev.map(c =>
      String(c.id) === String(childId) ? { ...c, [field]: value } : c
    ));
  }, []);

  const handleDeleteChild = useCallback((childId) => {
    setChildren(prev => prev.filter(c => String(c.id) !== String(childId)));
  }, []);

  const handleProcess = useCallback(async (processName) => {
    if (!selected?.id) return;
    await fetch(`${apiBaseUrl}/process/${processName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: selected.id }),
    });
    refresh();
  }, [selected, apiBaseUrl, token, refresh]);

  return {
    items, selected, editing, children, loading,
    handleSelect, handleNew, handleChange, handleSave, handleDelete, handleProcess,
    handleAddChild, handleUpdateChild, handleDeleteChild,
    refresh, fetchById,
  };
}
