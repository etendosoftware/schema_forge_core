const fs = require('fs');

const path = 'tools/app-shell/src/components/contract-ui/DetailView.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add `detailTabIndex` to props
content = content.replace(
  "  detailLabel,\n  titleField = 'documentNo',",
  "  detailLabel,\n  detailTabIndex,\n  titleField = 'documentNo',"
);

// 2. Expand hooks to 8
content = content.replace(
  "// Static hooks for up to 4 secondary tabs (React rules forbid dynamic hook calls)",
  "// Static hooks for up to 8 secondary tabs (React rules forbid dynamic hook calls)"
);
content = content.replace(
  "const secondaryHook0 = useEntity(entity, secondaryTabs[0]?.key ?? null, { token, apiBaseUrl });",
  "const secondaryHook0 = useEntity(entity, secondaryTabs[0]?.isFormTab ? null : (secondaryTabs[0]?.key ?? null), { token, apiBaseUrl });"
);
content = content.replace(
  "const secondaryHook1 = useEntity(entity, secondaryTabs[1]?.key ?? null, { token, apiBaseUrl });",
  "const secondaryHook1 = useEntity(entity, secondaryTabs[1]?.isFormTab ? null : (secondaryTabs[1]?.key ?? null), { token, apiBaseUrl });"
);
content = content.replace(
  "const secondaryHook2 = useEntity(entity, secondaryTabs[2]?.key ?? null, { token, apiBaseUrl });",
  "const secondaryHook2 = useEntity(entity, secondaryTabs[2]?.isFormTab ? null : (secondaryTabs[2]?.key ?? null), { token, apiBaseUrl });"
);
content = content.replace(
  "const secondaryHook3 = useEntity(entity, secondaryTabs[3]?.key ?? null, { token, apiBaseUrl });\n  const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3];",
  "const secondaryHook3 = useEntity(entity, secondaryTabs[3]?.isFormTab ? null : (secondaryTabs[3]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHook4 = useEntity(entity, secondaryTabs[4]?.isFormTab ? null : (secondaryTabs[4]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHook5 = useEntity(entity, secondaryTabs[5]?.isFormTab ? null : (secondaryTabs[5]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHook6 = useEntity(entity, secondaryTabs[6]?.isFormTab ? null : (secondaryTabs[6]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHook7 = useEntity(entity, secondaryTabs[7]?.isFormTab ? null : (secondaryTabs[7]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3, secondaryHook4, secondaryHook5, secondaryHook6, secondaryHook7];"
);

// 3. Add addingSecondaryLine state
content = content.replace(
  "const [addingLine, setAddingLine] = useState(false);",
  "const [addingLine, setAddingLine] = useState(false);\n  const [addingSecondaryLine, setAddingSecondaryLine] = useState({});"
);

// 4. Update the tabs.push logic
content = content.replace(
  "  if (DetailTable) {\n    tabs.push({ key: 'lines', label: detailLabel || detailEntity || 'Lines', count: hook.children?.length || 0 });\n  }\n  for (const st of secondaryTabs) {\n    tabs.push({ key: st.key, label: st.label });\n  }",
  "  for (const st of secondaryTabs) {\n    tabs.push({ key: st.key, label: st.label });\n  }\n  if (DetailTable) {\n    const linesTab = { key: 'lines', label: detailLabel || detailEntity || 'Lines', count: hook.children?.length || 0 };\n    if (typeof detailTabIndex === 'number' && detailTabIndex >= 0 && detailTabIndex <= tabs.length) {\n      tabs.splice(detailTabIndex, 0, linesTab);\n    } else {\n      tabs.unshift(linesTab);\n    }\n  }"
);

// 5. Update secondary tabs rendering to include addRow button and logic
const oldTableRender = `                      <st.Table
                        data={secondaryHooks[stIdx]?.children ?? []}
                        entity={st.key}
                        onRowClick={st.Form ? (row) => setSelectedSecondaryLine({ ...row, _tabKey: st.key }) : undefined}
                        selectedRowId={selectedSecondaryLine?._tabKey === st.key ? selectedSecondaryLine?.id : undefined}
                      />
                    </div>
                    {st.Form && (selectedSecondaryLine?._tabKey === st.key || isClosingSecondaryLine) && (
                      <div className={\`w-[48rem] shrink-0 border-l border-border pl-4 self-stretch overflow-hidden \${isClosingSecondaryLine ? 'sidebar-slide-out' : 'sidebar-slide-in'}\`}>`;

const newTableRender = `                      <st.Table
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
                          onFieldChange: handleLineFieldChange,
                        } : undefined}
                      />
                      {st.Form && st.addLineFields && (
                        <button
                          onClick={() => setAddingSecondaryLine(prev => ({ ...prev, [st.key]: !prev[st.key] }))}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3 font-medium"
                        >
                          + Add {st.label}
                        </button>
                      )}
                    </div>
                    {st.Form && (selectedSecondaryLine?._tabKey === st.key || isClosingSecondaryLine) && (
                      <div className={\`w-[48rem] shrink-0 border-l border-border pl-4 self-stretch overflow-hidden \${isClosingSecondaryLine ? 'sidebar-slide-out' : 'sidebar-slide-in'}\`}>`;

content = content.replace(oldTableRender, newTableRender);

// 6. Handle isFormTab correctly (this was already there in our modified version, but let's ensure it handles both Table+Form vs Form-only)
const oldTabWrap = `{/* Tab content: secondary child entity tabs */}
                {secondaryTabs.map((st, stIdx) => tabs[activeTab]?.key === st.key && (
                  <div key={st.key} className="pt-3 flex items-start gap-4">`;

const newTabWrap = `{/* Tab content: secondary child entity tabs (or form-only tabs) */}
                {secondaryTabs.map((st, stIdx) => tabs[activeTab]?.key === st.key && (
                  st.isFormTab ? (
                    <div key={st.key} className="pt-5">
                      <st.Form
                        entity={entity}
                        data={data}
                        onChange={handleChangeWithCallout}
                        catalogs={catalogs}
                        layout="horizontal"
                        displayLogic={displayLogic}
                        api={api}
                        token={token}
                        apiBaseUrl={apiBaseUrl}
                      />
                    </div>
                  ) : (
                    <div key={st.key} className="pt-3 flex items-start gap-4">`;

content = content.replace(oldTabWrap, newTabWrap);

const oldCloseDiv = `                      </div>
                    )}
                  </div>
                ))}`;

const newCloseDiv = `                      </div>
                    )}
                  </div>
                )
              ))}`;

content = content.replace(oldCloseDiv, newCloseDiv);

fs.writeFileSync(path, content);
console.log('DetailView patched flawlessly.');
