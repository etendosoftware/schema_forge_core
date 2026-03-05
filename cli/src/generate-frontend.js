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
 * Generate a data table component for an entity.
 * Renders grid:true fields as columns, searchableFields as filter inputs.
 */
export function generateTableComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const gridFields = entity.fields.filter(f => f.grid);
  const searchableFields = entity.searchableFields ?? [];
  const compName = `${capitalize(entityName)}Table`;

  const imports = [
    `import React, { useState } from 'react';`,
    `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';`,
    `import { Input } from '@/components/ui/input';`,
    `import { Badge } from '@/components/ui/badge';`,
    `import { Button } from '@/components/ui/button';`,
  ];

  const filterState = searchableFields
    .map(f => `  const [filter${capitalize(f)}, setFilter${capitalize(f)}] = useState('');`)
    .join('\n');

  const filterInputs = searchableFields
    .map(f => `        <Input
          placeholder="Filter ${toLabel(f)}..."
          value={filter${capitalize(f)}}
          onChange={(e) => setFilter${capitalize(f)}(e.target.value)}
          className="max-w-xs"
        />`)
    .join('\n');

  const headerCells = gridFields
    .map(f => `            <TableHead>${toLabel(f.name)}</TableHead>`)
    .join('\n');

  const bodyCells = gridFields
    .map(f => {
      if (f.type === 'amount') {
        return `            <TableCell>{row.${f.name}?.toLocaleString()}</TableCell>`;
      }
      return `            <TableCell>{row.${f.name}}</TableCell>`;
    })
    .join('\n');

  return `${imports.join('\n')}

export default function ${compName}({ data = [], onRowSelect }) {
${filterState}

  const filteredData = data.filter(row => {
${searchableFields.map(f => `    if (filter${capitalize(f)} && !String(row.${f} ?? '').toLowerCase().includes(filter${capitalize(f)}.toLowerCase())) return false;`).join('\n')}
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
${filterInputs}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
${headerCells}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((row, idx) => (
            <TableRow key={row.id ?? idx} onClick={() => onRowSelect?.(row)} className="cursor-pointer">
${bodyCells}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
`;
}

/**
 * Generate a detail/edit form component for an entity.
 * Renders form:true fields, editable as inputs, readOnly as disabled.
 * Includes process action buttons for matching entity.
 */
export function generateFormComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const formFields = entity.fields.filter(f => f.form);
  const processes = getProcessesForEntity(contract, entityName);
  const compName = `${capitalize(entityName)}Form`;

  const imports = [
    `import React from 'react';`,
    `import { Input } from '@/components/ui/input';`,
    `import { Label } from '@/components/ui/label';`,
    `import { Button } from '@/components/ui/button';`,
    `import { Separator } from '@/components/ui/separator';`,
  ];

  const fieldElements = formFields.map(f => {
    const label = toLabel(f.name);
    const isReadOnly = f.visibility === 'readOnly';
    const inputType = f.tsType === 'number' ? 'number' : 'text';
    const disabledAttr = isReadOnly ? ' disabled readOnly className="bg-muted"' : '';
    const requiredAttr = f.required ? ' required' : '';

    return `        <div className="space-y-2">
          <Label htmlFor="${f.name}">${label}${f.required ? ' *' : ''}</Label>
          <Input
            id="${f.name}"
            name="${f.name}"
            type="${inputType}"
            value={data?.${f.name} ?? ''}
            onChange={(e) => onChange?.('${f.name}', e.target.value)}${disabledAttr}${requiredAttr}
          />
        </div>`;
  }).join('\n');

  const processButtons = processes.map(p => {
    const label = toLabel(p.name);
    return `          <Button variant="outline" onClick={() => onProcess?.('${p.name}')}>
            ${label}
          </Button>`;
  }).join('\n');

  const processSection = processes.length > 0
    ? `\n      <Separator />\n      <div className="flex gap-2">\n${processButtons}\n      </div>`
    : '';

  return `${imports.join('\n')}

export default function ${compName}({ data, onChange, onSave, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
${fieldElements}
      </div>
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
      </div>${processSection}
    </form>
  );
}
`;
}

/**
 * Generate a header-detail page component.
 * Shows header table, header form, and detail table.
 * Uses useEntity hook for state management and API calls.
 */
export function generatePageComponent(headerEntity, detailEntity, contract) {
  const headerName = capitalize(headerEntity);
  const detailName = capitalize(detailEntity);
  const compName = `${headerName}Page`;

  return `import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useEntity } from '@/hooks/useEntity';
import ${headerName}Table from './${headerName}Table';
import ${headerName}Form from './${headerName}Form';
import ${detailName}Table from './${detailName}Table';

export default function ${compName}({ token, apiBaseUrl }) {
  const ${headerEntity} = useEntity('${headerEntity}', '${detailEntity}', { token, apiBaseUrl });

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">${toLabel(headerEntity)}</h2>
        <div className="flex gap-2">
          <Button onClick={${headerEntity}.handleNew}>New</Button>
          {${headerEntity}.selected && (
            <Button variant="outline" onClick={${headerEntity}.handleDelete}>Delete</Button>
          )}
        </div>
      </div>
      <${headerName}Table data={${headerEntity}.items} onRowSelect={${headerEntity}.handleSelect} />
      {${headerEntity}.editing && (
        <>
          <Separator />
          <${headerName}Form
            data={${headerEntity}.editing}
            onChange={${headerEntity}.handleChange}
            onSave={${headerEntity}.handleSave}
            onProcess={${headerEntity}.handleProcess}
          />
          <Separator />
          <h3 className="text-lg font-medium">${toLabel(detailEntity)}</h3>
          <${detailName}Table data={${headerEntity}.children} />
        </>
      )}
    </div>
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
    return `import React from 'react';
import ${headerName}Page from './${headerName}Page';

export default function App({ token, apiBaseUrl, window }) {
  return <${headerName}Page token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
`;
  }

  return `import React from 'react';
import ${headerName}Table from './${headerName}Table';
import ${headerName}Form from './${headerName}Form';

export default function App({ token, apiBaseUrl, window }) {
  const [selected, setSelected] = React.useState(null);

  return (
    <div className="space-y-6 p-4">
      <${headerName}Table data={[]} onRowSelect={setSelected} />
      {selected && <${headerName}Form data={selected} />}
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
