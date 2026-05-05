/** @jsxRuntime automatic */
/** @jsxImportSource @oai/artifact-tool/presentation-jsx */

import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  drawSlideToCtx,
  row,
  column,
  grid,
  layers,
  panel,
  text,
  shape,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  grow,
  fr,
} from "@oai/artifact-tool";
import { Canvas, loadImage } from "../node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.js";

const W = 1920;
const H = 1080;
const OUT = path.resolve("output/output.pptx");

mkdirSync("output", { recursive: true });
mkdirSync("scratch/previews", { recursive: true });

const c = {
  bg: "#F6F1E8",
  ink: "#101827",
  muted: "#5C6675",
  line: "#DED4C3",
  white: "#FFFFFF",
  blue: "#1863DC",
  cyan: "#10A6C7",
  green: "#15966A",
  orange: "#E76A2E",
  purple: "#6457C8",
  red: "#B9403A",
  dark: "#0C1222",
  code: "#111827",
};

const font = "Aptos";
const display = "Aptos Display";
const mono = "Aptos Mono";

function txt(value, opts = {}) {
  return text(value, {
    name: opts.name,
    width: opts.width ?? fill,
    height: opts.height ?? hug,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    style: {
      fontFace: opts.mono ? mono : opts.display ? display : font,
      fontSize: opts.size ?? 24,
      bold: opts.bold ?? false,
      color: opts.color ?? c.ink,
      ...(opts.style || {}),
    },
  });
}

