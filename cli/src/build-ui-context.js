export function buildUiContext(schema, rules, processes) {
  const visibleEntities = {};
  for (const entity of (schema.entities || [])) {
    const visibleFields = (entity.fields || [])
      .filter(f => f.visibility !== 'system' && f.visibility !== 'discarded')
      .map(f => ({
        name: f.name, type: f.type, required: f.required,
        editable: f.visibility === 'editable',
        readOnly: f.visibility === 'readOnly',
        label: f.label
      }));
    visibleEntities[entity.name] = {
      fields: visibleFields,
      searchableFields: (entity.fields || [])
        .filter(f => f.searchable && f.visibility !== 'system' && f.visibility !== 'discarded')
        .map(f => f.name)
    };
  }

  const actions = (processes?.processes || []).map(p => ({
    name: p.name,
    displayName: p.displayName,
    endpoint: p.trigger?.endpoint,
    method: p.trigger?.method
  }));

  return { visibleEntities, actions };
}
