import { createContext, useCallback, useContext, useMemo, useState } from "react";

const InspectorContext = createContext(null);

export function InspectorProvider({ children }) {
  const [editMode, setEditMode] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaRaw, setSchemaRaw] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [windowSlug, setWindowSlug] = useState(null);

  const loadSchema = useCallback(async (slug) => {
    setWindowSlug(slug);
    const [curatedRes, rawRes] = await Promise.all([
      fetch(`/api/schema/${slug}`),
      fetch(`/api/schema-raw/${slug}`),
    ]);
    if (!curatedRes.ok) throw new Error(`Failed to load schema: ${curatedRes.status}`);
    if (!rawRes.ok) throw new Error(`Failed to load raw schema: ${rawRes.status}`);
    const curated = await curatedRes.json();
    const raw = await rawRes.json();
    setSchema(curated);
    setSchemaRaw(raw);
    setDirty(false);
    setSelectedField(null);
    setSelectedEntity(null);
  }, []);

  const updateField = useCallback((entityName, fieldName, updates) => {
    setSchema((prev) => {
      const next = structuredClone(prev);
      const entity = next.entities.find((e) => e.name === entityName);
      if (!entity) return prev;
      const field = entity.fields.find((f) => f.name === fieldName);
      if (!field) return prev;
      Object.assign(field, updates);
      return next;
    });
    setDirty(true);
  }, []);

  const removeField = useCallback((entityName, fieldName) => {
    setSchema((prev) => {
      const next = structuredClone(prev);
      const entity = next.entities.find((e) => e.name === entityName);
      if (!entity) return prev;
      entity.fields = entity.fields.filter((f) => f.name !== fieldName);
      return next;
    });
    setDirty(true);
  }, []);

  const addField = useCallback((entityName, field) => {
    setSchema((prev) => {
      const next = structuredClone(prev);
      const entity = next.entities.find((e) => e.name === entityName);
      if (!entity) return prev;
      entity.fields.push(field);
      return next;
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!windowSlug || !schema) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schema/${windowSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [windowSlug, schema]);

  const selectField = useCallback((entityName, fieldName) => {
    setSelectedEntity(entityName);
    setSelectedField(fieldName);
  }, []);

  const value = useMemo(
    () => ({
      editMode,
      setEditMode,
      schema,
      schemaRaw,
      dirty,
      saving,
      selectedField,
      selectedEntity,
      windowSlug,
      loadSchema,
      updateField,
      removeField,
      addField,
      save,
      selectField,
    }),
    [
      editMode,
      schema,
      schemaRaw,
      dirty,
      saving,
      selectedField,
      selectedEntity,
      windowSlug,
      loadSchema,
      updateField,
      removeField,
      addField,
      save,
      selectField,
    ],
  );

  return (
    <InspectorContext.Provider value={value}>
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx) {
    throw new Error("useInspector must be used within an InspectorProvider");
  }
  return ctx;
}