function bgSlide(deck, children, bg = c.bg) {
  const slide = deck.slides.add();
  slide.compose(
    layers({ width: fill, height: fill }, [
      shape({ width: fill, height: fill, fill: bg, line: { fill: bg, width: 0 } }),
      column({ name: "slide-content", width: fill, height: fill, padding: { x: 88, y: 66 }, gap: 38 }, children),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 }
  );
  return slide;
}

function titleBlock(kicker, title, subtitle, accent = c.blue) {
  return column({ name: "title-block", width: fill, height: hug, gap: 13 }, [
    row({ width: fill, height: hug, align: "center", gap: 14 }, [
      shape({ width: fixed(48), height: fixed(7), fill: accent, line: { fill: accent, width: 0 }, borderRadius: "rounded-full" }),
      txt(kicker, { width: wrap(760), size: 17, bold: true, color: accent }),
    ]),
    txt(title, { name: "slide-title", display: true, size: 54, bold: true, color: c.ink }),
    subtitle ? txt(subtitle, { name: "slide-subtitle", width: wrap(1320), size: 25, color: c.muted }) : spacer(1, 1),
  ]);
}

function spacer(w = 1, h = 1) {
  return shape({ width: fixed(w), height: fixed(h), fill: "transparent", line: { width: 0, fill: "transparent" } });
}

function pill(label, color, width = 124) {
  return panel(
    {
      width: fixed(width),
      height: fixed(50),
      padding: { x: 18, y: 11 },
      align: "center",
      justify: "center",
      fill: color,
      line: { fill: color, width: 0 },
      borderRadius: "rounded-full",
    },
    txt(label, { width: fixed(width), size: 18, bold: true, color: c.white })
  );
}

function card(title, body, accent = c.blue, opts = {}) {
  return panel(
    {
      width: opts.width ?? fill,
      height: opts.height ?? fill,
      padding: { x: opts.compact ? 22 : 28, y: opts.compact ? 20 : 26 },
      fill: opts.fill ?? c.white,
      line: { fill: opts.line ?? c.line, width: 1 },
      borderRadius: "rounded-lg",
    },
    column({ name: `card-${String(title).replace(/[^a-z0-9]+/gi, "-").slice(0, 24)}`, width: fill, height: fill, gap: opts.compact ? 8 : 12 }, [
      shape({ width: fixed(46), height: fixed(6), fill: accent, line: { fill: accent, width: 0 }, borderRadius: "rounded-full" }),
      txt(title, { size: opts.compact ? 20 : 24, bold: true, color: c.ink }),
      txt(body, { size: opts.compact ? 17 : 19, color: c.muted }),
    ])
  );
}

function darkCode(lines, title = "MCP message") {
  return panel(
    { width: fill, height: fill, padding: { x: 30, y: 26 }, fill: c.dark, line: { fill: c.dark, width: 0 }, borderRadius: "rounded-lg" },
    column({ name: `code-${title.replace(/[^a-z0-9]+/gi, "-").slice(0, 24)}`, width: fill, height: fill, gap: 14 }, [
      txt(title, { size: 19, bold: true, color: "#9BD4FF" }),
      ...lines.map((line) => txt(line, { mono: true, size: 20, color: line.startsWith("//") ? "#93A4BA" : "#E5E7EB" })),
    ])
  );
}

function numbered(n, title, body, accent) {
  return row({ width: fill, height: hug, gap: 20, align: "start" }, [
    panel(
      { width: fixed(54), height: fixed(54), padding: 0, align: "center", justify: "center", fill: accent, line: { fill: accent, width: 0 }, borderRadius: "rounded-full" },
      txt(String(n), { width: fixed(54), size: 21, bold: true, color: c.white })
    ),
    column({ name: `step-${n}`, width: fill, height: hug, gap: 5 }, [
      txt(title, { size: 25, bold: true }),
      txt(body, { size: 20, color: c.muted }),
    ]),
  ]);
}

function endpointRow(method, pathLabel, meaning, color) {
  return row({ width: fill, height: fixed(64), gap: 16, align: "center" }, [
    pill(method, color, 88),
    txt(pathLabel, { mono: true, size: 22, width: fixed(520), color: c.code }),
    txt(meaning, { size: 21, color: c.muted }),
  ]);
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1. Cover
{
  const slide = deck.slides.add();
  slide.compose(
    layers({ width: fill, height: fill }, [
      shape({ width: fill, height: fill, fill: c.dark, line: { fill: c.dark, width: 0 } }),
      shape({ width: fixed(1040), height: fixed(1080), fill: c.bg, line: { fill: c.bg, width: 0 } }),
      column({ name: "cover-content", width: fill, height: fill, padding: { x: 90, y: 70 }, gap: 36 }, [
        row({ width: fill, height: hug, justify: "between", align: "center" }, [
          txt("Parte II · arquitectura tecnica", { width: fixed(520), size: 19, bold: true, color: c.blue }),
          row({ width: hug, height: hug, gap: 12 }, [pill("MCP", c.blue, 110), pill("Tools", c.green, 120), pill("NEO", c.orange, 110)]),
        ]),
        column({ name: "cover-title-stack", width: fill, height: grow(1), justify: "center", gap: 28 }, [
          txt("Como el agente opera el ERP", { display: true, width: fixed(880), size: 67, bold: true, color: c.ink }),
          txt("via MCP tools", { display: true, width: fixed(760), size: 54, bold: true, color: c.ink }),
          rule({ width: fixed(250), stroke: c.blue, weight: 6 }),
          txt("MCP no es un chat. Es un protocolo para publicar capacidades ejecutables con schemas, permisos, resultados estructurados y control humano.", {
            width: fixed(900),
            size: 28,
            color: c.muted,
          }),
        ]),
        row({ width: fill, height: hug, gap: 18, align: "center" }, [
          txt("tools/list", { mono: true, width: fixed(230), size: 23, bold: true, color: c.blue }),
          txt("->", { width: fixed(42), size: 24, bold: true, color: c.muted }),
          txt("tools/call", { mono: true, width: fixed(220), size: 23, bold: true, color: c.green }),
          txt("->", { width: fixed(42), size: 24, bold: true, color: c.muted }),
          txt("NEO Headless", { width: fixed(270), size: 23, bold: true, color: c.orange }),
        ]),
      ]),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 }
  );
}

// 2. MCP protocol model
bgSlide(deck, [
  titleBlock("MCP", "El protocolo estandariza como un agente usa capacidades externas", "MCP define una conversacion JSON-RPC entre cliente y servidor: negociar capacidades, listar lo disponible y ejecutar tools con argumentos validados."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1)], columnGap: 24 }, [
    card("Resources", "Datos y contexto que el servidor expone para que el modelo los lea o los use como referencia.", c.blue),
    card("Prompts", "Plantillas y workflows reutilizables que guian tareas frecuentes.", c.purple),
    card("Tools", "Funciones ejecutables. El modelo decide invocarlas, el cliente pide aprobacion si corresponde y el servidor ejecuta.", c.green),
  ]),
  panel(
    { width: fill, height: fixed(100), padding: { x: 28, y: 22 }, fill: "#EEF6FF", line: { fill: "#C8DDF7", width: 1 }, borderRadius: "rounded-lg" },
    txt("Para Etendo, la pieza critica son las tools: convierten intenciones del agente en llamadas ERP con contrato, auth y respuesta estructurada.", {
      size: 26,
      bold: true,
      color: "#174EA6",
    })
  ),
]);

