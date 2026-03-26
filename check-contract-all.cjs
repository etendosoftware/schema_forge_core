const fs = require('fs');
const contract = JSON.parse(fs.readFileSync('artifacts/contacts/contract.json', 'utf8'));
const activeField = contract.frontendContract.entities.bpartner.fields.find(f => f.column === 'IsActive');
console.log('Contract IsActive field:', activeField);
