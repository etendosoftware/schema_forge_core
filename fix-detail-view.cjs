const fs = require('fs');

const path = 'tools/app-shell/src/components/contract-ui/DetailView.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('addingSecondaryLine')) {
  // Add state for addingSecondaryLine map
  content = content.replace(
    "const [addingLine, setAddingLine] = useState(false);",
    "const [addingLine, setAddingLine] = useState(false);\n  const [addingSecondaryLine, setAddingSecondaryLine] = useState({});"
  );

  // Update secondary tabs rendering
  const oldTableRender = `<st.Table
                          data={secondaryHooks[stIdx]?.children ?? []}
                          entity={st.key}
                          onRowClick={st.Form ? (row) => setSelectedSecondaryLine({ ...row, _tabKey: st.key }) : undefined}
                          selectedRowId={selectedSecondaryLine?._tabKey === st.key ? selectedSecondaryLine?.id : undefined}
                        />`;

  const newTableRender = `<st.Table
                          data={secondaryHooks[stIdx]?.children ?? []}
                          entity={st.key}
                          onRowClick={st.Form ? (row) => setSelectedSecondaryLine({ ...row, _tabKey: st.key }) : undefined}
                          selectedRowId={selectedSecondaryLine?._tabKey === st.key ? selectedSecondaryLine?.id : undefined}
                          addRow={st.addLineFields ? {
                            active: addingSecondaryLine[st.key] || false,
                            fields: st.addLineFields.entry ?? [],
                            onAdd: (lineData) => {
                              const entryKeys = new Set((st.addLineFields.entry ?? []).map(f => f.key));
                              const filtered = {};
                              for (const [k, v] of Object.entries(lineData)) {
                                if (entryKeys.has(k)) filtered[k] = v;
                              }
                              secondaryHooks[stIdx]?.handleAddChild?.(filtered);
                            },
                            onCancel: () => setAddingSecondaryLine(prev => ({ ...prev, [st.key]: false })),
                            catalogs,
                            onFieldChange: handleLineFieldChange, // Using the same callout handler for simplicity
                          } : undefined}
                        />
                        {st.Form && st.addLineFields && (
                          <button
                            onClick={() => setAddingSecondaryLine(prev => ({ ...prev, [st.key]: !prev[st.key] }))}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3 font-medium"
                          >
                            + Add {st.label}
                          </button>
                        )}`;

  content = content.replace(oldTableRender, newTableRender);
  
  fs.writeFileSync(path, content);
  console.log('DetailView.jsx patched to support adding records in secondary tabs');
} else {
  console.log('DetailView.jsx already patched');
}
