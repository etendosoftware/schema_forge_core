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
 * Features: search filters with icons, zebra rows, selected row highlight, record count.
 */
export function generateTableComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const gridFields = entity.fields.filter(f => f.grid);
  const searchableFields = entity.searchableFields ?? [];
  const compName = `${capitalize(entityName)}Table`;

  const hasStatusField = gridFields.some(f => f.name.toLowerCase().includes('status'));

  const imports = [
    `import React, { useState } from 'react';`,
    `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';`,
    `import { Input } from '@/components/ui/input';`,
    `import { Search } from 'lucide-react';`,
  ];
  if (hasStatusField) {
    imports.push(`import { StatusBadge } from '@/components/ui/status-badge';`);
  }

  const filterState = searchableFields
    .map(f => `  const [filter${capitalize(f)}, setFilter${capitalize(f)}] = useState('');`)
    .join('\n');

  const filterInputs = searchableFields
    .map(f => `        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter ${toLabel(f)}..."
            value={filter${capitalize(f)}}
            onChange={(e) => setFilter${capitalize(f)}(e.target.value)}
            className="pl-8 max-w-xs focus:ring-2 focus:ring-primary focus:outline-none transition-colors duration-200"
            aria-label={"Filter by ${toLabel(f)}"}
          />
        </div>`)
    .join('\n');

  const headerCells = gridFields
    .map(f => `            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">${toLabel(f.name)}</TableHead>`)
    .join('\n');

  const bodyCells = gridFields
    .map(f => {
      if (f.name.toLowerCase().includes('status')) {
        return `            <TableCell><StatusBadge status={row.${f.name}} /></TableCell>`;
      }
      if (f.type === 'amount') {
        return `            <TableCell className="tabular-nums">{row.${f.name}?.toLocaleString()}</TableCell>`;
      }
      return `            <TableCell>{row.${f.name}}</TableCell>`;
    })
    .join('\n');

  return `${imports.join('\n')}

export default function ${compName}({ data = [], onRowSelect, selectedId }) {
${filterState}

  const filteredData = data.filter(row => {
${searchableFields.map(f => `    if (filter${capitalize(f)} && !String(row.${f} ?? '').toLowerCase().includes(filter${capitalize(f)}.toLowerCase())) return false;`).join('\n')}
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
${filterInputs}
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-primary/20 bg-muted/40">
${headerCells}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((row, idx) => (
              <TableRow
                key={row.id ?? idx}
                onClick={() => onRowSelect?.(row)}
                className={[
                  'cursor-pointer transition-colors',
                  row.id === selectedId ? 'bg-primary/10 border-l-2 border-l-primary' : '',
                  idx % 2 !== 0 && row.id !== selectedId ? 'bg-muted/30' : '',
                  'hover:bg-primary/5',
                ].filter(Boolean).join(' ')}
              >
${bodyCells}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filteredData.length} of {data.length} records</p>
    </div>
  );
}
`;
}

/**
 * Generate a detail/edit form component for an entity.
 * Features: grouped fields (editable vs readOnly), distinct disabled styling, separated process actions.
 */