// 3. Agent runtime loop
bgSlide(deck, [
  titleBlock("LOOP", "El agente no llama endpoints: razona sobre tools", "La potencia aparece cuando el modelo puede encadenar tools pequenas y tipadas hasta resolver una tarea de negocio."),
  grid({ width: fill, height: grow(1), columns: [fr(0.9), fr(1.1)], columnGap: 42 }, [
    column({ name: "loop-steps", width: fill, height: fill, gap: 21 }, [
      numbered(1, "Interpretar objetivo", "El usuario pide un resultado de negocio: revisar stock, crear compra, confirmar pedido.", c.blue),
      numbered(2, "Descubrir capacidades", "El cliente consulta tools/list y recibe nombres, descripciones y JSON schemas.", c.green),
      numbered(3, "Elegir herramienta", "El modelo arma argumentos segun el schema; el cliente puede pedir confirmacion.", c.orange),
      numbered(4, "Ejecutar y observar", "tools/call devuelve contenido estructurado; el agente decide el siguiente paso.", c.purple),
    ]),
    darkCode(
      [
        '{ "method": "tools/list" }',
        "",
        '{ "method": "tools/call",',
        '  "params": {',
        '    "name": "erp.query_records",',
        '    "arguments": {',
        '      "spec": "sales-order",',
        '      "entity": "header",',
        '      "filter": { "documentStatus": "DR" }',
        "    }",
        "  }",
        "}",
      ],
      "Patron MCP"
    ),
  ]),
]);

// 4. Etendo topology
bgSlide(deck, [
  titleBlock("TOPOLOGIA", "En Etendo, MCP es una fachada agentica sobre NEO Headless", "La URL publica se mantiene simple; por debajo, el servidor MCP traduce tools en operaciones NEO."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1), fr(1)], columnGap: 18 }, [
    card("MCP client", "Claude Desktop, IDE o agente compatible. Maneja conversacion, tool choice y UX de aprobacion.", c.blue, { compact: true }),
    card("MCP endpoint", "/mcp en dev/prod. En prod CloudFront reescribe al contexto Tomcat real.", c.cyan, { compact: true }),
    card("OAuth2 layer", "Discovery, registro, authorization code, client credentials, refresh y scopes.", c.green, { compact: true }),
    card("NEO Headless", "NeoServlet, ETGO_SF_*, RBAC, selectors, processes, reports y NeoHandler.", c.orange, { compact: true }),
  ]),
  panel(
    { width: fill, height: fixed(200), padding: { x: 30, y: 24 }, fill: c.white, line: { fill: c.line, width: 1 }, borderRadius: "rounded-lg" },
    column({ name: "topology-endpoints", width: fill, height: fill, gap: 14 }, [
      endpointRow("MCP", "/mcp", "entrada del agente", c.blue),
      endpointRow("NEO", "/sws/neo/{spec}/{entity}", "operacion real sobre ERP", c.orange),
    ])
  ),
]);

