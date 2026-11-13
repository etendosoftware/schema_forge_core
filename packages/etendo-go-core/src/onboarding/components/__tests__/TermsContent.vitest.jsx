/**
 * @covers packages/etendo-go-core/src/onboarding/components/TermsContent.jsx
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TermsContent, looksLikeHtml } from '../TermsContent.jsx';

afterEach(cleanup);

const HTML_TERMS = [
  '<p><strong>1. Objeto</strong></p>',
  '<p>Texto con <em>énfasis</em>.</p>',
  '<ul>\n<li>Uno</li>\n<li>Dos</li>\n</ul>',
  '<table>\n<thead><tr><th></th><th>Start</th></tr></thead>',
  '<tbody>\n<tr><th>Canales</th><td>Chat</td></tr>\n</tbody>\n</table>',
].join('\n');

describe('looksLikeHtml', () => {
  it('tells the converted document from the plain-text placeholder', () => {
    expect(looksLikeHtml(HTML_TERMS)).toBe(true);
    expect(looksLikeHtml('First clause.\nSecond clause.')).toBe(false);
    expect(looksLikeHtml('a < b and c > d')).toBe(false);
    expect(looksLikeHtml(null)).toBe(false);
  });
});

describe('TermsContent', () => {
  it('keeps plain text as text, line breaks included', () => {
    render(<TermsContent content={'First clause.\nSecond clause.'} />);
    const content = screen.getByTestId('terms-dialog-content');
    expect(content.textContent).toBe('First clause.\nSecond clause.');
    expect(content.className).toContain('whitespace-pre-line');
  });

  it('renders the bold headings, lists and tables of the document', () => {
    const { container } = render(<TermsContent content={HTML_TERMS} />);
    expect(container.querySelector('strong').textContent).toBe('1. Objeto');
    expect(container.querySelector('em').textContent).toBe('énfasis');
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('table thead th')).toHaveLength(2);
    expect(container.querySelector('table tbody th').textContent).toBe('Canales');
    expect(container.querySelector('table tbody td').textContent).toBe('Chat');
    // A wide table scrolls inside the dialog instead of widening it.
    expect(container.querySelector('table').parentElement.className).toContain('overflow-x-auto');
  });

  it('keeps the text of wrapper tags and drops their styles', () => {
    const { container } = render(<TermsContent content={
      '<div><p><span style="font-family: Arial">Cláusula</span></p><hr></div>'} />);
    expect(container.querySelector('p').textContent).toBe('Cláusula');
    expect(container.querySelector('span').getAttribute('style')).toBeNull();
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('keeps only the first row as header when Word marked every row as one', () => {
    const { container } = render(<TermsContent content={[
      '<table><thead>',
      '<tr><th></th><th><p>Start</p></th></tr>',
      '<tr><th><p>Canales</p></th><th><p>Chat</p></th></tr>',
      '</thead></table>',
    ].join('')} />);
    expect(container.querySelectorAll('thead tr')).toHaveLength(1);
    expect(container.querySelector('tbody th').textContent).toBe('Canales');
    expect(container.querySelector('tbody td').textContent).toBe('Chat');
    // A paragraph inside a cell keeps the cell compact.
    expect(container.querySelector('tbody td p').className).toBe('mb-1 last:mb-0');
  });

  it('drops scripts, event handlers and unsafe links', () => {
    const { container } = render(<TermsContent content={[
      '<p onclick="alert(1)" style="color:red">Seguro</p>',
      '<script>alert(1)</script>',
      '<p><a href="javascript:alert(1)">malo</a> <a href="https://etendo.ai">bueno</a></p>',
      '<p><img src="x" onerror="alert(1)">fin</p>',
    ].join('')} />);
    const paragraph = container.querySelector('p');
    expect(paragraph.getAttribute('onclick')).toBeNull();
    expect(paragraph.getAttribute('style')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('alert');
    expect(container.querySelector('img')).toBeNull();
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://etendo.ai');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.textContent).toContain('malo');
  });
});
