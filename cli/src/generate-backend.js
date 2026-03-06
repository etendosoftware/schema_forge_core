import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { getOrCreateUuid, loadManifest, saveManifest } from './uuid-manifest.js';
import { toCamelCase } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function toPascalCase(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, '');
}

/** "Sales Order" → "salesorder" (package-safe, no hyphens/spaces) */
function toWindowPackage(windowName) {
  return windowName.replace(/[\s-_]+/g, '').toLowerCase();
}

/** "Sales Order" → "sales-order", "Line Tax" → "line-tax" (URL-safe slug) */
function toSlug(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

/**
 * Parse an HQL where clause into simple property=value conditions
 * that can be auto-set on POST (entity creation).
 *
 * Only extracts direct property conditions (e.g., "e.salesTransaction=true").
 * Skips complex conditions (NOT LIKE, nested paths with multiple dots, etc.).
 *
 * @param {string|null} hqlClause - e.g. "e.salesTransaction=true AND e.transactionDocument.return=false"
 * @returns {Array<{property: string, value: string, javaValue: string}>}
 */
function parseTabAutoSetters(hqlClause) {
  if (!hqlClause) return [];
  const setters = [];

  const conditions = hqlClause.split(/\s+AND\s+/i);
  for (const cond of conditions) {
    const match = cond.trim().match(/^e\.([a-zA-Z]+)\s*=\s*(.+)$/);
    if (!match) continue;

    const property = match[1];
    const rawValue = match[2].trim();

    let javaValue;
    if (rawValue === 'true' || rawValue === 'false') {
      javaValue = rawValue;
    } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
      javaValue = `"${rawValue.slice(1, -1)}"`;
    } else if (!isNaN(rawValue)) {
      javaValue = rawValue;
    } else {
      continue;
    }

    setters.push({ property, rawValue, javaValue });
  }

  return setters;
}

/**
 * Convert column name to OBDal property name for cascade params.
 * E.g., "C_BPartner_ID" -> "cBpartner" (strip _ID, camelCase)
 * This is a simplified mapping — for production, we'd use the entity metadata.
 */
export function toOBDalProperty(columnName) {
  if (columnName.endsWith('_ID')) {
    return toCamelCase(columnName.slice(0, -3));
  }
  return toCamelCase(columnName);
}

/**
 * Build selector configuration from schema entities.
 * Extracts unique FK fields that need selector endpoints, deduplicating by field name.
 */
export function buildSelectorData(entities) {
  const selectors = [];
  const seen = new Set();

  for (const entity of entities) {
    for (const field of entity.fields) {
      if (field.type !== 'foreignKey' || !field.reference) continue;
      // Skip system/discarded fields — no selector needed
      if (field.visibility === 'system' || field.visibility === 'discarded') continue;

      const key = field.name;
      if (seen.has(key)) continue;
      seen.add(key);

      // Map display column to OBDal property name
      const displayProperty = field.reference.displayColumn
        ? toCamelCase(field.reference.displayColumn)
        : 'name';

      // Cascade params from validationRule
      const cascadeParams = (field.validationRule?.cascadeParams || [])
        .map(p => toOBDalProperty(p));

      selectors.push({
        fieldName: field.name,
        columnName: field.columnName,
        targetTable: field.reference.targetTable,
        entityClass: field.reference.targetTable,  // Simplified: table name as entity ref
        displayProperty,
        keyColumn: field.reference.keyColumn || field.columnName,
        cascadeParams,
        filterExpression: field.reference.filterExpression || null,
        validationCode: field.validationRule?.code || null,
      });
    }
  }

  return selectors;
}

/**
 * Transforms schema/rules/processes into template-ready data structures.
 * All generated classes go under: basePackage.windowPkg.* (e.g., com.etendoerp.go.salesorder.dto)
 */
