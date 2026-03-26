const fs = require('fs');

const path = 'artifacts/contacts/generated/web/contacts/BusinessPartnerPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// The required order:
// CUSTOMER
// VENDOR/CREDITOR
// EMPLOYEE
// BANK ACCOUNT (omitted for now since not created)
// DOCUMENT TYPE
// LOCATION/ADDRESS (detailEntity)
// CONTACT
// BASIC DISCOUNT

const newSecondaryTabs = `const secondaryTabs = [
  { key: 'customer', label: 'CUSTOMER', isFormTab: true, Form: CustomerForm },
  { key: 'vendor', label: 'VENDOR/CREDITOR', isFormTab: true, Form: VendorForm },
  { key: 'employee', label: 'EMPLOYEE', isFormTab: true, Form: EmployeeForm },
  { key: 'bpartnerDocType', label: 'DOCUMENT TYPE', isFormTab: false, Table: BpartnerDocTypeTable, Form: BpartnerDocTypeForm },
  { key: 'user', label: 'CONTACT', isFormTab: false, Table: UserTable, Form: UserForm },
  { key: 'bpartnerDiscount', label: 'BASIC DISCOUNT', isFormTab: false, Table: BpartnerDiscountTable, Form: BpartnerDiscountForm },
];`;

content = content.replace(
  /const secondaryTabs = \[[\s\S]*?\];/,
  newSecondaryTabs
);

content = content.replace(
  'detailLabel="Location"',
  'detailLabel="LOCATION/ADDRESS"\n        detailTabIndex={4}'
);

fs.writeFileSync(path, content);
console.log('BusinessPartnerPage.jsx tabs reordered');
