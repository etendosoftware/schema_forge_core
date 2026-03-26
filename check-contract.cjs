const fs = require('fs');
const contract = JSON.parse(fs.readFileSync('artifacts/contacts/contract.json', 'utf8'));
const activeField = contract.frontendContract.entities.bpartner.fields.find(f => f.key === 'active');
console.log('Contract:', activeField);
