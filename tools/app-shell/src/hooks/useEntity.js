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
      .then(res => res.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiBaseUrl, entity, token]);

  useEffect(() => { refresh(); }, [refresh]);

  const fetchChildren = useCallback((parentId) => {
    if (!childEntity || !parentId) { setChildren([]); return; }
    fetch(`${apiBaseUrl}/${entity}/${parentId}/${childEntity}`, { headers })
      .then(res => res.json())
      .then(setChildren)
      .catch(() => setChildren([]));
  }, [apiBaseUrl, entity, childEntity, token]);

  const handleSelect = useCallback((row) => {
    setSelected(row);
    setEditing({ ...row });
    fetchChildren(row?.id);
  }, [fetchChildren]);

  const handleNew = useCallback(() => {
    setSelected(null);
    setEditing({});
  }, []);

  const handleChange = useCallback((field, value) => {
    setEditing(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    const isNew = !editing.id;
    const url = isNew ? `${apiBaseUrl}/${entity}` : `${apiBaseUrl}/${entity}/${editing.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(editing) });
      if (res.ok) {
        const saved = await res.json();
        setSelected(saved);
        setEditing({ ...saved });
        refresh();
      }
    } catch { /* caller handles */ }
  }, [editing, apiBaseUrl, entity, token, refresh]);

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
    refresh,
  };
}
