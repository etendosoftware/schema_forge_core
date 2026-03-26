const fs = require('fs');

const path = 'artifacts/contacts/generated/web/contacts/BpartnerDocTypeForm.jsx';
let content = fs.readFileSync(path, 'utf8');

const newFields = `// @sf-generated-start fields:bpartnerDocType
const fields = [
  { key: 'organization', column: 'AD_Org_ID', type: 'selector', required: true, section: 'principal', inputMode: 'selector' },
  // @sf-custom-slot callout:BusinessPartnerDocTypeValidation
  { key: 'documentcategory', column: 'Documentcategory', type: 'text', required: true, section: 'principal' },
  // @sf-custom-slot callout:BusinessPartnerDocTypeValidation
  { key: 'issotrx', column: 'Issotrx', type: 'checkbox', required: true, section: 'principal' },
  { key: 'cDoctypeID', column: 'C_Doctype_ID', type: 'selector', required: true, section: 'principal', reference: 'DocType', inputMode: 'selector' },
  { key: 'active', column: 'Isactive', type: 'checkbox', required: true, section: 'principal' },
];
// @sf-generated-end fields:bpartnerDocType`;

content = content.replace(
  /\/\/ @sf-generated-start fields:bpartnerDocType[\s\S]*?\/\/ @sf-generated-end fields:bpartnerDocType/,
  newFields
);

fs.writeFileSync(path, content);
console.log('BpartnerDocTypeForm.jsx patched');
