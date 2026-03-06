import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Convert camelCase name to "Title Case" label.
 * e.g., 'orderLine' -> 'Order Line'
 */
export function toLabel(name) {
  if (!name) return '';
  const words = name.replace(/([A-Z])/g, ' $1').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Get process endpoints that match a given entity.
 */
export function getProcessesForEntity(contract, entityName) {
  const endpoints = contract.backendContract?.processEndpoints ?? [];
  return endpoints.filter(p => p.entity === entityName);
}

/**
 * Get the read-only fields for an entity (used by page component for summary strip).
 */
export function getReadOnlyFields(contract, entityName) {
  const entity = contract.frontendContract.entities[entityName];
  return entity.fields.filter(f => f.form && f.visibility === 'readOnly');
}

/**
 * Map a contract field type to a column/field type for the declarative config.
 */
function mapFieldType(field) {
  if (field.name.toLowerCase().includes('status')) return 'status';
  if (field.type === 'amount') return 'amount';
  if (field.type === 'number' || field.type === 'integer') return 'number';
  if (field.type === 'date') return 'date';
  return 'string';
}

/**
 * Map a contract field to a form field type.
 */
function mapFormFieldType(field) {
  if (field.tsType === 'number') return 'number';
  if (field.type === 'date') return 'date';
  return 'text';
}

/**
 * Generate a data table component for an entity.
 * Produces a thin declarative component that imports DataTable from contract-ui.
 */
export function generateTableComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const gridFields = entity.fields.filter(f => f.grid);
  const searchableFields = entity.searchableFields ?? [];
  const compName = `${capitalize(entityName)}Table`;

  const columnsArray = gridFields.map(f => {
    const type = mapFieldType(f);
    return `  { key: '${f.name}', label: '${toLabel(f.name)}', type: '${type}' },`;
  }).join('\n');

  const filtersArray = searchableFields.map(f => `'${f}'`).join(', ');

  return `import { DataTable } from '@/components/contract-ui';

const columns = [
${columnsArray}
];

const filters = [${filtersArray}];

export default function ${compName}(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
`;
}

/**
 * Generate a detail/edit form component for an entity.
 * Produces a thin declarative component that imports EntityForm from contract-ui.
 * Only renders editable fields (visibility !== 'readOnly').
 */
export function generateFormComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const formFields = entity.fields.filter(f => f.form);
  const editableFields = formFields.filter(f => f.visibility !== 'readOnly');
  const compName = `${capitalize(entityName)}Form`;

  const fieldsArray = editableFields.map(f => {
    const type = mapFormFieldType(f);
    const requiredPart = f.required ? ', required: true' : '';
    return `  { key: '${f.name}', label: '${toLabel(f.name)}', type: '${type}'${requiredPart} },`;
  }).join('\n');

  return `import { EntityForm } from '@/components/contract-ui';

const fields = [
${fieldsArray}
];

export default function ${compName}(props) {
  return <EntityForm fields={fields} {...props} />;
}
`;
}

/**
 * Generate a header-detail page component with Split View layout.
 * Produces a thin declarative component that imports MasterDetailPage from contract-ui.
 */