// 5. Authorization and scopes
bgSlide(deck, [
  titleBlock("AUTH", "Las tools heredan permisos, no privilegios magicos", "El agente solo puede hacer lo que el token, los scopes, el rol de Etendo y la configuracion NEO permiten."),
  grid({ width: fill, height: grow(1), columns: [fr(1.05), fr(0.95)], columnGap: 42 }, [
    column({ name: "auth-steps", width: fill, height: fill, gap: 19 }, [
      numbered(1, "Discovery", "El cliente lee metadata protegida y authorization server desde /.well-known/*.", c.blue),
      numbered(2, "Consentimiento", "El usuario aprueba scopes en /authorize o se usa client credentials para integraciones.", c.green),
      numbered(3, "Bearer en cada request", "El token viaja en Authorization header en cada llamada HTTP al servidor MCP.", c.orange),
      numbered(4, "Enforcement", "MCP valida scope; NEO valida metodo, spec, entidad, AD role y reglas del handler.", c.purple),
    ]),
    panel(
      { width: fill, height: fill, padding: { x: 30, y: 30 }, fill: "#111827", line: { fill: "#111827", width: 0 }, borderRadius: "rounded-lg" },
      column({ name: "scope-list", width: fill, height: fill, gap: 18 }, [
        txt("Scopes Etendo", { size: 28, bold: true, color: c.white }),
        txt("neo:read", { mono: true, size: 30, color: "#9BD4FF" }),
        txt("consultar entidades y selectores", { size: 22, color: "#D1D5DB" }),
        txt("neo:write", { mono: true, size: 30, color: "#A7F3D0" }),
        txt("crear, actualizar o borrar registros", { size: 22, color: "#D1D5DB" }),
        txt("neo:process / neo:report", { mono: true, size: 30, color: "#FDBA74" }),
        txt("ejecutar procesos y generar reportes", { size: 22, color: "#D1D5DB" }),
      ])
    ),
  ]),
]);

// 6. Tool catalog
bgSlide(deck, [
  titleBlock("TOOL CATALOG", "El ERP se publica como un set compacto de tools tipadas", "En vez de crear una integracion por pantalla, MCP publica familias de tools que operan sobre specs, entidades, acciones y reportes."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1), fr(1)], columnGap: 18, rowGap: 18 }, [
    card("erp.list_specs", "Descubre ventanas, procesos y reportes disponibles para el usuario.", c.blue, { compact: true }),
    card("erp.describe_spec", "Devuelve entidades, campos, filtros, actions, selectors y constraints.", c.cyan, { compact: true }),
    card("erp.query_records", "Lista registros con filtros, paginacion, sorting y parentId.", c.green, { compact: true }),
    card("erp.get_record", "Lee un registro puntual con identificadores y campos resueltos.", c.green, { compact: true }),
    card("erp.create_record", "Crea cabeceras o lineas respetando campos incluidos y readonly.", c.orange, { compact: true }),
    card("erp.update_record", "PATCH/PUT parcial o completo, con validacion de metodo y RBAC.", c.orange, { compact: true }),
    card("erp.call_action", "Ejecuta botones/procesos de una entidad: confirmar, registrar pago, copiar, generar.", c.purple, { compact: true }),
    card("erp.generate_report", "Invoca specs de reporte y devuelve resultado o referencia descargable.", c.red, { compact: true }),
  ]),
]);

// 7. How read tools use NEO
bgSlide(deck, [
  titleBlock("READ PATH", "Una query del agente se convierte en GET NEO", "El modelo no necesita saber SQL ni IDs internos: usa spec, entity y filtros de negocio; NEO resuelve AD metadata y permisos."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1)], columnGap: 42 }, [
    darkCode(
      [
        "tool: erp.query_records",
        "{",
        '  "spec": "sales-order",',
        '  "entity": "header",',
        '  "filter": {',
        '    "businessPartner": "Cliente A",',
        '    "documentStatus": "DR"',
        "  },",
        '  "limit": 20',
        "}",
      ],
      "Input del agente"
    ),
    column({ name: "read-path-endpoints", width: fill, height: fill, gap: 20 }, [
      endpointRow("GET", "/sws/neo/sales-order/header", "lista filtrada", c.green),
      endpointRow("GET", "/selectors/{field}", "valores validos", c.cyan),
      endpointRow("GET", "/defaults", "defaults para crear", c.blue),
      card("Resultado estructurado", "El servidor devuelve filas, identificadores, labels, errores normalizados y metadata para que el agente pueda seguir razonando.", c.orange, { height: fixed(210) }),
    ]),
  ]),
]);

