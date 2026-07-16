import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScrollPane } from '../scroll-pane.jsx';

// jsdom has no ResizeObserver — a no-op stub is enough since every test here
// drives remeasurement via a 'scroll' event (handleScroll already calls
// measure() synchronously), not via a real resize.
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

afterEach(() => {
  cleanup();
});

/** jsdom always reports 0 for scroll/client dimensions — stub them directly. */
function stubMetrics(el, { scrollWidth = 0, clientWidth = 0, scrollHeight = 0, clientHeight = 0, scrollLeft = 0, scrollTop = 0 }) {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  el.scrollLeft = scrollLeft;
  el.scrollTop = scrollTop;
}

describe('ScrollPane', () => {
  it('renders no shadow scrollbar on either axis when content does not overflow', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarX')).toBeNull();
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarY')).toBeNull();
  });

  it('renders a horizontal shadow thumb sized to the visible/total ratio when horizontal content overflows', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    expect(thumb.style.width).toBe('500px');
    expect(thumb.style.transform).toBe('translateX(0px)');
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarY')).toBeNull();
  });

  it('moves the horizontal thumb offset proportionally to scrollLeft', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollWidth 2000, clientWidth 1000 -> thumbSize 500, maxThumbOffset 500, maxScrollOffset 1000.
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 500 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    expect(thumb.style.transform).toBe('translateX(250px)');
  });

  it('renders a vertical shadow thumb when vertical content overflows', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbY');
    expect(thumb.style.height).toBe('160px');
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarX')).toBeNull();
  });

  it('enforces a minimum thumb size for extreme overflow ratios', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollWidth 100000, clientWidth 1000 -> raw thumb would be 10px, below the 24px floor.
    stubMetrics(pane, { scrollWidth: 100000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    expect(thumb.style.width).toBe('24px');
  });

  it('removes the shadow scrollbar once overflow disappears', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    expect(screen.getByTestId('ScrollPane__shadowScrollbarX')).toBeDefined();
    stubMetrics(pane, { scrollWidth: 1000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200 });
    fireEvent.scroll(pane);
    expect(screen.queryByTestId('ScrollPane__shadowScrollbarX')).toBeNull();
  });

  it('regression: onReachBottom still fires when scrolled within threshold of the bottom', () => {
    let reached = false;
    render(<ScrollPane data-testid="pane" onReachBottom={() => { reached = true; }} threshold={50}><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 1000, clientHeight: 400, scrollTop: 560 });
    fireEvent.scroll(pane);
    expect(reached).toBe(true);
  });
});

describe('thumb dragging', () => {
  it('scrolls the pane proportionally when the horizontal thumb is dragged', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollWidth 2000, clientWidth 1000 -> thumbSize 500, trackRange (clientWidth - thumbSize) 500, scrollRange (scrollWidth - clientWidth) 1000.
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 1, clientX: 300 });
    fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 400 });
    // deltaPointer 100px * (scrollRange 1000 / trackRange 500) = 200px scroll delta.
    expect(pane.scrollLeft).toBe(200);
  });

  it('scrolls the pane proportionally when the vertical thumb is dragged', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    // scrollHeight 1000, clientHeight 400 -> thumbSize 160, trackRange 240, scrollRange 600.
    stubMetrics(pane, { scrollWidth: 500, clientWidth: 500, scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbY');
    fireEvent.pointerDown(thumb, { pointerId: 2, clientY: 50 });
    fireEvent.pointerMove(thumb, { pointerId: 2, clientY: 74 });
    // deltaPointer 24px * (scrollRange 600 / trackRange 240) = 60px scroll delta.
    expect(pane.scrollTop).toBe(60);
  });

  it('clamps the scroll offset to the valid range when dragged past the end', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 3, clientX: 0 });
    fireEvent.pointerMove(thumb, { pointerId: 3, clientX: 10000 });
    expect(pane.scrollLeft).toBe(1000); // scrollRange = 2000 - 1000
  });

  it('drags relative to the scroll offset at drag start, not from zero', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 300 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 4, clientX: 300 });
    fireEvent.pointerMove(thumb, { pointerId: 4, clientX: 350 });
    // deltaPointer 50px * (1000/500) = 100px -> 300 (start) + 100 = 400.
    expect(pane.scrollLeft).toBe(400);
  });

  it('stops updating scroll position after pointerup', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 5, clientX: 0 });
    fireEvent.pointerMove(thumb, { pointerId: 5, clientX: 100 });
    fireEvent.pointerUp(thumb, { pointerId: 5, clientX: 100 });
    fireEvent.pointerMove(thumb, { pointerId: 5, clientX: 900 });
    // The move after pointerup must not move the scroll position further.
    expect(pane.scrollLeft).toBe(200); // only the pre-pointerup delta (100px * 2) applied
  });

  it('ignores a pointermove from a different, unrelated pointerId', () => {
    render(<ScrollPane data-testid="pane"><div>content</div></ScrollPane>);
    const pane = screen.getByTestId('pane');
    stubMetrics(pane, { scrollWidth: 2000, clientWidth: 1000, scrollHeight: 200, clientHeight: 200, scrollLeft: 0 });
    fireEvent.scroll(pane);
    const thumb = screen.getByTestId('ScrollPane__shadowScrollbarThumbX');
    fireEvent.pointerDown(thumb, { pointerId: 6, clientX: 0 });
    fireEvent.pointerMove(thumb, { pointerId: 999, clientX: 500 });
    expect(pane.scrollLeft).toBe(0);
  });
});
