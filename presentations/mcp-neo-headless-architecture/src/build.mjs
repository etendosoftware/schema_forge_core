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
import { Canvas } from "../node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.js";

const W = 1920;
const H = 1080;

const OUT = path.resolve("output/output.pptx");
mkdirSync("output", { recursive: true });
mkdirSync("scratch/previews", { recursive: true });

const c = {
  ink: "#111827",
  muted: "#5B6472",
  faint: "#E8E2D5",
  paper: "#F8F4EA",
  white: "#FFFFFF",
  blue: "#1863DC",
  cyan: "#11A7C8",
  green: "#1C9B66",
  orange: "#E56B2F",
  purple: "#6D5BD0",
  red: "#C2413A",
  black: "#0B1020",
};

const titleStyle = { fontFace: "Aptos Display", fontSize: 58, bold: true, color: c.ink };
const subtitleStyle = { fontFace: "Aptos", fontSize: 28, color: c.muted };
const bodyStyle = { fontFace: "Aptos", fontSize: 25, color: c.ink };
const labelStyle = { fontFace: "Aptos", fontSize: 18, color: c.muted, bold: true };
const monoStyle = { fontFace: "Aptos Mono", fontSize: 24, color: c.ink };

function txt(value, opts = {}) {
  return text(value, {
    width: opts.width ?? fill,
    height: opts.height ?? hug,
    name: opts.name,
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    style: { ...bodyStyle, ...(opts.style || {}) },
  });
}

function sectionTitle(kicker, title, subtitle, accent = c.blue) {
  return column({ name: "title-stack", width: fill, height: hug, gap: 16 }, [
    row({ width: fill, height: hug, gap: 14, align: "center" }, [
      shape({ width: fixed(52), height: fixed(8), fill: accent, line: { fill: accent, width: 0 }, borderRadius: "rounded-full" }),
      txt(kicker, { width: wrap(900), style: { ...labelStyle, color: accent, fontSize: 18 } }),
    ]),
    txt(title, { name: "slide-title", style: titleStyle }),
    subtitle
      ? txt(subtitle, { name: "slide-subtitle", width: wrap(1280), style: subtitleStyle })
      : shape({ width: fixed(1), height: fixed(1), fill: "transparent", line: { width: 0, fill: "transparent" } }),
  ]);
}

function chip(label, color) {
  return panel(
    {
      width: fixed(112),
      height: fixed(54),
      padding: { x: 20, y: 12 },
      fill: color,
      line: { fill: color, width: 0 },
      borderRadius: "rounded-full",
    },
    txt(label, { width: fixed(112), style: { fontSize: 18, bold: true, color: c.white } })
  );
}

function card(title, body, accent = c.blue, options = {}) {
  return panel(
    {
      name: options.name,
      width: options.width ?? fill,
      height: options.height ?? fill,
      padding: { x: 30, y: 28 },
      fill: c.white,
      line: { fill: "#E2D9C8", width: 1 },
      borderRadius: "rounded-lg",
    },
    column({ width: fill, height: fill, gap: 12 }, [
      shape({ width: fixed(50), height: fixed(7), fill: accent, line: { fill: accent, width: 0 }, borderRadius: "rounded-full" }),
      txt(title, { style: { fontSize: options.compact ? 23 : 26, bold: true, color: c.ink } }),
      txt(body, { style: { fontSize: options.compact ? 19 : 21, color: c.muted } }),
    ])
  );
}

function step(num, title, body, accent) {
  return row({ width: fill, height: hug, gap: 22, align: "start" }, [
    panel(
      {
        width: fixed(64),
        height: fixed(64),
        padding: 0,
        align: "center",
        justify: "center",
        fill: accent,
        line: { fill: accent, width: 0 },
        borderRadius: "rounded-full",
      },
      txt(String(num), { width: fixed(64), style: { fontSize: 23, bold: true, color: c.white } })
    ),
    column({ width: fill, height: hug, gap: 8 }, [
      txt(title, { style: { fontSize: 27, bold: true, color: c.ink } }),
      txt(body, { style: { fontSize: 22, color: c.muted } }),
    ]),
  ]);
}

