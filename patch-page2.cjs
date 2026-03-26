const fs = require('fs');

const path = 'artifacts/contacts/generated/web/contacts/BusinessPartnerPage.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import BpartnerDocTypeTable')) {
  content = content.replace(
    "import VendorForm from './VendorForm';",
    "import VendorForm from './VendorForm';\nimport BpartnerDocTypeTable from './BpartnerDocTypeTable';\nimport BpartnerDocTypeForm from './BpartnerDocTypeForm';"
  );
}

if (!content.includes("{ key: 'bpartnerDocType', label: 'Document Type'")) {
  content = content.replace(
    "{ key: 'bpartnerDiscount', label: 'Basic Discount', isFormTab: false, Table: BpartnerDiscountTable, Form: BpartnerDiscountForm },",
    "{ key: 'bpartnerDiscount', label: 'Basic Discount', isFormTab: false, Table: BpartnerDiscountTable, Form: BpartnerDiscountForm },\n  { key: 'bpartnerDocType', label: 'Document Type', isFormTab: false, Table: BpartnerDocTypeTable, Form: BpartnerDocTypeForm },"
  );
}

fs.writeFileSync(path, content);
console.log('BusinessPartnerPage.jsx patched');