export function generatePageComponent(headerEntity, detailEntity, contract) {
  const headerName = capitalize(headerEntity);
  const detailName = capitalize(detailEntity);
  const compName = `${headerName}Page`;
  const processes = getProcessesForEntity(contract, headerEntity);
  const readOnlyFields = getReadOnlyFields(contract, headerEntity);

  // Detail entity editable fields for the add-line mini form
  const detailFields = contract.frontendContract.entities[detailEntity]?.fields ?? [];
  const detailEditableFields = detailFields.filter(f => f.form && f.visibility !== 'readOnly');

  // Status field gets a badge in the header; others go in the summary strip
  const statusField = readOnlyFields.find(f => f.name.toLowerCase().includes('status'));
  const summaryFields = readOnlyFields.filter(f => f !== statusField);

  // Summary config
  const summaryArray = summaryFields.map(f => {
    const type = mapFieldType(f);
    return `  { key: '${f.name}', label: '${toLabel(f.name)}', type: '${type}' },`;
  }).join('\n');

  // Status field config
  const statusFieldLine = statusField ? `'${statusField.name}'` : 'null';

  // Process config
  const processesArray = processes.map(p => {
    const isDestructive = /void|cancel|reject/i.test(p.name);
    const style = isDestructive ? 'destructive' : 'positive';
    return `  { name: '${p.name}', label: '${toLabel(p.name)}', style: '${style}' },`;
  }).join('\n');

  // Separate entry fields (user types) from auto-derived fields (price, tax, discount, amount)
  const autoPatterns = /price|tax|discount|amount|total|cost|net/i;
  const entryFields = detailEditableFields.filter(f => !autoPatterns.test(f.name));
  const derivedFields = detailEditableFields.filter(f => autoPatterns.test(f.name));

  // The first entry field (usually product) triggers a lookup
  const entryArray = entryFields.map((f, i) => {
    const type = mapFormFieldType(f);
    const requiredPart = f.required ? ', required: true' : '';
    const lookupPart = i === 0 ? ', lookup: true' : '';
    return `    { key: '${f.name}', label: '${toLabel(f.name)}', type: '${type}'${requiredPart}${lookupPart} },`;
  }).join('\n');

  const derivedArray = derivedFields.map(f => {
    const type = mapFormFieldType(f);
    return `    { key: '${f.name}', label: '${toLabel(f.name)}', type: '${type}' },`;
  }).join('\n');

  return `import { MasterDetailPage } from '@/components/contract-ui';
import ${headerName}Table from './${headerName}Table';
import ${headerName}Form from './${headerName}Form';
import ${detailName}Table from './${detailName}Table';

const summary = [
${summaryArray}
];

const statusField = ${statusFieldLine};

const processes = [
${processesArray}
];

const addLineFields = {
  entry: [
${entryArray}
  ],
  derived: [
${derivedArray}
  ],
};

export default function ${compName}(props) {
  return (
    <MasterDetailPage
      entity="${headerEntity}"
      detailEntity="${detailEntity}"
      Table={${headerName}Table}
      Form={${headerName}Form}
      DetailTable={${detailName}Table}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      entityLabel="${toLabel(headerEntity)}"
      detailLabel="${toLabel(detailEntity)}"
      {...props}
    />
  );
}
`;
}

/**
 * Generate the entry point / index component.
 * Accepts { token, apiBaseUrl, window } props.
 */
export function generateIndexComponent(headerEntity, detailEntity) {
  const headerName = capitalize(headerEntity);

  if (detailEntity) {
    return `import ${headerName}Page from './${headerName}Page';

export default function App({ token, apiBaseUrl, window }) {
  return <${headerName}Page token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
`;
  }

  return `import ${headerName}Table from './${headerName}Table';
import ${headerName}Form from './${headerName}Form';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <${headerName}Table data={[]} />
    </div>
  );
}
`;
}

/**
 * Generate all frontend components from a contract.
 * Returns a map of { filename: code }.
 */
export function generateAll(contract) {
  const { frontendContract } = contract;
  const { window: win, entities } = frontendContract;
  const primaryEntity = win.primaryEntity;
  const entityNames = Object.keys(entities);
  const detailEntity = entityNames.find(name => name !== primaryEntity);

  const files = {};

  // Generate Table + Form for each entity
  for (const entityName of entityNames) {
    const capName = capitalize(entityName);
    files[`${capName}Table.jsx`] = generateTableComponent(entityName, contract);
    files[`${capName}Form.jsx`] = generateFormComponent(entityName, contract);
  }

  // Generate Page if there is a detail entity
  if (detailEntity) {
    files[`${capitalize(primaryEntity)}Page.jsx`] = generatePageComponent(primaryEntity, detailEntity, contract);
  }

  // Always generate index
  files['index.jsx'] = generateIndexComponent(primaryEntity, detailEntity);

  return files;
}

// CLI entry point -- only runs when executed directly
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isDirectRun) {
  const contractPath = process.argv[2];
  if (!contractPath) {
    console.error('Usage: node cli/src/generate-frontend.js <contract-path>');
    process.exit(1);
  }

  const contractJson = readFileSync(resolve(contractPath), 'utf-8');
  const contract = JSON.parse(contractJson);
  const files = generateAll(contract);

  const windowName = contract.frontendContract.window.name
    .toLowerCase()
    .replace(/\s+/g, '-');

  const outDir = resolve(`artifacts/${windowName}/generated/web/${windowName}`);
  mkdirSync(outDir, { recursive: true });

  for (const [filename, code] of Object.entries(files)) {
    const filePath = resolve(outDir, filename);
    writeFileSync(filePath, code, 'utf-8');
    console.log(`  wrote ${filePath}`);
  }

  console.log(`\nGenerated ${Object.keys(files).length} files in ${outDir}`);
}