function slideRoot(presentation, children, bg = c.paper) {
  const slide = presentation.slides.add();
  slide.compose(
    layers({ name: "root", width: fill, height: fill }, [
      shape({ name: "background", width: fill, height: fill, fill: bg, line: { fill: bg, width: 0 } }),
      column({ name: "content", width: fill, height: fill, padding: { x: 92, y: 72 }, gap: 46 }, children),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 }
  );
  return slide;
}

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1. Cover
{
  const slide = deck.slides.add();
  slide.compose(
    layers({ width: fill, height: fill }, [
      shape({ width: fill, height: fill, fill: c.black, line: { fill: c.black, width: 0 } }),
      shape({ width: fixed(980), height: fixed(1080), fill: "#F8F4EA", line: { width: 0, fill: "#F8F4EA" } }),
      column({ width: fill, height: fill, padding: { x: 98, y: 76 }, gap: 42 }, [
        row({ width: fill, height: hug, align: "center", justify: "between" }, [
          txt("Arquitectura MCP", { width: fixed(360), style: { ...labelStyle, color: c.blue, fontSize: 20 } }),
          row({ width: hug, height: hug, gap: 10 }, [chip("MCP", c.blue), chip("OAuth2", c.green), chip("NEO", c.orange)]),
        ]),
        column({ width: fill, height: grow(1), justify: "center", gap: 32 }, [
          txt("ERP agentico", { width: fixed(780), style: { fontFace: "Aptos Display", fontSize: 72, bold: true, color: c.ink } }),
          txt("MCP sobre NEO Headless", {
            width: fixed(820),
            style: { fontFace: "Aptos Display", fontSize: 48, bold: true, color: c.ink },
          }),
          rule({ width: fixed(260), stroke: c.blue, weight: 6 }),
          txt("El agente no entra por atras del ERP: entra por un contrato seguro, descubrible y gobernado por la misma configuracion de NEO.", {
            width: wrap(920),
            style: { fontSize: 29, color: c.muted },
          }),
        ]),
        row({ width: fill, height: hug, gap: 24, align: "center" }, [
          txt("/mcp", { width: fixed(160), style: { ...monoStyle, color: c.blue, bold: true } }),
          txt("->", { width: fixed(48), style: { fontSize: 28, color: c.muted, bold: true } }),
          txt("/oauth2", { width: fixed(180), style: { ...monoStyle, color: c.green, bold: true } }),
          txt("->", { width: fixed(48), style: { fontSize: 28, color: c.muted, bold: true } }),
          txt("/sws/neo/*", { width: fixed(240), style: { ...monoStyle, color: c.orange, bold: true } }),
        ]),
      ]),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 }
  );
}

// 2. Why this is agentic
slideRoot(deck, [
  sectionTitle("TESIS", "El ERP se vuelve agentico cuando el modelo opera por contratos", "No alcanza con sumar un chat. El agente debe descubrir capacidades, autenticarse, pedir permisos y ejecutar acciones reales del ERP."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1)], columnGap: 26 }, [
    card("Descubrible", "El cliente MCP encuentra el recurso, el authorization server y los endpoints sin conocer el contexto Tomcat.", c.blue),
    card("Gobernado", "OAuth2, scopes y consentimiento hacen explicito que puede leer, escribir, correr procesos o generar reportes.", c.green),
    card("Ejecutable", "NEO Headless traduce la intencion del agente en operaciones de negocio contra entidades, procesos y reportes.", c.orange),
  ]),
  txt("Mensaje para demo: el agente no reemplaza las reglas del ERP; las usa como superficie de accion.", {
    style: { fontSize: 24, color: c.muted },
  }),
]);

// 3. End-to-end architecture
slideRoot(deck, [
  sectionTitle("MAPA", "De Claude al dato operativo, sin saltarse el ERP", "La arquitectura separa entrada agentica, autorizacion, runtime NEO y configuracion Schema Forge."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1), fr(1)], columnGap: 20 }, [
    card("1. MCP client", "Claude Desktop o cualquier cliente MCP usa una URL estable: /mcp.", c.blue),
    card("2. Edge / dev proxy", "CloudFront o Vite reescribe a la ruta real del backend sin exponer /etendo.", c.cyan),
    card("3. OAuth2", "Discovery, registro, consentimiento, tokens y scopes de acceso.", c.green),
    card("4. NEO Headless", "NeoServlet resuelve spec, entidad, permisos, hooks y servicios de datos.", c.orange),
  ]),
  row({ width: fill, height: hug, gap: 16, align: "center" }, [
    txt("Cliente", { width: fixed(170), style: { ...labelStyle, color: c.blue } }),
    rule({ width: grow(1), stroke: "#C9D0D9", weight: 3 }),
    txt("Edge", { width: fixed(120), style: { ...labelStyle, color: c.cyan } }),
    rule({ width: grow(1), stroke: "#C9D0D9", weight: 3 }),
    txt("Auth", { width: fixed(120), style: { ...labelStyle, color: c.green } }),
    rule({ width: grow(1), stroke: "#C9D0D9", weight: 3 }),
    txt("ERP", { width: fixed(100), style: { ...labelStyle, color: c.orange } }),
  ]),
]);

