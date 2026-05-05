import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Presentation,
  PresentationFile,
  row,
  column,
  grid,
  panel,
  text,
  image,
  shape,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  grow,
  fr,
  auto,
} from '@oai/artifact-tool';

const ROOT = '/Users/sebastianbarrozo/Documents/work/epic/schema-forge';
const OUT = path.resolve('output/output.pptx');
const PREVIEWS = path.resolve('scratch/previews');
const LAYOUTS = path.resolve('scratch/layouts');
const LOGO = path.join(ROOT, 'tools/app-shell/public/logo-etendo.png');
const FAVICON = path.join(ROOT, 'tools/app-shell/public/favicon.png');
const DASHBOARD = path.join(ROOT, 'tools/app-shell/public/auth-dashboard-preview.png');

const W = 1920;
const H = 1080;

const C = {
  page: '#F5F7F9',
  white: '#FFFFFF',
  ink: '#121217',
  secondary: '#6C6C89',
  breadcrumb: '#555B6D',
  icon: '#828FA3',
  search: '#E8EAEF',
  border: '#E8EAEF',
  yellow: '#FFD500',
  blue: '#2563EB',
  greenBg: '#EEFBF4',
  green: '#17663A',
  warnBg: '#FFF9EB',
  warn: '#8A6100',
  roseBg: '#FEF0F4',
  rose: '#D50B3E',
  neutralBg: '#F5F7F9',
  neutral: '#3F3F50',
};

const FONT = 'Inter';

const S = {
  h1: { typeface: FONT, fontSize: 68, bold: true, color: C.ink, wrap: 'square' },
  h2: { typeface: FONT, fontSize: 52, bold: true, color: C.ink, wrap: 'square' },
  sub: { typeface: FONT, fontSize: 27, color: C.secondary, wrap: 'square', lineSpacing: 1.14 },
  body: { typeface: FONT, fontSize: 27, color: C.ink, wrap: 'square', lineSpacing: 1.15 },
  bodyMuted: { typeface: FONT, fontSize: 24, color: C.secondary, wrap: 'square', lineSpacing: 1.16 },
  label: { typeface: FONT, fontSize: 16, bold: true, color: C.secondary, wrap: 'none' },
  small: { typeface: FONT, fontSize: 16, color: C.secondary, wrap: 'square' },
  mono: { typeface: 'SF Mono', fontSize: 24, color: C.ink, wrap: 'square', lineSpacing: 1.18 },
  metric: { typeface: FONT, fontSize: 54, bold: true, color: C.ink, wrap: 'none' },
};

function tx(value, options = {}) {
  return text(value, {
    width: options.width ?? fill,
    height: options.height ?? hug,
    name: options.name,
    columnSpan: options.columnSpan,
    rowSpan: options.rowSpan,
    style: {
      typeface: FONT,
      ...options.style,
    },
  });
}

function pill(label, opts = {}) {
  return panel(
    {
      name: opts.name,
      width: opts.width ?? hug,
      height: hug,
      padding: { x: opts.x ?? 18, y: opts.y ?? 9 },
      fill: opts.fill ?? C.search,
      line: { style: 'solid', width: 1, fill: opts.line ?? 'transparent' },
      borderRadius: 'rounded-full',
      align: 'center',
      justify: 'center',
    },
    tx(label, {
      name: `${opts.name || 'pill'}-text`,
      width: opts.textWidth ?? hug,
      style: { ...S.label, color: opts.color ?? C.breadcrumb },
    }),
  );
}

function bullet(textValue, opts = {}) {
  return row(
    { name: opts.name, width: fill, height: hug, gap: 16, align: 'start' },
    [
      shape({
        name: `${opts.name || 'bullet'}-dot`,
        geometry: 'ellipse',
        width: fixed(10),
        height: fixed(10),
        fill: opts.color ?? C.yellow,
        line: { style: 'solid', width: 0, fill: opts.color ?? C.yellow },
      }),
      tx(textValue, {
        name: `${opts.name || 'bullet'}-text`,
        width: fill,
        style: opts.style ?? S.bodyMuted,
      }),
    ],
  );
}

function metric(value, label, opts = {}) {
  return column(
    { name: opts.name, width: fill, height: hug, gap: 8 },
    [
      tx(value, {
        name: `${opts.name}-value`,
        width: fill,
        style: { ...S.metric, color: opts.color ?? C.ink },
      }),
      tx(label, {
        name: `${opts.name}-label`,
        width: fill,
        style: { ...S.small, color: C.secondary },
      }),
    ],
  );
}

