const fs = require('fs');

const path = 'artifacts/contacts/generated/web/contacts/BpartnerDocTypeTable.jsx';
let content = fs.readFileSync(path, 'utf8');

const newColumns = `// @sf-generated-start columns:bpartnerDocType
const columns = [
  { key: 'organization', column: 'AD_Org_ID', type: 'string' },
  { key: 'documentcategory', column: 'Documentcategory', type: 'string' },
  { key: 'cDoctypeID', column: 'C_Doctype_ID', type: 'string' },
];
// @sf-generated-end columns:bpartnerDocType`;

content = content.replace(
  /\/\/ @sf-generated-start columns:bpartnerDocType[\s\S]*?\/\/ @sf-generated-end columns:bpartnerDocType/,
  newColumns
);

fs.writeFileSync(path, content);
console.log('BpartnerDocTypeTable.jsx patched');