export function generateFormComponent(entityName, contract) {
  const entity = contract.frontendContract.entities[entityName];
  const formFields = entity.fields.filter(f => f.form);
  const processes = getProcessesForEntity(contract, entityName);
  const compName = `${capitalize(entityName)}Form`;

  const editableFields = formFields.filter(f => f.visibility !== 'readOnly');
  const readOnlyFields = formFields.filter(f => f.visibility === 'readOnly');

  const imports = [
    `import React from 'react';`,
    `import { Input } from '@/components/ui/input';`,
    `import { Label } from '@/components/ui/label';`,
    `import { Button } from '@/components/ui/button';`,
    `import { Separator } from '@/components/ui/separator';`,
  ];

  function renderField(f) {
    const label = toLabel(f.name);
    const isReadOnly = f.visibility === 'readOnly';
    const inputType = f.tsType === 'number' ? 'number' : 'text';
    const disabledAttr = isReadOnly
      ? ' disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed"'
      : ' className="focus:ring-2 focus:ring-primary focus:outline-none"';
    const requiredAttr = f.required ? ' required' : '';

    return `        <div className="space-y-1.5">
          <Label htmlFor="${f.name}" className="text-sm ${isReadOnly ? 'text-muted-foreground' : 'text-foreground font-medium'}">${label}${f.required ? ' *' : ''}</Label>
          <Input
            id="${f.name}"
            name="${f.name}"
            type="${inputType}"
            value={data?.${f.name} ?? ''}
            onChange={(e) => onChange?.('${f.name}', e.target.value)}${disabledAttr}${requiredAttr}
          />
        </div>`;
  }

  const editableElements = editableFields.map(renderField).join('\n');
  const readOnlyElements = readOnlyFields.map(renderField).join('\n');

  const readOnlySection = readOnlyFields.length > 0
    ? `\n      <div className="space-y-3 rounded-lg border border-dashed p-4 bg-muted/10">\n        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System Fields</p>\n${readOnlyElements}\n      </div>`
    : '';

  const processButtons = processes.map(p => {
    const label = toLabel(p.name);
    return `          <Button variant="secondary" size="sm" onClick={() => onProcess?.('${p.name}')}>
            ${label}
          </Button>`;
  }).join('\n');

  const processSection = processes.length > 0
    ? `\n      <div className="rounded-lg border p-4 bg-muted/10 space-y-2">\n        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</p>\n        <div className="flex gap-2">\n${processButtons}\n        </div>\n      </div>`
    : '';

  return `${imports.join('\n')}

export default function ${compName}({ data, onChange, onSave, onDelete, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 bg-muted/20">
${editableElements}
      </div>${readOnlySection}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" size="sm">Save</Button>
        {onDelete && <Button variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); onDelete(); }}>Delete</Button>}
      </div>${processSection}
    </form>
  );
}
`;
}

/**
 * Generate a header-detail page component with Split View layout.
 * Features: table on left (40%), form+detail on right (60%), loading state, selected row tracking.
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

  const detailTitle = ${headerEntity}.editing?.id
    ? \`${toLabel(headerEntity)} \${${headerEntity}.editing.documentNo || ${headerEntity}.editing.id}\`
    : 'New ${toLabel(headerEntity)}';

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left panel: Table */}
      <div className={\`flex flex-col border-r transition-all duration-300 \${${headerEntity}.editing ? 'w-2/5' : 'w-full'}\`}>
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div>
            <h2 className="text-lg font-semibold text-foreground">${toLabel(headerEntity)}s</h2>
            <p className="text-xs text-muted-foreground">
              {${headerEntity}.loading ? 'Loading...' : \`\${${headerEntity}.items.length} records\`}
            </p>
          </div>
          <Button onClick={${headerEntity}.handleNew} size="sm">+ New</Button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {${headerEntity}.loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-muted rounded" />
              <div className="h-8 bg-muted/60 rounded" />
              <div className="h-8 bg-muted/40 rounded" />
              <div className="h-8 bg-muted/60 rounded" />
              <div className="h-8 bg-muted/40 rounded" />
            </div>
          ) : (
            <${headerName}Table
              data={${headerEntity}.items}
              onRowSelect={${headerEntity}.handleSelect}
              selectedId={${headerEntity}.selected?.id}
              compact={!!${headerEntity}.editing}
            />
          )}
        </div>
      </div>

      {/* Right panel: Form + Detail */}
      {${headerEntity}.editing && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
            <h2 className="text-lg font-semibold text-foreground">{detailTitle}</h2>
            <button
              onClick={() => ${headerEntity}.handleSelect(null)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close detail"
            >
              &times;
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <${headerName}Form
              data={${headerEntity}.editing}
              onChange={${headerEntity}.handleChange}
              onSave={${headerEntity}.handleSave}
              onDelete={${headerEntity}.selected ? ${headerEntity}.handleDelete : undefined}
              onProcess={${headerEntity}.handleProcess}
            />
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">${toLabel(detailEntity)}s</h3>
              <${detailName}Table data={${headerEntity}.children} />
            </div>
          </div>
        </div>
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
