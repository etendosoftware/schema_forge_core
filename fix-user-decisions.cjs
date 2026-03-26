const fs = require('fs');

const path = 'artifacts/contacts/decisions.json';
const decisions = JSON.parse(fs.readFileSync(path, 'utf8'));

// Add 'user' entity configuration to decisions.json
decisions.entities.user = {
  fields: {
    name: { visibility: 'readOnly', grid: true, searchable: true, section: 'principal' }, // Full name computed
    firstName: { visibility: 'editable', section: 'principal' },
    lastName: { visibility: 'editable', section: 'principal' },
    email: { visibility: 'editable', grid: true, searchable: true, section: 'principal' },
    phone: { visibility: 'editable', grid: true, section: 'principal' },
    position: { visibility: 'editable', section: 'principal' },
    active: { visibility: 'readOnly', section: 'other' }
  }
};

fs.writeFileSync(path, JSON.stringify(decisions, null, 2));
console.log('decisions.json updated for user entity');
