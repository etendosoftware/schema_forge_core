const fs = require('fs');

const path = 'tools/app-shell/src/components/contract-ui/EntityForm.jsx';
let content = fs.readFileSync(path, 'utf8');

// In React EntityForm, the data object from useEntity hook is populated with the original DB column names, not the camelCase keys!
// Wait, no. The fields have key="active" but column="IsActive". The API from NEO Headless returns JSON using the apiKey/name from the spec!
// Let's check how NEO headless returns the data.
