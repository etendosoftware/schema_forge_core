const fs = require('fs');

const path = 'tools/app-shell/src/components/contract-ui/DetailView.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('secondaryHook5')) {
  content = content.replace(
    "const secondaryHook4 = useEntity(entity, secondaryTabs[4]?.isFormTab ? null : (secondaryTabs[4]?.key ?? null), { token, apiBaseUrl });",
    "const secondaryHook4 = useEntity(entity, secondaryTabs[4]?.isFormTab ? null : (secondaryTabs[4]?.key ?? null), { token, apiBaseUrl });\n  const secondaryHook5 = useEntity(entity, secondaryTabs[5]?.isFormTab ? null : (secondaryTabs[5]?.key ?? null), { token, apiBaseUrl });"
  );
  content = content.replace(
    "const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3, secondaryHook4];",
    "const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3, secondaryHook4, secondaryHook5];"
  );
  content = content.replace(
    "// Static hooks for up to 5 secondary tabs",
    "// Static hooks for up to 6 secondary tabs"
  );
  fs.writeFileSync(path, content);
  console.log('DetailView.jsx patched');
} else {
  console.log('DetailView.jsx already patched');
}
