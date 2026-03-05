import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { getOrCreateUuid, loadManifest, saveManifest } from './uuid-manifest.js';

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

  // Handlers: one per entity — these are called by the RestService router
  const handlers = schema.entities.map(entity => {
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
      className: `${toPascalCase(entity.name)}Handler`,
      table: entity.table ?? entity.tableName,
      entityClassname: entity.entityClassname,
      entityFullClass: entity.entityFullClass,
      filters: searchableFields,
      dtoClass: `${toPascalCase(entity.name)}DTO`,
      packageName: `${windowBasePackage}.handler`,
      // REST path segment: "cOrder" → "orders", "cOrderLine" → "order-lines" etc.
      pathSegment: entity.name,
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

  // Shared infrastructure (only generated once, not per-window)
  // RequestHandler interface
  files.push({
    path: `${restSrcPath}/RequestHandler.java`,
    templateName: null,
    content: `package ${data.basePackage}.rest;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Interface for all entity request handlers.
 * Implementations are registered in HandlerRegistry and dispatched by EtendoGoRestService.
 */
public interface RequestHandler {
  String getBasePath();
  void doGet(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
  void doPost(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
  void doPut(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
  void doDelete(HttpServletRequest request, HttpServletResponse response, String subPath) throws IOException;
}
`,
  });

  // HandlerRegistry
  const handlerImports = data.handlers.map(h =>
    `import ${h.packageName}.${h.className};`
  ).join('\n');
  const handlerRegistrations = data.handlers.map(h =>
    `    register(new ${h.className}());`
  ).join('\n');

  files.push({
    path: `${restSrcPath}/HandlerRegistry.java`,
    templateName: null,
    content: `package ${data.basePackage}.rest;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
${handlerImports}

/**
 * Registry of all request handlers, keyed by base path.
 * Auto-generated — regenerate when adding new windows.
 */
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
