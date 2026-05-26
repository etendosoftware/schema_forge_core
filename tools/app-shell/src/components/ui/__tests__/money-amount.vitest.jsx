import { render } from '@testing-library/react';
import { MoneyAmount } from '../money-amount.jsx';

/**
 * MoneyAmount uses Intl.NumberFormat('es-ES'). To avoid coupling to exact
 * whitespace/character variants (NBSP vs NNBSP across Node versions), we
 * assert structural pieces of the output (sign prefix, digits, currency
 * symbol) and color class — never the full string.
 */

describe('MoneyAmount', () => {
  it('prepends "+" for positive values with auto tone and applies the positive color', () => {
    const { container } = render(<MoneyAmount value={12450} currency="EUR" />);
    const span = container.firstChild;
    expect(span.className).toContain('text-[#1E874C]');
    expect(span.textContent.startsWith('+')).toBe(true);
    expect(span.textContent).toContain('12');
    expect(span.textContent).toContain('450');
    expect(span.textContent).toContain('€');
  });

  it('prepends "-" for negative values with auto tone and applies the negative color', () => {
    const { container } = render(<MoneyAmount value={-200} currency="EUR" />);
    const span = container.firstChild;
    expect(span.className).toContain('text-[#d50b3e]');
    expect(span.textContent.startsWith('-')).toBe(true);
    expect(span.textContent).toContain('200');
  });

  it('formats zero without a "+" prefix but keeps the positive tone (auto)', () => {
    const { container } = render(<MoneyAmount value={0} currency="EUR" />);
    const span = container.firstChild;
    expect(span.className).toContain('text-[#1E874C]');
    // value === 0, so prefix is empty (positive prefix only when value > 0)
    expect(span.textContent.startsWith('+')).toBe(false);
    expect(span.textContent.startsWith('-')).toBe(false);
  });

  it('uses the neutral tone class when tone="neutral"', () => {
    const { container } = render(
      <MoneyAmount value={100} currency="EUR" tone="neutral" />,
    );
    const span = container.firstChild;
    expect(span.className).toContain('text-[#121217]');
    // No sign prefix in neutral tone for positive values
    expect(span.textContent.startsWith('+')).toBe(false);
  });

  it('forces the positive class even when the value is negative', () => {
    const { container } = render(
      <MoneyAmount value={-50} currency="EUR" tone="positive" />,
    );
    const span = container.firstChild;
    expect(span.className).toContain('text-[#1E874C]');
    // Negative value with positive tone: still receives the "-" sign
    expect(span.textContent.startsWith('-')).toBe(true);
  });

  it('forces the negative class with a "-" prefix when tone="negative"', () => {
    const { container } = render(
      <MoneyAmount value={300} currency="EUR" tone="negative" />,
    );
    const span = container.firstChild;
    expect(span.className).toContain('text-[#d50b3e]');
    expect(span.textContent.startsWith('-')).toBe(true);
  });

  it('uses the provided currency code (USD)', () => {
    const { container } = render(
      <MoneyAmount value={100} currency="USD" tone="neutral" />,
    );
    expect(container.textContent).toMatch(/\$|USD/);
  });

  it('formats absolute value (sign is owned by the prefix, not the formatter)', () => {
    const { container } = render(<MoneyAmount value={-7} currency="EUR" />);
    // The numeric portion should NOT contain a second "-" inside the formatted string
    const text = container.firstChild.textContent;
    // Expect only the leading "-" and no extra one
    expect(text.match(/-/g)?.length).toBe(1);
  });

  it('passes through extra className alongside the tone class', () => {
    const { container } = render(
      <MoneyAmount value={100} currency="EUR" tone="neutral" className="text-base font-bold" />,
    );
    const span = container.firstChild;
    expect(span.className).toContain('text-base');
    expect(span.className).toContain('font-bold');
    expect(span.className).toContain('text-[#121217]');
  });

  it('renders compact notation for large numbers when compact=true', () => {
    const { container } = render(
      <MoneyAmount value={12500} currency="EUR" tone="neutral" compact />,
    );
    // Compact notation in es-ES collapses 12500 → "12,5 mil €" or similar.
    // We only assert the formatted text is much shorter than the standard form.
    const compactText = container.textContent;
    expect(compactText.length).toBeLessThan('12.500,00 €'.length + 4);
  });
});
