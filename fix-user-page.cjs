const fs = require('fs');

const path = 'artifacts/contacts/generated/web/contacts/BusinessPartnerPage.jsx';
let content = fs.readFileSync(path, 'utf8');

// Ensure UserForm is imported
if (!content.includes("import UserForm")) {
  content = content.replace(
    "import UserTable from './UserTable';",
    "import UserTable from './UserTable';\nimport UserForm from './UserForm';"
  );
}

// Update the secondaryTabs definition to include Form: UserForm
content = content.replace(
  "{ key: 'user', label: 'Contact', isFormTab: false, Table: UserTable },",
  "{ key: 'user', label: 'Contact', isFormTab: false, Table: UserTable, Form: UserForm },"
);

fs.writeFileSync(path, content);
console.log('BusinessPartnerPage.jsx updated to include UserForm');
