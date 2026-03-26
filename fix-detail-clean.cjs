const fs = require('fs');

const path = 'tools/app-shell/src/components/contract-ui/DetailView.jsx';
let content = fs.readFileSync(path, 'utf8');

// Remove double declaration
content = content.replace(
  "const [addingSecondaryLine, setAddingSecondaryLine] = useState({});\n  const [addingSecondaryLine, setAddingSecondaryLine] = useState({});",
  "const [addingSecondaryLine, setAddingSecondaryLine] = useState({});"
);

fs.writeFileSync(path, content);
