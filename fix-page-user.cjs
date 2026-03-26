const fs = require('fs');

const path = 'artifacts/contacts/generated/web/contacts/BusinessPartnerPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Define userAddLineFields
const userAddLineFields = `const userAddLineFields = {
  entry: [
    { key: 'firstName', column: 'Firstname', type: 'text', required: true },
    { key: 'lastName', column: 'Lastname', type: 'text', required: true },
    { key: 'email', column: 'Email', type: 'text', required: false },
    { key: 'phone', column: 'Phone', type: 'text', required: false },
  ],
  derived: []
};

const secondaryTabs = [`;

content = content.replace('const secondaryTabs = [', userAddLineFields);

// Assign addLineFields to user tab
content = content.replace(
  "{ key: 'user', label: 'Contact', isFormTab: false, Table: UserTable, Form: UserForm },",
  "{ key: 'user', label: 'Contact', isFormTab: false, Table: UserTable, Form: UserForm, addLineFields: userAddLineFields },"
);

fs.writeFileSync(path, content);
console.log('BusinessPartnerPage.jsx updated to support adding User records');