// 4. Discovery/Auth flow
slideRoot(deck, [
  sectionTitle("DISCOVERY", "El cliente ve URLs simples; la infraestructura resuelve el contexto", "La forma publica es root-level. El path interno de Tomcat queda como detalle de deploy."),
  grid({ width: fill, height: grow(1), columns: [fr(1.1), fr(0.9)], columnGap: 44 }, [
    column({ width: fill, height: fill, gap: 22 }, [
      step(1, "Protected Resource Metadata", "/.well-known/oauth-protected-resource anuncia resource = https://host/mcp", c.blue),
      step(2, "Authorization Server Metadata", "/.well-known/oauth-authorization-server publica /authorize, /oauth2/token y /oauth2/register", c.green),
      step(3, "Consentimiento humano", "/authorize es una ruta SPA donde el usuario aprueba scopes como neo:read, neo:write, neo:process y neo:report", c.orange),
      step(4, "Token usable por MCP", "El cliente vuelve a /mcp con Bearer token; NEO aplica permisos de Etendo y scopes.", c.purple),
    ]),
    panel(
      { width: fill, height: fill, padding: { x: 34, y: 30 }, fill: "#111827", line: { fill: "#111827", width: 0 }, borderRadius: "rounded-lg" },
      column({ width: fill, height: fill, gap: 20 }, [
        txt("URL publica", { style: { ...labelStyle, color: "#9BD4FF" } }),
        txt("https://go.etendo.cloud/mcp", { style: { ...monoStyle, color: c.white, fontSize: 30 } }),
        rule({ stroke: "#374151", weight: 2 }),
        txt("Ruta backend", { style: { ...labelStyle, color: "#FFD3A6" } }),
        txt("/etendo/sws/mcp", { style: { ...monoStyle, color: c.white, fontSize: 30 } }),
        rule({ stroke: "#374151", weight: 2 }),
        txt("La equivalencia se hace en CloudFront para prod y en Vite para dev.", { style: { fontSize: 25, color: "#D1D5DB" } }),
      ])
    ),
  ]),
]);

// 5. Runtime resolution
slideRoot(deck, [
  sectionTitle("RUNTIME", "NEO convierte llamadas MCP en operaciones de negocio", "MCP es la entrada agentica; NeoServlet es el router que protege y ejecuta."),
  grid({ width: fill, height: grow(1), columns: [fr(0.95), fr(1.05)], columnGap: 38 }, [
    column({ width: fill, height: fill, gap: 18 }, [
      step(1, "Autentica JWT / Bearer", "La llamada llega con token. Etendo reconstruye usuario, rol, organizacion y contexto.", c.green),
      step(2, "Resuelve spec y entidad", "La URL /sws/neo/{spec}/{entity} se cruza con ETGO_SF_SPEC y ETGO_SF_ENTITY.", c.blue),
      step(3, "Valida metodo y RBAC", "Flags GET/POST/PATCH/DELETE y permisos de ventana, proceso o reporte deciden si continua.", c.orange),
      step(4, "Ejecuta servicio o hook", "CRUD, selectors, defaults, callouts, procesos y reportes pasan por servicio generico o NeoHandler.", c.purple),
    ]),
    panel(
      { width: fill, height: fill, padding: { x: 34, y: 30 }, fill: c.white, line: { fill: "#E2D9C8", width: 1 }, borderRadius: "rounded-lg" },
      column({ width: fill, height: fill, gap: 18 }, [
        txt("Contrato vivo", { style: { fontSize: 30, bold: true, color: c.ink } }),
        grid({ width: fill, height: hug, columns: [fr(1), fr(1)], columnGap: 18, rowGap: 18 }, [
          card("ETGO_SF_SPEC", "Namespace funcional: sales-order, purchase-invoice, report-*.", c.blue, { height: fixed(166), compact: true }),
          card("ETGO_SF_ENTITY", "Tab, flags HTTP, Java_Qualifier y tipo de endpoint.", c.green, { height: fixed(166), compact: true }),
          card("ETGO_SF_FIELD", "Campos incluidos, readonly, defaults y referencias.", c.orange, { height: fixed(166), compact: true }),
          card("AD metadata", "Ventanas, tabs, columnas, procesos y reglas originales.", c.purple, { height: fixed(166), compact: true }),
        ]),
        txt("El runtime no necesita regenerarse para exponer un nuevo contrato: lee configuracion.", { style: { fontSize: 23, color: c.muted } }),
      ])
    ),
  ]),
]);

