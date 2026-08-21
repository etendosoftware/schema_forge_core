import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scroll APIs — stub them so components that scroll
// into view on focus/validation don't throw.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
