/**
 * Stable UI selectors for Playwright tests.
 *
 * Prefer data-testid selectors over localized labels. Visible copy can change
 * with the active locale, while these ids describe the tested UI contract.
 */

export const dashboard = {
  newSalesOrder: 'quick-action-sales-order-new',
  newSalesInvoice: 'quick-action-sales-invoice-new',
  newContact: 'quick-action-contacts-new',
};

export const listView = {
  root: 'list-view',
  newButton: 'action-new',
  statusFilter: 'filter-status',
  dateFilter: 'filter-date',
  advancedFilter: 'filter-advanced',
};

export const detailView = {
  root: 'detail-view',
  save: 'action-save',
  cancel: 'action-cancel',
  addLine: 'action-add-line',
  linesEmptyState: 'lines-empty-state',
  linesEmptyStateTitle: 'lines-empty-state-title',
  linesEmptyStateDescription: 'lines-empty-state-description',
};

export const field = (key) => `field-${key}`;
export const columnHeader = (key) => `column-header-${key}`;
export const inlineAddField = (key) => `inline-add-field-${key}`;
export const inlineAddOption = (fieldKey, optionId) => `inline-add-option-${fieldKey}-${optionId}`;
export const option = (fieldKey, optionId) => `option-${fieldKey}-${optionId}`;

export function byTestId(page, testId) {
  return page.getByTestId(testId);
}
