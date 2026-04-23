import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from './shared.js';

const NON_EDITABLE_VISIBILITIES = new Set(['discarded', 'system', 'readOnly']);
const SERVER_DEFAULT_DERIVATIONS = new Set(['sequence', 'fromParent', 'fromConfig']);

function readContract(windowDir) {
  const contractPath = join(windowDir, 'contract.json');
  return existsSync(contractPath) ? readJson(contractPath) : null;
}


function getAddLineFieldsSource(pageSource) {
  const match = pageSource.match(/const addLineFields = \{([\s\S]*?)\n\};/);
  return match ? match[0] : null;
}

function hasServerDefault(field) {
  if (field.callout) {
    return true;
  }
  return SERVER_DEFAULT_DERIVATIONS.has(field.derivation?.type);
}

function findCustomFormDeclarations(windowConfig) {
  const declarations = [];
  if (windowConfig?.headerExtra?.customForm) {
    declarations.push({ location: 'window.headerExtra.customForm', component: windowConfig.headerExtra.customForm });
  }
  for (const [key, value] of Object.entries(windowConfig?.secondaryTabs ?? {})) {
    if (value?.customForm) {
      declarations.push({ location: `window.secondaryTabs.${key}.customForm`, component: value.customForm });
    }
  }
  return declarations;
}

function customFormExists(rootDir, windowName, component) {
  return existsSync(join(rootDir, 'artifacts', windowName, 'custom', `${component}.jsx`))
    || existsSync(join(rootDir, 'tools', 'app-shell', 'src', 'windows', 'custom', windowName, `${component}.jsx`));
}

export async function runInvariantsCheck(windowName, { rootDir, windowDir, config }) {
  const contract = readContract(windowDir);
  if (!contract?.frontendContract) {
    return { status: 'skip', detail: 'contract.json is missing frontendContract.' };
  }

  const violations = [];
  const entities = contract.frontendContract.entities ?? {};
  const primaryEntity = contract.frontendContract.window?.primaryEntity ?? Object.keys(entities)[0] ?? null;
  const headerEntity = primaryEntity ? entities[primaryEntity] : null;
  const anyDraftMode = Object.values(entities).some((entity) => entity?.draftMode?.enabled === true);

  if (config?.invariants?.draftModeReadOnlyLogic && anyDraftMode && headerEntity?.fields) {
    for (const field of headerEntity.fields) {
      if (!field.form || NON_EDITABLE_VISIBILITIES.has(field.visibility)) {
        continue;
      }
      if (!field.readOnlyLogic) {
        violations.push(`${primaryEntity}.${field.name} missing readOnlyLogic while draftMode is enabled.`);
      }
    }
  }

  if (config?.invariants?.notNullRequiresRequired) {
    for (const [entityName, entity] of Object.entries(entities)) {
      for (const field of entity.fields ?? []) {
        if (field.sourceRequired === true && field.required !== true && !hasServerDefault(field)) {
          violations.push(`${entityName}.${field.name} must remain required because the source column is NOT NULL.`);
        }
      }
    }
  }

  const generatedPagePath = join(windowDir, 'generated', 'web', windowName, `${windowName.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}Page.jsx`);
  if (config?.invariants?.addLineFields && existsSync(generatedPagePath)) {
    const addLineFieldsSource = getAddLineFieldsSource(readFileSync(generatedPagePath, 'utf8'));
    if (addLineFieldsSource) {
      if (config.invariants.addLineFields.requiredProductLookup && !/key:\s*'product'[\s\S]*?lookup:\s*true/.test(addLineFieldsSource)) {
        violations.push('lines.addLineFields.product must declare lookup: true.');
      }
      if (config.invariants.addLineFields.quantityDefaultOne && !/key:\s*'quantity'[\s\S]*?defaultValue:\s*1/.test(addLineFieldsSource)) {
        violations.push('lines.addLineFields.quantity must declare defaultValue: 1.');
      }
      if (config.invariants.addLineFields.hiddenContainsGrossUnitPriceAndPriceList) {
        if (!/hidden:\s*\[[\s\S]*'grossUnitPrice'/.test(addLineFieldsSource)) {
          violations.push("lines.addLineFields.hidden must include 'grossUnitPrice'.");
        }
        if (!/hidden:\s*\[[\s\S]*'priceList'/.test(addLineFieldsSource)) {
          violations.push("lines.addLineFields.hidden must include 'priceList'.");
        }
      }
    }
  }

  for (const declaration of findCustomFormDeclarations(contract.frontendContract.window)) {
    if (!customFormExists(rootDir, windowName, declaration.component)) {
      violations.push(`${declaration.location} references '${declaration.component}', but no local custom form exists for ${windowName}.`);
    }
  }

  if (violations.length > 0) {
    return {
      status: 'fail',
      detail: violations.join(' '),
    };
  }

  return { status: 'pass', detail: 'All invariants satisfied.' };
}
