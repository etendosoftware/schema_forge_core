import React from 'react';

/**
 * ETP-6244 — renders the text of the terms and conditions.
 *
 * The text is either plain text (`ETGO_TERMS.CONTENT`, e.g. the placeholder versions) or HTML:
 * the Word document attached in Classic, converted by mammoth (headings in bold, lists and
 * tables). The HTML is never
 * injected as markup: it is parsed and rebuilt as React elements from an allowlist of tags, with
 * every attribute dropped except a safe `href`. Anything outside the allowlist keeps its text and
 * loses its tag, so a script or an event handler cannot reach the page.
 */

const TAG_CLASSES = {
  p: 'mb-3',
  strong: 'font-semibold text-slate-900',
  b: 'font-semibold text-slate-900',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  br: null,
  h1: 'mb-3 mt-4 text-base font-semibold text-slate-900',
  h2: 'mb-3 mt-4 text-base font-semibold text-slate-900',
  h3: 'mb-2 mt-4 text-sm font-semibold text-slate-900',
  h4: 'mb-2 mt-3 text-sm font-semibold text-slate-900',
  h5: 'mb-2 mt-3 text-sm font-semibold text-slate-900',
  h6: 'mb-2 mt-3 text-sm font-semibold text-slate-900',
  // What the Classic Rich Text Area editor adds when the document is pasted from Word.
  div: null,
  span: null,
  s: 'line-through',
  sub: null,
  sup: null,
  blockquote: 'mb-3 border-l-2 border-slate-200 pl-3',
  hr: 'my-4 border-slate-200',
  caption: 'mb-1 text-left font-semibold text-slate-900',
  tfoot: null,
  ul: 'mb-3 list-disc space-y-1 pl-5',
  ol: 'mb-3 list-decimal space-y-1 pl-5',
  li: null,
  table: 'w-full border-collapse text-xs leading-5',
  thead: 'bg-slate-50',
  tbody: null,
  tr: null,
  th: 'border border-slate-200 px-2 py-1.5 text-left align-top font-semibold text-slate-900',
  td: 'border border-slate-200 px-2 py-1.5 text-left align-top',
  a: 'text-slate-900 underline',
};

/** Containers whose whitespace-only text children are layout noise, not content. */
const STRUCTURAL_TAGS = new Set(['ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'tr']);

/** Elements that take no children: React refuses children on them. */
const VOID_TAGS = new Set(['br', 'hr']);

/** Tags whose text is code or styling, never readable content: dropped with everything inside. */
const DROPPED_TAGS = new Set(['script', 'style', 'template', 'iframe', 'object', 'noscript']);

const SAFE_HREF = /^(https?:|mailto:)/i;

export function looksLikeHtml(content) {
  return typeof content === 'string' && /<(p|div|ul|ol|table|strong|b|em|h[1-6]|br)\b/i.test(content);
}

function toReact(node, key, parentTag) {
  if (node.nodeType === 3) {
    const text = node.nodeValue;
    if (STRUCTURAL_TAGS.has(parentTag) && !text.trim()) return null;
    return text;
  }
  if (node.nodeType !== 1) return null;
  const tag = node.tagName.toLowerCase();
  if (DROPPED_TAGS.has(tag)) return null;
  const children = Array.from(node.childNodes)
    .map((child, index) => toReact(child, index, tag))
    .filter(child => child !== null);
  if (!Object.hasOwn(TAG_CLASSES, tag)) {
    return children.length ? <React.Fragment key={key}>{children}</React.Fragment> : null;
  }
  const props = { key };
  if (TAG_CLASSES[tag]) props.className = TAG_CLASSES[tag];
  // A paragraph inside a table cell keeps the cell compact.
  if (tag === 'p' && (parentTag === 'td' || parentTag === 'th')) props.className = 'mb-1 last:mb-0';
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    if (!SAFE_HREF.test(href.trim())) return <React.Fragment key={key}>{children}</React.Fragment>;
    props.href = href.trim();
    props.target = '_blank';
    props.rel = 'noopener noreferrer';
  }
  if (VOID_TAGS.has(tag)) return React.createElement(tag, props);
  const element = React.createElement(tag, props, children.length ? children : undefined);
  if (tag === 'table') {
    return <div key={key} className="mb-4 overflow-x-auto">{element}</div>;
  }
  return element;
}

/**
 * Word marks every row of a table as a repeated header row when "Repeat as header row" is set on
 * the whole table, so mammoth puts them all in `<thead>` as `<th>`. Keep the first row as the
 * header and turn the rest into body rows, whose first cell stays a row header.
 */
function normalizeHeaderOnlyTables(root) {
  root.querySelectorAll('table').forEach(table => {
    const head = table.querySelector(':scope > thead');
    if (!head || table.querySelector(':scope > tbody > tr')) return;
    const rows = Array.from(head.querySelectorAll(':scope > tr'));
    if (rows.length < 2) return;
    const body = table.ownerDocument.createElement('tbody');
    rows.slice(1).forEach(row => {
      Array.from(row.children).slice(1).forEach(cell => {
        if (cell.tagName.toLowerCase() !== 'th') return;
        const td = table.ownerDocument.createElement('td');
        while (cell.firstChild) td.appendChild(cell.firstChild);
        cell.replaceWith(td);
      });
      body.appendChild(row);
    });
    head.after(body);
  });
}

export function TermsContent({ content }) {
  if (!looksLikeHtml(content) || typeof DOMParser === 'undefined') {
    return (
      <div className="whitespace-pre-line text-sm leading-6 text-slate-700" data-testid="terms-dialog-content">
        {content}
      </div>
    );
  }
  const body = new DOMParser().parseFromString(content, 'text/html').body;
  normalizeHeaderOnlyTables(body);
  return (
    <div className="text-sm leading-6 text-slate-700" data-testid="terms-dialog-content">
      {Array.from(body.childNodes).map((child, index) => toReact(child, index, 'body'))}
    </div>
  );
}

export default TermsContent;
