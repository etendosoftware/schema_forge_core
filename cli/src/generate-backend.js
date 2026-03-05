import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
export function prepareTemplateData(schema, rules, processes) {
  const windowName = schema.window.name;
  const packageSegment = toPackageName(windowName.replace(/\s+/g, '-').toLowerCase());
  const basePackage = `com.etendo.schemaforge.${packageSegment}`;

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
      packageName: `${basePackage}.dto.v1`,
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
      packageName: `${basePackage}.api.v1`,
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
    packageName: `${basePackage}.api.v1`,
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
export function generateFileList(data, windowName) {
  const slug = windowName.replace(/\s+/g, '-').toLowerCase();
  const basePath = `artifacts/${slug}/generated/backend`;
  const srcPath = `${basePath}/src/main/java/${data.basePackage.replace(/\./g, '/')}`;
  const files = [];

  // Event handlers
  for (const handler of data.eventHandlers) {
    files.push({
      path: `${srcPath}/event/${handler.className}.java`,
      templateName: 'EventHandler.java.hbs',
      data: handler,
    });
  }

  // Processes
  for (const proc of data.processes) {
    files.push({
      path: `${srcPath}/process/${proc.className}.java`,
      templateName: 'Process.java.hbs',
      data: proc,
    });
  }

  // DTOs
  for (const dto of data.dtos) {
    files.push({
      path: `${srcPath}/dto/v1/${dto.className}.java`,
      templateName: 'DTO.java.hbs',
      data: dto,
    });
  }

  // Endpoints
  for (const endpoint of data.endpoints) {
    files.push({
      path: `${srcPath}/api/v1/${endpoint.className}.java`,
      templateName: 'Endpoint.java.hbs',
      data: endpoint,
    });
  }

  // Validators
  for (const validator of data.validators) {
    files.push({
      path: `${srcPath}/validation/${validator.className}.java`,
      templateName: 'Validator.java.hbs',
      data: validator,
    });
  }

  // Error serializer
  files.push({
    path: `${srcPath}/api/v1/${data.errorSerializer.className}.java`,
    templateName: 'ErrorSerializer.java.hbs',
    data: data.errorSerializer,
  });

  // Build gradle
  files.push({
    path: `${basePath}/build.gradle`,
    templateName: 'build.gradle.hbs',
    data: data.buildGradle,
  });

  // Dataset XML
  files.push({
    path: `${basePath}/src/main/resources/referencedata/dataset.xml`,
    templateName: 'dataset.xml.hbs',
    data: data.datasets,
  });

  return files;
}

/**
 * Full orchestrator: compiles templates, writes files to artifacts/{windowName}/generated/backend/
 */
export async function generateBackend(schema, rules, processes, contract, windowName) {
  const data = prepareTemplateData(schema, rules, processes);
  const files = generateFileList(data, windowName);

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

  for (const file of files) {
    const templatePath = join(templatesDir, file.templateName);
    let content;
    try {
      const templateSource = await readFile(templatePath, 'utf8');
      // Simple Handlebars-like replacement (for MVP, real Handlebars can be added later)
      content = templateSource;
      for (const [key, value] of Object.entries(file.data)) {
        if (typeof value === 'string') {
          content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
      }
    } catch {
      // If template not found, generate a placeholder
      content = `// Generated file: ${file.path}\n// Template: ${file.templateName}\n`;
    }

    const outputPath = join(__dirname, '..', '..', file.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
  }

  // Save UUID manifest
  await mkdir(dirname(manifestPath), { recursive: true });
  await saveManifest(manifestPath, manifest);

  return { filesGenerated: files.length, manifestPath };
}