export function prepareTemplateData(schema, rules, processes, moduleConfig = {}) {
  const windowName = schema.window.name;
  const basePackage = moduleConfig.javaPackage ?? 'com.etendoerp.go';
  const windowPkg = toWindowPackage(windowName);
  const windowBasePackage = `${basePackage}.${windowPkg}`;

  const now = new Date().toISOString();

  // NOTE: Event handlers (derivations) are NOT generated.
  // Etendo already handles system field derivations via existing event handlers
  // registered in the AD. OBDal triggers them automatically on save.
  // What we DO generate are callout endpoints — UI-side logic that fires
  // when a field changes (e.g., change BP → auto-fill address, price list).

  // Build entity lookup for resolving entity names → classes
  const entityLookup = {};
  for (const entity of schema.entities) {
    entityLookup[entity.name] = {
      entityClassname: entity.entityClassname,
      entityFullClass: entity.entityFullClass,
      table: entity.table ?? entity.tableName,
    };
  }

  // Processes
  const processData = (processes || []).map(proc => {
    const resolved = entityLookup[proc.entity] || {};
    return {
      name: proc.name,
      className: `${toPascalCase(proc.name)}Process`,
      entity: proc.entity,
      entityClassname: resolved.entityClassname,
      entityFullClass: resolved.entityFullClass,
      table: resolved.table,
      preconditions: proc.preconditions || [],
      steps: (proc.steps || []).map(s => ({
        order: s.order,
        name: s.name || s.operation || 'unnamed',
        description: s.description || '',
        type: s.type || s.operation || 'unknown',
        target: s.target,
      })),
      edgeCases: proc.edgeCases || [],
      packageName: `${windowBasePackage}.process`,
    };
  });

  // DTOs: one per entity with visible fields
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
      table: entity.table ?? entity.tableName,
      entityClassname: entity.entityClassname,
      entityFullClass: entity.entityFullClass,
      fields: visibleFields,
      packageName: `${windowBasePackage}.dto`,
    };
  });

  // Handlers: one per tab — window-scoped paths to avoid collisions
  // Path: /{windowSlug}/{tabSlug} (e.g., /sales-order/header, /sales-order/lines)
  const windowSlug = toSlug(windowName);
  const handlers = schema.entities.map(entity => {
    const searchableFields = entity.fields
      .filter(f => f.visibility !== 'system' && f.visibility !== 'discarded')
      .filter(f => f.type === 'string' || f.type === 'id' || f.type === 'foreignKey')
      .map(f => ({
        name: f.name,
        column: f.column,
        javaType: toJavaType(f.type),
      }));

    // Tab name from curation (description) or schema-raw (tabName)
    const tabName = entity.description ?? entity.tabName ?? entity.name;
    const tabSlug = toSlug(tabName);

    // Tab filter: HQL where clause that scopes this endpoint (e.g., "e.salesTransaction=true")
    const hqlWhereClause = entity.hqlWhereClause || null;
    const tabAutoSetters = parseTabAutoSetters(hqlWhereClause);

    return {
      entityName: entity.name,
      tabName,
      className: `${toPascalCase(tabName)}Handler`,
      table: entity.table ?? entity.tableName,
      entityClassname: entity.entityClassname,
      entityFullClass: entity.entityFullClass,
      filters: searchableFields,
      dtoClass: `${toPascalCase(entity.name)}DTO`,
      packageName: `${windowBasePackage}.handler`,
      // Window-scoped path: /sales-order/header, /sales-order/lines
      pathSegment: `${windowSlug}/${tabSlug}`,
      // Tab-level filter
      hqlWhereClause,
      tabAutoSetters,
    };
  });

  // Validators
  const validators = (processes || [])
    .filter(p => p.preconditions && p.preconditions.length > 0)
    .map(proc => {
      const resolved = entityLookup[proc.entity] || {};
      return {
        name: proc.name,
        className: `${toPascalCase(proc.name)}Validator`,
        entity: proc.entity,
        entityClassname: resolved.entityClassname,
        entityFullClass: resolved.entityFullClass,
        preconditions: proc.preconditions,
        packageName: `${windowBasePackage}.validation`,
      };
    });

  // Selectors: one endpoint per window serving all FK field lookups
  const selectors = buildSelectorData(schema.entities);

  const selectorEndpoint = selectors.length > 0 ? {
    className: `${toPascalCase(windowName)}SelectorHandler`,
    windowName,
    pathSegment: windowPkg,
    selectors,
    packageName: `${windowBasePackage}.handler`,
  } : null;

  return {
    basePackage,
    windowPkg,
    windowBasePackage,
    windowName,
    now,
    processes: processData,
    dtos,
    handlers,
    validators,
    selectorEndpoint,
  };
}

/**
 * Creates the list of { path, templateName, data } entries for file generation.
 * All files go under modulePath/src/com/etendoerp/go/{windowPkg}/...
 */