// 8. How write/action tools use NEO
bgSlide(deck, [
  titleBlock("WRITE PATH", "Las acciones cambian estado solo por rutas controladas", "Cada tool de escritura pasa por scopes, flags HTTP, validaciones NEO, transaccion ERP y posibles NeoHandlers."),
  grid({ width: fill, height: grow(1), columns: [fr(1.05), fr(0.95)], columnGap: 42 }, [
    column({ name: "write-path-endpoints", width: fill, height: fill, gap: 18 }, [
      endpointRow("POST", "/{spec}/{entity}", "crear documento o linea", c.orange),
      endpointRow("PATCH", "/{spec}/{entity}/{id}", "actualizar campos permitidos", c.orange),
      endpointRow("POST", "/{spec}/{entity}/{id}/action/{field}", "ejecutar proceso/boton", c.purple),
      endpointRow("POST", "/{report}/generateReport", "generar salida de reporte", c.red),
      panel(
        { width: fill, height: fixed(130), padding: { x: 26, y: 22 }, fill: "#FFF7ED", line: { fill: "#FED7AA", width: 1 }, borderRadius: "rounded-lg" },
        txt("La confirmacion humana debe estar antes de tools con efectos: crear, actualizar, borrar, ejecutar procesos o enviar reportes.", {
          size: 24,
          bold: true,
          color: "#9A3412",
        })
      ),
    ]),
    darkCode(
      [
        "tool: erp.call_action",
        "{",
        '  "spec": "sales-order",',
        '  "entity": "header",',
        '  "id": "A7F...",',
        '  "action": "documentAction",',
        '  "params": { "value": "CO" }',
        "}",
        "",
        "// NEO: RBAC + handler + process",
      ],
      "Confirmar documento"
    ),
  ]),
]);

// 9. Tool schemas and quality
bgSlide(deck, [
  titleBlock("SCHEMAS", "La calidad de una tool esta en su contrato", "Para que el agente use bien el ERP, cada tool necesita nombre claro, descripcion operacional, schema estricto y errores accionables."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1)], columnGap: 42 }, [
    darkCode(
      [
        "{",
        '  "name": "erp.create_record",',
        '  "description": "Create one ERP record",',
        '  "inputSchema": {',
        '    "spec": "string",',
        '    "entity": "string",',
        '    "data": "object"',
        "  }",
        "}",
      ],
      "Tool definition"
    ),
    column({ name: "schema-quality-list", width: fill, height: fill, gap: 18 }, [
      card("Descripciones concretas", "Decir cuando usarla, cuando no, efectos laterales y scopes requeridos.", c.blue, { height: fixed(190) }),
      card("Schemas cerrados", "Campos requeridos, enums, limites y tipos evitan payloads ambiguos.", c.green, { height: fixed(190) }),
      card("Errores que guian", "Devolver missing_field, forbidden_scope, validation_error o process_failed con detalle util.", c.orange, { height: fixed(190) }),
    ]),
  ]),
]);

// 10. Composite example
bgSlide(deck, [
  titleBlock("COMPOSICION", "La potencia es encadenar tools en un workflow de negocio", "Un agente puede resolver un objetivo completo sin que cada paso sea programado como una integracion nueva."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1)], columnGap: 24, rowGap: 22 }, [
    card("1. Entender pedido", "Usuario: revisa pedidos draft con riesgo de stock y preparame una compra sugerida.", c.blue, { compact: true }),
    card("2. Leer contexto", "erp.query_records consulta pedidos, lineas, productos, stock y proveedores.", c.green, { compact: true }),
    card("3. Resolver datos", "erp.describe_spec y selectors validan campos, valores y relaciones permitidas.", c.cyan, { compact: true }),
    card("4. Proponer plan", "El agente explica faltantes, impacto y documentos que va a crear.", c.purple, { compact: true }),
    card("5. Ejecutar", "erp.create_record crea compra y lineas; erp.call_action confirma si el usuario aprueba.", c.orange, { compact: true }),
    card("6. Cerrar", "erp.generate_report entrega PDF o resumen, con auditoria de tools usadas.", c.red, { compact: true }),
  ]),
]);