// 6. Schema Forge role
slideRoot(deck, [
  sectionTitle("CONFIGURACION", "Schema Forge decide que se expone; NEO decide como servirlo", "La parte agentica se apoya en una capa declarativa que ya entiende ventanas, procesos, reportes y campos."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1), fr(1)], columnGap: 18 }, [
    card("Extraer", "Menu cache y AD metadata producen schema-raw y rules-raw por ventana/proceso/reporte.", c.blue),
    card("Curar", "Humanos e IA deciden visibilidad, reglas mantenidas, simplificadas u omitidas.", c.purple),
    card("Contratar", "generate-contract transforma decisiones en un contrato frontend/backend verificable.", c.green),
    card("Publicar", "push-to-neo escribe ETGO_SF_*; la API queda disponible en NEO Headless.", c.orange),
  ]),
  panel(
    { width: fill, height: fixed(112), padding: { x: 28, y: 22 }, fill: "#FFF7ED", line: { fill: "#FED7AA", width: 1 }, borderRadius: "rounded-lg" },
    txt("Idea clave: el agente hereda el recorte funcional de Schema Forge. No ve la totalidad del ERP; ve lo que el contrato permite.", {
      style: { fontSize: 27, bold: true, color: "#9A3412" },
    })
  ),
]);

// 7. Extension and safety
slideRoot(deck, [
  sectionTitle("CONTROL", "La personalizacion vive en NeoHandler, no en servicios genericos", "Esto evita que un caso de negocio contamine NeoServlet, NeoCrudHandler, NeoSelectorService o NeoDefaultsService."),
  grid({ width: fill, height: grow(1), columns: [fr(0.9), fr(1.1)], columnGap: 44 }, [
    column({ width: fill, height: fill, gap: 22 }, [
      card("Configuracion primero", "Field visibility, readonly, method flags, defaults y selector filtering cubren el caso base sin Java.", c.green, { height: fixed(210) }),
      card("Hook cuando hace falta", "Un CDI bean @Named recibe NeoContext, puede interceptar antes o despues del servicio default.", c.blue, { height: fixed(230) }),
      card("Trazabilidad tecnica", "La entidad guarda Java_Qualifier; la extension queda declarada y localizable.", c.orange, { height: fixed(190) }),
    ]),
    panel(
      { width: fill, height: fill, padding: { x: 36, y: 34 }, fill: "#111827", line: { fill: "#111827", width: 0 }, borderRadius: "rounded-lg" },
      column({ width: fill, height: fill, gap: 18 }, [
        txt("NeoHandler flow", { style: { fontSize: 32, bold: true, color: c.white } }),
        txt("handle(context)", { style: { ...monoStyle, color: "#9BD4FF", fontSize: 29 } }),
        txt("  returns response? -> skip default", { style: { ...monoStyle, color: "#D1D5DB", fontSize: 24 } }),
        txt("  returns null?     -> run default", { style: { ...monoStyle, color: "#D1D5DB", fontSize: 24 } }),
        rule({ stroke: "#374151", weight: 2 }),
        txt("afterHandle(context)", { style: { ...monoStyle, color: "#A7F3D0", fontSize: 29 } }),
        txt("  enrich, filter or replace result", { style: { ...monoStyle, color: "#D1D5DB", fontSize: 24 } }),
        rule({ stroke: "#374151", weight: 2 }),
        txt("Una sola extension puede discriminar CRUD, SELECTOR, DEFAULTS, CALLOUT, ACTION o REPORT.", { style: { fontSize: 24, color: "#E5E7EB" } }),
      ])
    ),
  ]),
]);

// 8. Demo story
slideRoot(deck, [
  sectionTitle("COMO MOSTRARLO", "La demo debe probar accion, no solo conversacion", "El recorrido ideal muestra discovery, permisos, consulta, propuesta, ejecucion y auditoria."),
  grid({ width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1)], columnGap: 24, rowGap: 24 }, [
    card("1. Conectar agente", "Pegar /mcp. El cliente descubre OAuth2 y abre /authorize.", c.blue),
    card("2. Aprobar scopes", "Mostrar permisos: lectura, escritura, procesos y reportes segun el caso.", c.green),
    card("3. Preguntar negocio", "Ejemplo: pedidos con riesgo por stock insuficiente.", c.purple),
    card("4. Ejecutar via NEO", "El agente consulta entidades, selectors o procesos expuestos por el contrato.", c.orange),
    card("5. Proponer accion", "Crear compra sugerida, reservar stock o disparar proceso con aprobacion humana.", c.cyan),
    card("6. Cerrar con control", "Mostrar registro, usuario, rol, scope, endpoint y resultado.", c.red),
  ]),
  txt("Frase de cierre: MCP hace que el ERP sea invocable por agentes; NEO Headless asegura que esa invocacion siga siendo ERP.", {
    style: { fontSize: 28, bold: true, color: c.ink },
  }),
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

console.log(OUT);
