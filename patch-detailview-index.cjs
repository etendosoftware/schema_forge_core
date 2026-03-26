const fs = require('fs');

const path = 'tools/app-shell/src/components/contract-ui/DetailView.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('detailTabIndex')) {
  content = content.replace(
    "  detailLabel,\n  titleField = 'documentNo',",
    "  detailLabel,\n  detailTabIndex,\n  titleField = 'documentNo',"
  );

  content = content.replace(
    "  const tabs = [];\n  if (DetailTable) {\n    tabs.push({ key: 'lines', label: detailLabel || detailEntity || 'Lines', count: hook.children?.length || 0 });\n  }\n  for (const st of secondaryTabs) {\n    tabs.push({ key: st.key, label: st.label });\n  }",
    "  const tabs = [];\n  for (const st of secondaryTabs) {\n    tabs.push({ key: st.key, label: st.label });\n  }\n  if (DetailTable) {\n    const linesTab = { key: 'lines', label: detailLabel || detailEntity || 'Lines', count: hook.children?.length || 0 };\n    if (typeof detailTabIndex === 'number' && detailTabIndex >= 0 && detailTabIndex <= tabs.length) {\n      tabs.splice(detailTabIndex, 0, linesTab);\n    } else {\n      tabs.unshift(linesTab);\n    }\n  }"
  );

  // Allow up to 8 secondary tabs just in case
  content = content.replace(
    "  const secondaryHook5 = useEntity(entity, secondaryTabs[5]?.isFormTab ? null : (secondaryTabs[5]?.key ?? null), { token, apiBaseUrl });",
    "  const secondaryHook5 = useEntity(entity, secondaryTabs[5]?.isFormTab ? null : (secondaryTabs[5]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHook6 = useEntity(entity, secondaryTabs[6]?.isFormTab ? null : (secondaryTabs[6]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHook7 = useEntity(entity, secondaryTabs[7]?.isFormTab ? null : (secondaryTabs[7]?.key ?? null), { token, apiBaseUrl });"
  );

  content = content.replace(
    "  const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3, secondaryHook4, secondaryHook5];",
    "  const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3, secondaryHook4, secondaryHook5, secondaryHook6, secondaryHook7];"
  );
  
  content = content.replace(
    "// Static hooks for up to 6 secondary tabs",
    "// Static hooks for up to 8 secondary tabs"
  );

  fs.writeFileSync(path, content);
  console.log('DetailView.jsx patched for detailTabIndex');
} else {
  console.log('DetailView.jsx already patched');
}