// 11. Guardrails
bgSlide(deck, [
  titleBlock("GUARDRAILS", "MCP hace posible operar; NEO mantiene el gobierno ERP", "El diseno correcto separa decision del agente, autorizacion del usuario y ejecucion transaccional del ERP."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1)], columnGap: 24 }, [
    card("Least privilege", "Scopes por capability, usuario/rol real de Etendo, specs publicadas por contrato y no por tabla cruda.", c.green),
    card("Human-in-the-loop", "Confirmacion explicita antes de efectos irreversibles o procesos sensibles.", c.orange),
    card("Auditabilidad", "Registrar tool, argumentos relevantes, scope, usuario, entidad, resultado y errores.", c.blue),
  ]),
  panel(
    { width: fill, height: fixed(120), padding: { x: 30, y: 24 }, fill: "#EEF6FF", line: { fill: "#C8DDF7", width: 1 }, borderRadius: "rounded-lg" },
    txt("Mensaje tecnico: MCP es el plano de invocacion; NEO Headless es el plano de ejecucion y gobierno del ERP.", {
      size: 28,
      bold: true,
      color: "#174EA6",
    })
  ),
]);

// 12. Sources / implementation notes
bgSlide(deck, [
  titleBlock("REFERENCIAS", "Fuentes usadas para esta parte tecnica", "La presentacion combina el protocolo MCP actual con la implementacion documentada en Schema Forge / Etendo Go."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1)], columnGap: 34 }, [
    column({ name: "source-left", width: fill, height: fill, gap: 18 }, [
      card("MCP Specification", "Base Protocol, lifecycle, server features: Resources, Prompts, Tools; client features y utilities.", c.blue, { height: fixed(220) }),
      card("MCP Authorization", "OAuth 2.1, RFC 9728 Protected Resource Metadata, RFC 8414 Authorization Server Metadata, DCR y Bearer tokens.", c.green, { height: fixed(240) }),
    ]),
    column({ name: "source-right", width: fill, height: fill, gap: 18 }, [
      card("Schema Forge docs", "docs/ops/cloudfront-alb-routing.md para /mcp, /.well-known, /authorize, /oauth2/* y rewrites.", c.orange, { height: fixed(220) }),
      card("NEO Headless docs", "docs/architecture-overview.md y docs/neo-headless-extensibility.md para ETGO_SF_*, NeoServlet, selectors, processes, reports y NeoHandler.", c.purple, { height: fixed(240) }),
    ]),
  ]),
]);

const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(OUT);

for (const [index, slide] of deck.slides.items.entries()) {
  const canvas = new Canvas(W, H);
  const ctx = canvas.getContext("2d");
  await drawSlideToCtx(slide, deck, ctx, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
    clearBeforeDraw: true,
  });
  await canvas.toFile(path.resolve(`scratch/previews/slide-${String(index + 1).padStart(2, "0")}.png`));
}

const cols = 4;
const rows = 3;
const thumbW = 480;
const thumbH = 270;
const gap = 24;
const montage = new Canvas(cols * thumbW + (cols + 1) * gap, rows * thumbH + (rows + 1) * gap);
const mctx = montage.getContext("2d");
mctx.fillStyle = "#F1ECE3";
mctx.fillRect(0, 0, montage.width, montage.height);
for (let i = 1; i <= deck.slides.items.length; i += 1) {
  const img = await loadImage(`scratch/previews/slide-${String(i).padStart(2, "0")}.png`);
  const col = (i - 1) % cols;
  const rowNo = Math.floor((i - 1) / cols);
  const x = gap + col * (thumbW + gap);
  const y = gap + rowNo * (thumbH + gap);
  mctx.drawImage(img, x, y, thumbW, thumbH);
  mctx.fillStyle = "#111827";
  mctx.font = "20px Aptos";
  mctx.fillText(String(i), x + 10, y + 28);
}
await montage.toFile("scratch/previews/montage.png");

console.log(OUT);