function step(label, detail, opts = {}) {
  return row(
    { name: opts.name, width: fill, height: hug, gap: 18, align: 'start' },
    [
      panel(
        {
          name: `${opts.name}-badge`,
          width: fixed(44),
          height: fixed(44),
          fill: opts.fill ?? C.yellow,
          borderRadius: 'rounded-full',
          align: 'center',
          justify: 'center',
        },
        tx(String(opts.index ?? ''), {
          name: `${opts.name}-badge-text`,
          width: fill,
          style: { typeface: FONT, fontSize: 18, bold: true, color: C.ink, alignment: 'center', wrap: 'none' },
        }),
      ),
      column(
        { name: `${opts.name}-copy`, width: fill, height: hug, gap: 4 },
        [
          tx(label, {
            name: `${opts.name}-label`,
            width: fill,
            style: { typeface: FONT, fontSize: 25, bold: true, color: C.ink, wrap: 'square' },
          }),
          tx(detail, {
            name: `${opts.name}-detail`,
            width: fill,
            style: { ...S.small, color: C.secondary },
          }),
        ],
      ),
    ],
  );
}

function leftRail(slideNo, section) {
  return panel(
    {
      name: `left-rail-${slideNo}`,
      width: fill,
      height: fill,
      padding: { x: 13, y: 18 },
      fill: C.white,
      line: { style: 'solid', width: 1, fill: C.border },
      borderRadius: 'rounded-xl',
      align: 'center',
    },
    column(
      { name: `left-rail-stack-${slideNo}`, width: fill, height: fill, align: 'center', justify: 'between' },
      [
        image({
          name: `favicon-${slideNo}`,
          path: FAVICON,
          width: fixed(36),
          height: fixed(36),
          fit: 'contain',
          alt: 'Etendo',
        }),
        column(
          { name: `rail-mid-${slideNo}`, width: fill, height: hug, align: 'center', gap: 14 },
          [
            shape({
              name: `rail-accent-${slideNo}`,
              width: fixed(8),
              height: fixed(120),
              fill: C.yellow,
              line: { style: 'solid', width: 0, fill: C.yellow },
              borderRadius: 'rounded-full',
            }),
            tx(section, {
              name: `rail-section-${slideNo}`,
              width: fixed(66),
              style: { typeface: FONT, fontSize: 13, bold: true, color: C.secondary, alignment: 'center', wrap: 'square' },
            }),
          ],
        ),
        tx(String(slideNo).padStart(2, '0'), {
          name: `rail-number-${slideNo}`,
          width: fill,
          style: { typeface: FONT, fontSize: 16, bold: true, color: C.icon, alignment: 'center', wrap: 'none' },
        }),
      ],
    ),
  );
}

function footer(slideNo) {
  return row(
    { name: `footer-${slideNo}`, width: fill, height: hug, align: 'center', justify: 'between' },
    [
      tx('Etendo GO · Producto · 2026-04-30', {
        name: `footer-left-${slideNo}`,
        width: fixed(620),
        style: { ...S.small, fontSize: 14, color: C.icon },
      }),
      tx('Schema Forge snapshot', {
        name: `footer-right-${slideNo}`,
        width: fixed(260),
        style: { ...S.small, fontSize: 14, color: C.icon, alignment: 'right', wrap: 'none' },
      }),
    ],
  );
}

