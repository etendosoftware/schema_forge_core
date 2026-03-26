const fs = require('fs');
const content = fs.readFileSync('tools/app-shell/src/components/contract-ui/DetailView.jsx', 'utf8');

// Try to parse JSX using regex to see if tags are unclosed
let openDivs = (content.match(/<div/g) || []).length;
let closeDivs = (content.match(/<\/div>/g) || []).length;

console.log('Open divs:', openDivs);
console.log('Close divs:', closeDivs);

let openFrags = (content.match(/<>/g) || []).length;
let closeFrags = (content.match(/<\/>/g) || []).length;

console.log('Open frags:', openFrags);
console.log('Close frags:', closeFrags);