export function generateFileList(data, modulePath) {
  const windowSrcPath = `${modulePath}/src/${data.windowBasePackage.replace(/\./g, '/')}`;
  const restSrcPath = `${modulePath}/src/${data.basePackage.replace(/\./g, '/')}/rest`;
  const files = [];

  // NOTE: No event handlers generated — Etendo handles derivations natively via OBDal.

  // Processes
  for (const proc of data.processes) {
    files.push({
      path: `${windowSrcPath}/process/${proc.className}.java`,
      templateName: 'DalProcess.java.hbs',
      data: { ...proc, package: proc.packageName, generatedDate: data.now },
    });
  }

  // DTOs
  for (const dto of data.dtos) {
    files.push({
      path: `${windowSrcPath}/dto/${dto.className}.java`,
      templateName: 'DTO.java.hbs',
      data: {
        ...dto,
        package: dto.packageName,
        version: '1',
        generatedDate: data.now,
        fields: dto.fields.map(f => ({
          ...f,
          type: f.javaType,
          getter: `get${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`,
          setter: `set${f.name.charAt(0).toUpperCase()}${f.name.slice(1)}`,
        })),
      },
    });
  }

  // Handlers
  for (const handler of data.handlers) {
    files.push({
      path: `${windowSrcPath}/handler/${handler.className}.java`,
      templateName: 'RxEndpoint.java.hbs',
      data: {
        ...handler,
        package: handler.packageName,
        generatedDate: data.now,
        filters: handler.filters.map(f => ({ ...f, type: f.javaType })),
      },
    });
  }

  // Validators
  for (const validator of data.validators) {
    files.push({
      path: `${windowSrcPath}/validation/${validator.className}.java`,
      templateName: 'PreconditionValidator.java.hbs',
      data: { ...validator, package: validator.packageName, generatedDate: data.now },
    });
  }

  // Selector endpoint
  if (data.selectorEndpoint) {
    files.push({
      path: `${windowSrcPath}/handler/${data.selectorEndpoint.className}.java`,
      templateName: 'SelectorEndpoint.java.hbs',
      data: {
        ...data.selectorEndpoint,
        package: data.selectorEndpoint.packageName,
        generatedDate: data.now,
      },
    });
  }

  // Shared infrastructure (only generated once, not per-window)
  // RequestHandler interface
  files.push({
    path: `${restSrcPath}/RequestHandler.java`,
    templateName: null,
    content: `package ${data.basePackage}.rest;

import javax.annotation.Generated;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Interface for all entity request handlers.
 * Implementations are registered in HandlerRegistry and dispatched by EtendoGoRestService.
 */
@Generated(value = "schema-forge", date = "${data.now}")
public interface RequestHandler {
  String getBasePath();
  void doGet(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
  void doPost(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
  void doPut(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
  void doDelete(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
}
`,
  });

  // HandlerRegistry — uses fully qualified class names to avoid import collisions
  // when multiple windows share the same entity (e.g., Sales Order + Purchase Order → both have HeaderHandler)
  const handlerRegistrations = [
    ...data.handlers.map(h => `    register(new ${h.packageName}.${h.className}());`),
    ...(data.selectorEndpoint ? [`    register(new ${data.selectorEndpoint.packageName}.${data.selectorEndpoint.className}());`] : []),
  ].join('\n');

  files.push({
    path: `${restSrcPath}/HandlerRegistry.java`,
    templateName: null,
    content: `package ${data.basePackage}.rest;

import javax.annotation.Generated;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry of all request handlers, keyed by base path.
 * Auto-generated — regenerate when adding new windows.
 */
@Generated(value = "schema-forge", date = "${data.now}")
public class HandlerRegistry {

  private static final HandlerRegistry INSTANCE = new HandlerRegistry();
  private final Map<String, RequestHandler> handlers = new ConcurrentHashMap<>();

  private HandlerRegistry() {
${handlerRegistrations}
  }

  public static HandlerRegistry getInstance() {
    return INSTANCE;
  }

  private void register(RequestHandler handler) {
    handlers.put(handler.getBasePath(), handler);
  }

  public RequestHandler findHandler(String path) {
    if (path == null) return null;
    // Match longest prefix: /salesorder/cOrder/123 → find handler for /salesorder/cOrder
    String remaining = path;
    while (remaining.length() > 0) {
      RequestHandler handler = handlers.get(remaining);
      if (handler != null) return handler;
      int lastSlash = remaining.lastIndexOf('/');
      if (lastSlash <= 0) break;
      remaining = remaining.substring(0, lastSlash);
    }
    return null;
  }

  public String getSubPath(String fullPath, RequestHandler handler) {
    String base = handler.getBasePath();
    if (fullPath.length() <= base.length()) return "";
    return fullPath.substring(base.length());
  }
}
`,
  });

  return files;
}

/**
 * Full orchestrator: compiles templates, writes files to the module.
 */
export async function generateBackend(schema, rules, processes, contract, windowName, moduleConfig = {}) {
  const modulePath = moduleConfig.modulePath;
  if (!modulePath) {
    throw new Error('moduleConfig.modulePath is required — set it in schema_forge.properties');
  }

  const data = prepareTemplateData(schema, rules, processes, moduleConfig);
  const files = generateFileList(data, modulePath);

  const slug = windowName.replace(/\s+/g, '-').toLowerCase();
  const manifestPath = join(__dirname, '..', '..', 'artifacts', slug, 'uuid-manifest.json');
  const manifest = await loadManifest(manifestPath);

  // Assign UUIDs
  for (const proc of data.processes) {
    proc.uuid = getOrCreateUuid(manifest, 'AD_Process', proc.name);
  }

  // Register Handlebars helpers
  Handlebars.registerHelper('unless', function(conditional, options) {
    if (!conditional) return options.fn(this);
    return options.inverse(this);
  });

  const templatesDir = join(__dirname, '..', '..', 'templates');

  for (const file of files) {
    let content;

    if (file.content) {
      // Pre-built content (no template needed)
      content = file.content;
    } else {
      const templatePath = join(templatesDir, file.templateName);
      try {
        const templateSource = await readFile(templatePath, 'utf8');
        const template = Handlebars.compile(templateSource);
        content = template(file.data);
      } catch (err) {
        console.warn(`  Warning: template ${file.templateName} failed: ${err.message}`);
        content = `// Generated file: ${file.path}\n// Template: ${file.templateName}\n`;
      }
    }

    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, content);
  }

  // Save UUID manifest
  await mkdir(dirname(manifestPath), { recursive: true });
  await saveManifest(manifestPath, manifest);

  return { filesGenerated: files.length, manifestPath };
}
