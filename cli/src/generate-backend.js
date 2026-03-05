import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { getOrCreateUuid, loadManifest, saveManifest } from './uuid-manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Map schema field types to Java types */
const JAVA_TYPE_MAP = {
  string: 'String',
  integer: 'Integer',
  amount: 'BigDecimal',
  number: 'BigDecimal',
  boolean: 'Boolean',
  date: 'Date',
  datetime: 'Date',
  id: 'String',
  foreignKey: 'String',
};

function toJavaType(fieldType) {
  return JAVA_TYPE_MAP[fieldType] || 'String';
}

/** Convert a name to PascalCase class name */
function toPascalCase(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, '');
}

/** Convert window name to camelCase package segment (no hyphens) */
function toPackageName(windowName) {
  return windowName
    .replace(/[-_]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}

/**
 * Transforms schema/rules/processes into template-ready data structures.
 */
export function prepareTemplateData(schema, rules, processes, moduleConfig = {}) {
  const windowName = schema.window.name;
  const basePackage = moduleConfig.javaPackage ?? 'com.etendoerp.go';
  const packageSegment = basePackage.split('.').pop();

  // Event handlers: one per entity with system field derivations
  const eventHandlers = schema.entities
    .map(entity => {
      const derivations = entity.fields
        .filter(f => f.visibility === 'system' && f.derivation)
        .map(f => ({
          field: f.name,
          column: f.column,
          type: f.derivation.type,
          source: f.derivation.source,
          javaType: toJavaType(f.type),
        }));

      return {
        entityName: entity.name,
        className: `${toPascalCase(entity.name)}DerivationHandler`,
        table: entity.table,
        derivations,
        packageName: `${basePackage}.event`,
        entityClass: `${basePackage}.dto.${toPascalCase(entity.name)}DTO`,
      };
    })
    .filter(h => h.derivations.length > 0);

  // Processes: class data with preconditions and steps
  const processData = (processes || []).map(proc => ({
    name: proc.name,
    className: `${toPascalCase(proc.name)}Process`,
    entity: proc.entity,
    preconditions: proc.preconditions || [],
    steps: (proc.steps || []).map(s => ({
      order: s.order,
      operation: s.operation,
      target: s.target,
      value: s.value || null,
      rule: s.rule || null,
      isStub: s.operation !== 'validate' && s.operation !== 'mutation',
    })),
    edgeCases: proc.edgeCases || [],
    packageName: `${basePackage}.process`,
  }));

  // DTOs: one per entity with only visible (non-system, non-discarded) fields
  const dtos = schema.entities.map(entity => {
    const visibleFields = entity.fields
      .filter(f => f.visibility !== 'system' && f.visibility !== 'discarded')
      .map(f => ({
        name: f.name,
        column: f.column,
        type: f.type,
        javaType: toJavaType(f.type),
        required: f.required || false,
        readOnly: f.visibility === 'readOnly',
      }));

    return {
      entityName: entity.name,
      className: `${toPascalCase(entity.name)}DTO`,
      table: entity.table,
      fields: visibleFields,
      packageName: `${basePackage}.dto`,
    };
  });

  // Endpoints: one per entity with searchable filters
  const endpoints = schema.entities.map(entity => {
    const searchableFields = entity.fields
      .filter(f => f.visibility !== 'system' && f.visibility !== 'discarded')
      .filter(f => f.type === 'string' || f.type === 'id' || f.type === 'foreignKey')
      .map(f => ({
        name: f.name,
        column: f.column,
        javaType: toJavaType(f.type),
      }));

    return {
      entityName: entity.name,
      className: `${toPascalCase(entity.name)}Endpoint`,
      table: entity.table,
      filters: searchableFields,
      dtoClass: `${toPascalCase(entity.name)}DTO`,
      packageName: `${basePackage}.rest.handler`,
    };
  });

  // Validators: precondition validators from processes
  const validators = (processes || [])
    .filter(p => p.preconditions && p.preconditions.length > 0)
    .map(proc => ({
      name: proc.name,
      className: `${toPascalCase(proc.name)}Validator`,
      preconditions: proc.preconditions,
      packageName: `${basePackage}.validation`,
    }));

  // Error serializer data
  const errorSerializer = {
    className: 'ErrorSerializer',
    packageName: `${basePackage}.rest`,
  };

  // Build gradle config
  const buildGradle = {
    group: basePackage,
    version: schema.version || '0.1.0',
    moduleName: packageSegment,
  };

  // Dataset records
  const datasets = {
    windowId: schema.window.id,
    windowName: schema.window.name,
    entities: schema.entities.map(e => ({
      name: e.name,
      table: e.table,
    })),
    processes: (processes || []).map(p => ({
      name: p.name,
      entity: p.entity,
    })),
  };

  return {
    basePackage,
    packageSegment,
    windowName,
    eventHandlers,
    processes: processData,
    dtos,
    endpoints,
    validators,
    errorSerializer,
    buildGradle,
    datasets,
  };
}

/**
 * Creates the list of { path, templateName, data } entries for file generation.
 */
export function generateFileList(data, windowName, modulePath) {
  const srcPath = `${modulePath}/src/${data.basePackage.replace(/\./g, '/')}`;
  const files = [];

  // Event handlers
  for (const handler of data.eventHandlers) {
    files.push({
      path: `${srcPath}/event/${handler.className}.java`,
      templateName: 'EventHandler.java.hbs',
      data: { ...handler, package: handler.packageName, generatedDate: new Date().toISOString() },
    });
  }

  // Processes
  for (const proc of data.processes) {
    files.push({
      path: `${srcPath}/process/${proc.className}.java`,
      templateName: 'DalProcess.java.hbs',
      data: { ...proc, package: proc.packageName, generatedDate: new Date().toISOString() },
    });
  }

  // DTOs
  for (const dto of data.dtos) {
    files.push({
      path: `${srcPath}/dto/${dto.className}.java`,
      templateName: 'DTO.java.hbs',
      data: {
        ...dto,
        package: dto.packageName,
        version: '1',
        generatedDate: new Date().toISOString(),
        fields: dto.fields.map(f => ({
          ...f,
          type: f.javaType,
          getter: `get${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`,
          setter: `set${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`,
        })),
      },
    });
  }

  // Endpoints
  for (const endpoint of data.endpoints) {
    files.push({
      path: `${srcPath}/rest/handler/${endpoint.className}.java`,
      templateName: 'RxEndpoint.java.hbs',
      data: {
        ...endpoint,
        package: endpoint.packageName,
        generatedDate: new Date().toISOString(),
        entityClass: `${data.basePackage}.dto.${endpoint.dtoClass}`,
        filters: endpoint.filters.map(f => ({ ...f, type: f.javaType })),
      },
    });
  }

  // Validators
  for (const validator of data.validators) {
    files.push({
      path: `${srcPath}/validation/${validator.className}.java`,
      templateName: 'PreconditionValidator.java.hbs',
      data: { ...validator, package: validator.packageName, generatedDate: new Date().toISOString() },
    });
  }

  // Error serializer
  files.push({
    path: `${srcPath}/rest/${data.errorSerializer.className}.java`,
    templateName: 'ErrorSerializer.java.hbs',
    data: { ...data.errorSerializer, package: data.errorSerializer.packageName, generatedDate: new Date().toISOString() },
  });

  // build.gradle and dataset.xml are NOT generated — the module already has them

  return files;
}

/**
 * Full orchestrator: compiles templates, writes files to artifacts/{windowName}/generated/backend/
 */
export async function generateBackend(schema, rules, processes, contract, windowName, moduleConfig = {}) {
  const modulePath = moduleConfig.modulePath;
  if (!modulePath) {
    throw new Error('moduleConfig.modulePath is required — set it in schema_forge.properties');
  }

  const data = prepareTemplateData(schema, rules, processes, moduleConfig);
  const files = generateFileList(data, windowName, modulePath);

  const slug = windowName.replace(/\s+/g, '-').toLowerCase();
  const manifestPath = join(__dirname, '..', '..', 'artifacts', slug, 'uuid-manifest.json');
  const manifest = await loadManifest(manifestPath);

  // Assign UUIDs to processes and entities in datasets
  for (const proc of data.processes) {
    proc.uuid = getOrCreateUuid(manifest, 'AD_Process', proc.name);
  }
  for (const entity of data.datasets.entities) {
    entity.uuid = getOrCreateUuid(manifest, 'AD_Table', entity.table);
  }

  // Load and compile Handlebars templates
  const templatesDir = join(__dirname, '..', '..', 'templates');

  // Register Handlebars helpers
  Handlebars.registerHelper('unless', function(conditional, options) {
    if (!conditional) return options.fn(this);
    return options.inverse(this);
  });

  for (const file of files) {
    const templatePath = join(templatesDir, file.templateName);
    let content;
    try {
      const templateSource = await readFile(templatePath, 'utf8');
      const template = Handlebars.compile(templateSource);
      content = template(file.data);
    } catch (err) {
      // If template not found, generate a placeholder
      console.warn(`  Warning: template ${file.templateName} failed: ${err.message}`);
      content = `// Generated file: ${file.path}\n// Template: ${file.templateName}\n`;
    }

    const outputPath = file.path;
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
  }

  // Save UUID manifest
  await mkdir(dirname(manifestPath), { recursive: true });
  await saveManifest(manifestPath, manifest);

  return { filesGenerated: files.length, manifestPath };
}