function normalSlide(presentation, slideNo, section, title, subtitle, bodyNode, note) {
  const slide = presentation.slides.add();
  slide.background.fill = C.page;
  slide.speakerNotes.setText(note);
  slide.compose(
    grid(
      {
        name: `slide-${slideNo}-root`,
        width: fill,
        height: fill,
        columns: [fixed(86), fr(1)],
        rows: [auto, fr(1), auto],
        columnGap: 34,
        rowGap: 28,
        padding: { x: 50, y: 42 },
      },
      [
        Object.assign(leftRail(slideNo, section), { rowSpan: 3 }),
        column(
          { name: `header-${slideNo}`, width: fill, height: hug, gap: 12 },
          [
            row(
              { name: `topline-${slideNo}`, width: fill, height: hug, align: 'center', justify: 'between' },
              [
                pill(section, { name: `section-pill-${slideNo}`, fill: C.yellow, color: C.ink }),
                panel(
                  {
                    name: `search-pill-${slideNo}`,
                    width: fixed(520),
                    height: hug,
                    padding: { x: 22, y: 10 },
                    fill: C.search,
                    borderRadius: 'rounded-full',
                    align: 'center',
                  },
                  tx('Buscar en Etendo GO / preguntar al agente', {
                    name: `search-text-${slideNo}`,
                    width: fill,
                    style: { typeface: FONT, fontSize: 15, color: C.breadcrumb, wrap: 'none' },
                  }),
                ),
              ],
            ),
            tx(title, {
              name: `slide-title-${slideNo}`,
              width: fill,
              style: S.h2,
            }),
            tx(subtitle, {
              name: `slide-subtitle-${slideNo}`,
              width: wrap(1200),
              style: S.sub,
            }),
          ],
        ),
        bodyNode,
        footer(slideNo),
      ],
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
  return slide;
}

function cover(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = C.page;
  slide.speakerNotes.setText(
    'Abrir con la tesis: Etendo ya tiene profundidad funcional; el desafío es hacerlo más simple, atractivo y operable. La presentación muestra cómo Etendo GO toma esa base y la convierte en una capa de producto para UI humana, APIs, herramientas y agentes.',
  );
  slide.compose(
    grid(
      {
        name: 'cover-root',
        width: fill,
        height: fill,
        columns: [fr(1.05), fr(0.95)],
        rows: [auto, fr(1), auto],
        columnGap: 48,
        rowGap: 30,
        padding: { x: 78, y: 58 },
      },
      [
        row(
          { name: 'cover-top', columnSpan: 2, width: fill, height: hug, align: 'center', justify: 'between' },
          [
            image({ name: 'cover-logo', path: LOGO, width: fixed(170), height: fixed(44), fit: 'contain', alt: 'Etendo' }),
            pill('Producto · Abril 2026', { name: 'cover-date', fill: C.white, line: C.border, color: C.breadcrumb }),
          ],
        ),
        column(
          { name: 'cover-left', width: fill, height: fill, gap: 28, justify: 'center' },
          [
            pill('Nueva capa sobre Etendo Classic', { name: 'cover-pill', fill: C.yellow, color: C.ink }),
            tx('Etendo GO', {
              name: 'cover-title',
              width: fill,
              style: { typeface: FONT, fontSize: 118, bold: true, color: C.ink, wrap: 'none' },
            }),
            tx('Agéntico, simple y configurable', {
              name: 'cover-subtitle',
              width: wrap(870),
              style: { typeface: FONT, fontSize: 42, bold: true, color: C.ink, wrap: 'square' },
            }),
            rule({ name: 'cover-rule', width: fixed(240), stroke: C.yellow, weight: 8 }),
            tx('Una versión más operable y atractiva del ERP, sin reescribir Etendo Classic desde cero.', {
              name: 'cover-copy',
              width: wrap(820),
              style: { ...S.sub, fontSize: 31, color: C.secondary },
            }),
          ],
        ),
        panel(
          {
            name: 'cover-preview-panel',
            width: fill,
            height: fill,
            fill: C.white,
            line: { style: 'solid', width: 1, fill: C.border },
            borderRadius: 'rounded-xl',
            padding: { x: 24, y: 24 },
          },
          column(
            { name: 'cover-preview-stack', width: fill, height: fill, gap: 18 },
            [
              row(
                { name: 'cover-ui-topbar', width: fill, height: hug, align: 'center', justify: 'between' },
                [
                  row(
                    { name: 'cover-ui-buttons', width: hug, height: hug, gap: 8 },
                    [
                      shape({ name: 'dot-1', geometry: 'ellipse', width: fixed(12), height: fixed(12), fill: C.yellow, line: { style: 'solid', width: 0, fill: C.yellow } }),
                      shape({ name: 'dot-2', geometry: 'ellipse', width: fixed(12), height: fixed(12), fill: C.search, line: { style: 'solid', width: 0, fill: C.search } }),
                      shape({ name: 'dot-3', geometry: 'ellipse', width: fixed(12), height: fixed(12), fill: C.search, line: { style: 'solid', width: 0, fill: C.search } }),
                    ],
                  ),
                  panel(
                    { name: 'cover-search', width: fixed(310), height: hug, fill: C.search, borderRadius: 'rounded-full', padding: { x: 18, y: 8 } },
                    tx('Comando / agente', { name: 'cover-search-text', width: fill, style: { ...S.small, fontSize: 14, color: C.breadcrumb, wrap: 'none' } }),
                  ),
                ],
              ),
              image({
                name: 'cover-dashboard-preview',
                path: DASHBOARD,
                width: fill,
                height: fill,
                fit: 'cover',
                borderRadius: 'rounded-lg',
                alt: 'Etendo GO UI preview',
              }),
            ],
          ),
        ),
        Object.assign(footer(1), { columnSpan: 2 }),
      ],
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
  return slide;
}

function buildDeck() {
  const p = Presentation.create({ slideSize: { width: W, height: H } });

  cover(p);

  normalSlide(
    p,
    2,
    'Tesis de producto',
    'Etendo GO: una capa moderna, no una reescritura',
    'Aprovechamos Etendo Classic y diseñamos encima una experiencia más simple, configurable y operable.',
    grid(
      {
        name: 'slide-2-body',
        width: fill,
        height: fill,
        columns: [fr(1.15), fr(0.85)],
        columnGap: 42,
      },
      [
        column(
          { name: 'slide-2-flow', width: fill, height: fill, gap: 20, justify: 'center' },
          [
            step('Etendo Classic', 'Reglas, entidades, procesos, permisos y consistencia.', { name: 's2-step-1', index: 1 }),
            rule({ name: 's2-rule-1', width: fixed(420), stroke: C.border, weight: 2 }),
            step('Capa de producto', 'Decisiones de UX, simplificación y contratos.', { name: 's2-step-2', index: 2, fill: C.search }),
            rule({ name: 's2-rule-2', width: fixed(420), stroke: C.border, weight: 2 }),
            step('NEO Headless', 'Runtime API para exponer capacidades reales del ERP.', { name: 's2-step-3', index: 3, fill: C.search }),
            rule({ name: 's2-rule-3', width: fixed(420), stroke: C.border, weight: 2 }),
            step('Etendo GO', 'UI simplificada, tools agénticas, validación y observabilidad.', { name: 's2-step-4', index: 4 }),
          ],
        ),
        column(
          { name: 'slide-2-positioning', width: fill, height: fill, gap: 22, justify: 'center' },
          [
            pill('Norte de posicionamiento', { name: 's2-position-pill', fill: C.yellow, color: C.ink }),
            bullet('Más simple de usar que un ERP tradicional complejo.', { name: 's2-b1' }),
            bullet('Más directo y atractivo como producto.', { name: 's2-b2' }),
            bullet('Más simple que Odoo como aspiración de UX.', { name: 's2-b3' }),
            bullet('Más configurable que Holded como aspiración de producto.', { name: 's2-b4' }),
            bullet('Con la profundidad funcional de Etendo por debajo.', { name: 's2-b5' }),
          ],
        ),
      ],
    ),
    'Esta slide evita la confusión principal: no estamos reescribiendo Etendo Classic. La promesa de Etendo GO es que el usuario obtenga el valor del ERP sin sufrir toda la complejidad clásica.',
  );

  normalSlide(
    p,
    3,
    'Qué es Etendo GO',
    'La nueva capa de operación del ERP',
    'Etendo GO ordena las superficies modernas de operación sin duplicar la lógica central.',
    grid(
      { name: 'slide-3-body', width: fill, height: fill, columns: [fr(1), fixed(74), fr(1)], columnGap: 28 },
      [
        panel(
          { name: 's3-core', width: fill, height: fill, fill: C.white, line: { style: 'solid', width: 1, fill: C.border }, borderRadius: 'rounded-xl', padding: { x: 38, y: 42 } },
          column(
            { name: 's3-core-stack', width: fill, height: fill, gap: 24, justify: 'center' },
            [
              tx('Core ERP', { name: 's3-core-title', style: { ...S.h2, fontSize: 46 } }),
              bullet('Reglas de negocio', { name: 's3-core-b1' }),
              bullet('Datos y relaciones', { name: 's3-core-b2' }),
              bullet('Procesos y permisos', { name: 's3-core-b3' }),
              bullet('Consistencia transaccional', { name: 's3-core-b4' }),
            ],
          ),
        ),
        column(
          { name: 's3-bridge', width: fill, height: fill, align: 'center', justify: 'center', gap: 18 },
          [
            shape({ name: 's3-bridge-line', width: fixed(8), height: fixed(300), fill: C.yellow, line: { style: 'solid', width: 0, fill: C.yellow }, borderRadius: 'rounded-full' }),
            tx('sobre', { name: 's3-bridge-text', width: fill, style: { ...S.label, alignment: 'center' } }),
          ],
        ),
        panel(
          { name: 's3-go', width: fill, height: fill, fill: C.ink, line: { style: 'solid', width: 0, fill: C.ink }, borderRadius: 'rounded-xl', padding: { x: 38, y: 42 } },
          column(
            { name: 's3-go-stack', width: fill, height: fill, gap: 24, justify: 'center' },
            [
              tx('Etendo GO', { name: 's3-go-title', style: { ...S.h2, fontSize: 46, color: C.white } }),
              bullet('UI enfocada para humanos', { name: 's3-go-b1', style: { ...S.bodyMuted, color: '#D5D9E2' } }),
              bullet('APIs y contratos explícitos', { name: 's3-go-b2', style: { ...S.bodyMuted, color: '#D5D9E2' } }),
              bullet('Tools operables por agentes', { name: 's3-go-b3', style: { ...S.bodyMuted, color: '#D5D9E2' } }),
              bullet('Métricas de uso y validación', { name: 's3-go-b4', style: { ...S.bodyMuted, color: '#D5D9E2' } }),
            ],
          ),
        ),
      ],
    ),
    'Etendo GO es la capa donde ocurre la operación moderna: humanos que necesitan pantallas simples, agentes que necesitan herramientas y Producto que necesita observar qué pasa para mejorar.',
  );

  normalSlide(
    p,
    4,
    'Cómo lo hacemos',
    'Schema Forge convierte metadata del ERP en producto',
    'Partimos de metadata real de Etendo y la transformamos en decisiones, contratos, UI, tools, pruebas y documentación.',
    column(
      { name: 'slide-4-body', width: fill, height: fill, gap: 36, justify: 'center' },
      [
        grid(
          { name: 's4-pipeline', width: fill, height: hug, columns: [fr(1), fr(1), fr(1), fr(1), fr(1)], columnGap: 18 },
          [
            step('Metadata', 'ventanas, tabs, columnas', { name: 's4-step-1', index: 1 }),
            step('Decisiones', 'visibilidad, edición, reglas', { name: 's4-step-2', index: 2, fill: C.search }),
            step('Contratos', 'frontend/backend + NEO', { name: 's4-step-3', index: 3 }),
            step('Experiencia', 'UI React + tools', { name: 's4-step-4', index: 4, fill: C.search }),
            step('Evidencia', 'tests + documentación', { name: 's4-step-5', index: 5 }),
          ],
        ),
        panel(
          { name: 's4-claim', width: fill, height: hug, fill: C.white, line: { style: 'solid', width: 1, fill: C.border }, borderRadius: 'rounded-xl', padding: { x: 38, y: 28 } },
          tx('El valor no está solo en generar código: está en hacer explícitas las decisiones de producto.', {
            name: 's4-claim-text',
            style: { ...S.body, fontSize: 31, bold: true },
          }),
        ),
      ],
    ),
    'Schema Forge permite capturar qué campos se muestran, cuáles se editan, qué reglas se mantienen, qué procesos se exponen, qué necesita UX custom y qué se valida automáticamente.',
  );

  normalSlide(
    p,
    5,
    'Por qué importa',
    'El ERP no escala si cada pantalla se redescubre a mano',
    'La superficie funcional es demasiado amplia para depender de análisis, diseño, implementación y documentación artesanal en cada ventana.',
    grid(
      { name: 'slide-5-body', width: fill, height: fill, columns: [fr(0.95), fr(1.05)], columnGap: 46 },
      [
        column(
          { name: 's5-left', width: fill, height: fill, gap: 20, justify: 'center' },
          [
            pill('Superficie ERP', { name: 's5-pill', fill: C.yellow, color: C.ink }),
            bullet('Ventas, compras, inventario, finanzas y contactos.', { name: 's5-b1' }),
            bullet('Procesos, reportes, estados y documentos relacionados.', { name: 's5-b2' }),
            bullet('Reglas contables, permisos, defaults y validaciones.', { name: 's5-b3' }),
            bullet('Decisiones de producto que deben quedar auditables.', { name: 's5-b4' }),
          ],
        ),
        panel(
          { name: 's5-trace-panel', width: fill, height: fill, fill: C.white, line: { style: 'solid', width: 1, fill: C.border }, borderRadius: 'rounded-xl', padding: { x: 40, y: 46 } },
          column(
            { name: 's5-trace', width: fill, height: fill, gap: 28, justify: 'center' },
            [
              tx('Trazabilidad', { name: 's5-trace-title', style: { ...S.h2, fontSize: 44 } }),
              step('Dato original', 'metadata del ERP', { name: 's5-t1', index: 1 }),
              step('Decisión de Producto', 'curación y simplificación', { name: 's5-t2', index: 2, fill: C.search }),
              step('Contrato y runtime', 'NEO + UI + tools', { name: 's5-t3', index: 3 }),
              step('Evidencia funcional', 'tests + documentación', { name: 's5-t4', index: 4, fill: C.search }),
            ],
          ),
        ),
      ],
    ),
    'Schema Forge cambia el costo de escala porque deja trazabilidad. No se pierde el porqué de cada decisión y se puede repetir el proceso con una secuencia clara: DEV, REVIEW, QA y DOCS.',
  );

  normalSlide(
    p,
    6,
    'Autocrítica',
    'Schema Forge nos trajo hasta acá, pero sigue en refinamiento',
    'No estamos mostrando una herramienta cerrada: estamos mostrando una metodología viva que mejora con cada contrato, ventana, prueba y validación agéntica.',
    grid(
      { name: 'slide-6-body', width: fill, height: fill, columns: [fr(0.9), fr(1.1)], columnGap: 48 },
      [
        column(
          { name: 's6-loop', width: fill, height: fill, justify: 'center', gap: 22 },
          [
            step('Modelar', 'capturar metadata y decisiones', { name: 's6-step-1', index: 1 }),
            step('Generar', 'contratos, UI, configuración NEO', { name: 's6-step-2', index: 2, fill: C.search }),
            step('Validar', 'pruebas, docs, comportamiento real', { name: 's6-step-3', index: 3 }),
            step('Refinar', 'mejorar precisión, cobertura y criterios', { name: 's6-step-4', index: 4, fill: C.search }),
          ],
        ),
        panel(
          { name: 's6-refinement-panel', width: fill, height: fill, fill: C.warnBg, line: { style: 'solid', width: 1, fill: '#F5DFAD' }, borderRadius: 'rounded-xl', padding: { x: 42, y: 42 } },
          column(
            { name: 's6-refinement-list', width: fill, height: fill, gap: 18, justify: 'center' },
            [
              tx('Qué estamos mejorando', { name: 's6-ref-title', style: { ...S.h2, fontSize: 42, color: C.ink } }),
              bullet('Calidad de decisiones generadas y curadas.', { name: 's6-b1', color: C.warn }),
              bullet('Consistencia entre contratos, UI, NEO y docs.', { name: 's6-b2', color: C.warn }),
              bullet('Cobertura de reglas de negocio y edge cases.', { name: 's6-b3', color: C.warn }),
              bullet('Soporte para ventanas, reportes, dashboards y tools.', { name: 's6-b4', color: C.warn }),
              bullet('Validación automática y pruebas E2E.', { name: 's6-b5', color: C.warn }),
            ],
          ),
        ),
      ],
    ),
    'Schema Forge no es una caja mágica terminada. Nos permitió llegar a una escala que antes habría sido mucho más costosa, y ahora vemos mejor sus límites. Cada validación nos devuelve información para mejorar la herramienta.',
  );

  normalSlide(
    p,
    7,
    'Evidencia',
    'Ya hay una base amplia, no una prueba aislada',
    'Etendo GO ya tiene superficie modelada, generada y documentada con datos concretos del repositorio.',
    column(
      { name: 'slide-7-body', width: fill, height: fill, gap: 40, justify: 'center' },
      [
        grid(
          { name: 's7-metrics-top', width: fill, height: hug, columns: [fr(1), fr(1), fr(1), fr(1)], columnGap: 38 },
          [
            metric('80', 'artefactos', { name: 's7-m1' }),
            metric('53', 'contratos de ventanas', { name: 's7-m2' }),
            metric('17', 'contratos de reportes', { name: 's7-m3' }),
            metric('11', 'dashboards / agregados', { name: 's7-m4' }),
          ],
        ),
        rule({ name: 's7-rule', width: fill, stroke: C.border, weight: 2 }),
        grid(
          { name: 's7-metrics-bottom', width: fill, height: hug, columns: [fr(1), fr(1), fr(1)], columnGap: 46 },
          [
            metric('142', 'entidades modeladas', { name: 's7-m5', color: C.blue }),
            metric('1.321', 'campos expuestos', { name: 's7-m6', color: C.blue }),
            metric('40', 'guías funcionales', { name: 's7-m7', color: C.blue }),
          ],
        ),
      ],
    ),
    'Estos números cambian la conversación. No estamos mostrando una intención metodológica, sino una base considerable de superficie del ERP ya modelada para producto.',
  );

  normalSlide(
    p,
    8,
    'Calidad e IA',
    'La IA acelera, pero exige reglas más explícitas',
    'Velocidad sin precisión funcional produce inconsistencia. Las reglas de negocio tienen que estar escritas con más rigor.',
    grid(
      { name: 'slide-8-body', width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 48 },
      [
        panel(
          { name: 's8-formula-panel', width: fill, height: fill, fill: C.ink, line: { style: 'solid', width: 0, fill: C.ink }, borderRadius: 'rounded-xl', padding: { x: 42, y: 44 } },
          column(
            { name: 's8-formula', width: fill, height: fill, gap: 26, justify: 'center' },
            [
              pill('Ejemplo: descuento', { name: 's8-pill', fill: C.yellow, color: C.ink }),
              tx('descuento = base imponible * porcentaje', { name: 's8-code-1', style: { ...S.mono, color: C.white } }),
              tx('total línea = base - descuento + impuestos', { name: 's8-code-2', style: { ...S.mono, color: C.white } }),
            ],
          ),
        ),
        column(
          { name: 's8-rules', width: fill, height: fill, gap: 20, justify: 'center' },
          [
            bullet('Sobre qué monto se calcula.', { name: 's8-b1' }),
            bullet('En qué momento del flujo se aplica.', { name: 's8-b2' }),
            bullet('Qué redondeo usamos.', { name: 's8-b3' }),
            bullet('Qué valida backend.', { name: 's8-b4' }),
            bullet('Qué muestra frontend.', { name: 's8-b5' }),
          ],
        ),
      ],
    ),
    'El rol humano se desplaza: describe el comportamiento esperado, solicita el cambio, valida si lo generado cumple y aplica criterio sobre UX, negocio y riesgo.',
  );

  normalSlide(
    p,
    9,
    'Dimensión agéntica',
    'El humano usa UI; el agente usa tools',
    'Agent-first no significa una pantalla para robots. Significa capacidades expuestas como herramientas con contratos claros.',
    grid(
      { name: 'slide-9-body', width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 48 },
      [
        panel(
          { name: 's9-human', width: fill, height: fill, fill: C.white, line: { style: 'solid', width: 1, fill: C.border }, borderRadius: 'rounded-xl', padding: { x: 42, y: 44 } },
          column(
            { name: 's9-human-stack', width: fill, height: fill, gap: 22, justify: 'center' },
            [
              pill('Humano', { name: 's9-human-pill', fill: C.search, color: C.breadcrumb }),
              tx('UI', { name: 's9-human-title', style: { ...S.h1, fontSize: 86 } }),
              tx('Experiencia guiada: ventanas, formularios, botones, campos y feedback visual.', { name: 's9-human-text', style: S.bodyMuted }),
            ],
          ),
        ),
        panel(
          { name: 's9-agent', width: fill, height: fill, fill: C.yellow, line: { style: 'solid', width: 0, fill: C.yellow }, borderRadius: 'rounded-xl', padding: { x: 42, y: 44 } },
          column(
            { name: 's9-agent-stack', width: fill, height: fill, gap: 22, justify: 'center' },
            [
              pill('Agente', { name: 's9-agent-pill', fill: C.ink, color: C.white }),
              tx('Tools', { name: 's9-agent-title', style: { ...S.h1, fontSize: 86 } }),
              tx('Acciones con contexto: discovery, schema, defaults, IDs reales, ejecución mínima y verificación.', { name: 's9-agent-text', style: { ...S.bodyMuted, color: C.ink } }),
            ],
          ),
        ),
      ],
    ),
    'La capa agéntica no debería enseñar al agente a llenar pantallas. Debe darle herramientas operativas del ERP con contexto suficiente para decidir cómo usarlas y cómo verificar el resultado.',
  );

  normalSlide(
    p,
    10,
    'Validación agéntica',
    'Ya tenemos una primera versión agéntica en validación',
    'Estamos probando si el agente completa tareas reales sobre capacidades del ERP, no si conversa bien.',
    grid(
      { name: 'slide-10-body', width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 42 },
      [
        column(
          { name: 's10-steps-left', width: fill, height: fill, gap: 18, justify: 'center' },
          [
            step('Discovery', 'capacidades disponibles del ERP', { name: 's10-step-1', index: 1 }),
            step('Schema y defaults', 'campos requeridos y valores iniciales', { name: 's10-step-2', index: 2, fill: C.search }),
            step('Resolución de datos', 'nombres humanos a IDs reales', { name: 's10-step-3', index: 3 }),
          ],
        ),
        column(
          { name: 's10-steps-right', width: fill, height: fill, gap: 18, justify: 'center' },
          [
            step('Ejecución mínima', 'acción controlada mediante tools', { name: 's10-step-4', index: 4, fill: C.search }),
            step('Lectura del ERP', 'resultado real, no suposición', { name: 's10-step-5', index: 5 }),
            step('Comparación', 'resultado contra objetivo original', { name: 's10-step-6', index: 6, fill: C.search }),
          ],
        ),
      ],
    ),
    'La versión agéntica arranca desde la misma base de contratos y metadata. Todavía validamos alcance, límites, calidad de contratos y comportamiento ante errores, pero ya existe una superficie inicial para aprender con casos reales.',
  );

  normalSlide(
    p,
    11,
    'Siguiente aprendizaje',
    'Medir uso real para decidir mejor',
    'La próxima etapa es observar humanos y agentes, interpretar esas señales y convertirlas en decisiones de producto.',
    grid(
      { name: 'slide-11-body', width: fill, height: fill, columns: [fr(1.05), fr(0.95)], columnGap: 48 },
      [
        column(
          { name: 's11-loop', width: fill, height: fill, gap: 24, justify: 'center' },
          [
            step('Uso real', 'humano con UI, agente con tools', { name: 's11-l1', index: 1 }),
            rule({ name: 's11-rule-1', width: fixed(500), stroke: C.border, weight: 2 }),
            step('Métricas', 'acciones, errores, abandonos, intervención', { name: 's11-l2', index: 2, fill: C.search }),
            rule({ name: 's11-rule-2', width: fixed(500), stroke: C.border, weight: 2 }),
            step('Interpretación', 'Producto le da significado a la señal', { name: 's11-l3', index: 3 }),
            rule({ name: 's11-rule-3', width: fixed(500), stroke: C.border, weight: 2 }),
            step('Decisiones', 'mejora de experiencia, contratos y tools', { name: 's11-l4', index: 4, fill: C.search }),
          ],
        ),
        column(
          { name: 's11-questions', width: fill, height: fill, gap: 20, justify: 'center' },
          [
            pill('Preguntas de validación', { name: 's11-pill', fill: C.yellow, color: C.ink }),
            bullet('¿La UI reduce fricción para el usuario?', { name: 's11-b1' }),
            bullet('¿El agente elige la tool correcta?', { name: 's11-b2' }),
            bullet('¿Resuelve datos reales sin inventar?', { name: 's11-b3' }),
            bullet('¿Ejecuta lo mínimo necesario?', { name: 's11-b4' }),
            bullet('¿Verifica el resultado contra el objetivo?', { name: 's11-b5' }),
          ],
        ),
      ],
    ),
    'El cierre es que estamos construyendo Etendo GO como una capa sobre Etendo: más simple y atractiva para humanos, más operable para agentes y más observable para Producto. La meta no es decir hicimos una demo, sino tener evidencia para saber qué mejorar después.',
  );

  return p;
}

async function saveBlob(blob, filePath) {
  const ab = await blob.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(ab));
}

async function main() {
  await fs.rm('output', { recursive: true, force: true });
  await fs.rm(PREVIEWS, { recursive: true, force: true });
  await fs.rm(LAYOUTS, { recursive: true, force: true });
  await fs.mkdir('output', { recursive: true });
  await fs.mkdir(PREVIEWS, { recursive: true });
  await fs.mkdir(LAYOUTS, { recursive: true });

  const presentation = buildDeck();
  const pendingImages = presentation.getPendingImageHydrationRequests();
  if (pendingImages.length) {
    const hydrated = [];
    for (const request of pendingImages) {
      const data = await fs.readFile(request.uri);
      hydrated.push({
        assetId: request.assetId,
        contentType: request.contentType || 'image/png',
        data,
      });
    }
    presentation.hydrateImageAssets(hydrated);
  }
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);

  for (const [index, slide] of presentation.slides.items.entries()) {
    const slideNo = String(index + 1).padStart(2, '0');
    const png = await slide.export({ format: 'png' });
    await saveBlob(png, path.join(PREVIEWS, `slide-${slideNo}.png`));
    const layout = await slide.export({ format: 'layout' });
    await saveBlob(layout, path.join(LAYOUTS, `slide-${slideNo}.json`));
  }

  console.log(JSON.stringify({ pptx: OUT, previews: PREVIEWS, layouts: LAYOUTS, slides: presentation.slides.count }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
