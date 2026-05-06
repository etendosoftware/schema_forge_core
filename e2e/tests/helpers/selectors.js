/**
 * UI Selectors — discovered via agent-browser snapshot -i
 *
 * These selectors use Playwright's role-based locators, which map directly
 * to the accessibility tree that agent-browser outputs.
 *
 * Discovery date: 2026-03-18
 * Last verified: 2026-03-18
 *
 * To re-discover:
 *   agent-browser open http://localhost:3100
 *   agent-browser snapshot -i
 */

// --- Login ---
export const login = {
  username: { role: 'textbox', name: 'Username' },
  password: { role: 'textbox', name: 'Password' },
  signIn: { role: 'button', name: 'Sign in' },
};

// --- Dashboard ---
export const dashboard = {
  newInvoice: { role: 'link', name: '+ Invoice' },
  newOrder: { role: 'link', name: '+ Order' },
  newContact: { role: 'link', name: '+ Contact' },
  newProduct: { role: 'link', name: '+ Product' },
};

// --- Sales Order: List View ---
export const salesOrderList = {
  heading: { role: 'heading', name: 'Orders', level: 1 },
  newButton: { role: 'button', name: 'New Order' },
  searchInput: { role: 'textbox', name: /Search clients, orders, invoices/ },
  statusFilter: { role: 'button', name: 'All statuses' },
  dateFilter: { role: 'button', name: 'Last year' },
  // Column headers
  columns: {
    businessPartner: { role: 'columnheader', name: 'Business Partner' },
    salesRep: { role: 'columnheader', name: 'Sales Representative' },
    orderDate: { role: 'columnheader', name: 'Order Date' },
    orderRef: { role: 'columnheader', name: 'Order Reference' },
    grossAmount: { role: 'columnheader', name: 'Total Gross Amount' },
    netAmount: { role: 'columnheader', name: 'Total Net Amount' },
    delivered: { role: 'columnheader', name: 'Delivered' },
  },
};

// --- Sales Order: Detail (New Order form) ---
export const salesOrderDetail = {
  heading: { role: 'heading', name: 'New Order', level: 1 },
  // Actions
  cancel: { role: 'button', name: 'Cancel' },
  saveDraft: { role: 'button', name: 'Save draft' },
  save: { role: 'button', name: 'Save', exact: true },
  // Fields
  businessPartner: { role: 'textbox', name: /Business Partner/ },
  partnerAddress: { role: 'combobox', name: /Partner Address/ },
  warehouse: { role: 'combobox', name: /Warehouse/ },
  // Tabs
  orderLineTab: { role: 'button', name: /^Order Line \d+$/ },
  othersTab: { role: 'button', name: 'Others' },
  addOrderLine: { role: 'button', name: '+ Add Order Line' },
  // Order line columns
  lineColumns: {
    product: { role: 'columnheader', name: 'Product' },
    quantity: { role: 'columnheader', name: 'Ordered Quantity' },
    price: { role: 'columnheader', name: 'Net Unit Price' },
    amount: { role: 'columnheader', name: 'Line Net Amount' },
    tax: { role: 'columnheader', name: 'Tax' },
    discount: { role: 'columnheader', name: 'Discount' },
    lineNo: { role: 'columnheader', name: 'Line No.' },
  },
};

// --- Sales Invoice: List View ---
// Column headers come from labelOverrides in artifacts/sales-invoice/decisions.json
// (es_ES). The order is enforced by InvoiceHeaderTable.jsx. Locale-sensitive
// labels are resolved per-environment via SALES_INVOICE_GRID_COLUMNS below.
export const salesInvoiceList = {
  // Generic "any h1" — the visible text depends on session locale.
  heading: { role: 'heading', level: 1 },
};

// --- Purchase Invoice: List View ---
export const purchaseInvoiceList = {
  heading: { role: 'heading', level: 1 },
};

/**
 * Expected grid column labels per locale, in order, for both invoice grids.
 * Sales and purchase share the same final list because labelOverrides + the
 * customs are aligned. If a locale's session is active, the grid renders
 * using that set.
 */
export const INVOICE_GRID_COLUMNS = {
  es_ES: [
    'Fecha de la factura',
    'Nº documento',
    'Vencimiento',
    'Contacto',
    'Estado doc.',
    'Imp.total',
    'Pendiente de pago',
    'Estado de entrega',
  ],
  en_US: [
    'Invoice Date',
    'Document No.',
    'Due Date',
    'Business Partner',
    'Document Status',
    'Total Gross Amount',
    'Pending Payment',
    'Delivery Status',
  ],
};

// --- Purchase Order: List View ---
export const purchaseOrderList = {
  heading: { role: 'heading', name: 'Orders', level: 1 },
  newButton: { role: 'button', name: 'New Order' },
  columns: {
    transactionDoc: { role: 'columnheader', name: 'Transaction Document' },
    docStatus: { role: 'columnheader', name: 'Document Status' },
    orderDate: { role: 'columnheader', name: 'Order Date' },
    businessPartner: { role: 'columnheader', name: 'Business Partner' },
    warehouse: { role: 'columnheader', name: 'Warehouse' },
    priceList: { role: 'columnheader', name: 'Price List' },
    grossAmount: { role: 'columnheader', name: 'Total Gross Amount' },
  },
};

// --- Purchase Order: Detail (New Order form) ---
export const purchaseOrderDetail = {
  heading: { role: 'heading', name: 'New Order', level: 1 },
  // Actions
  cancel: { role: 'button', name: 'Cancel' },
  saveDraft: { role: 'button', name: 'Save draft' },
  save: { role: 'button', name: 'Save', exact: true },
  // Fields
  transactionDocument: { role: 'textbox', name: /Transaction Document/ },
  businessPartner: { role: 'textbox', name: /Business Partner/ },
  partnerAddress: { role: 'combobox', name: /Partner Address/ },
  // Tabs
  orderLineTab: { role: 'button', name: /^Order Line \d+$/ },
  othersTab: { role: 'button', name: 'Others' },
  addOrderLine: { role: 'button', name: '+ Add Order Line' },
  // Order line columns
  lineColumns: {
    lineNo: { role: 'columnheader', name: 'Line No.' },
    product: { role: 'columnheader', name: 'Product' },
    quantity: { role: 'columnheader', name: 'Ordered Quantity' },
    uom: { role: 'columnheader', name: 'UOM' },
    price: { role: 'columnheader', name: 'Net Unit Price' },
    amount: { role: 'columnheader', name: 'Line Net Amount' },
    tax: { role: 'columnheader', name: 'Tax' },
    discount: { role: 'columnheader', name: 'Discount' },
  },
};

// --- Physical Inventory: List View ---
// UI is in Spanish (es_ES locale). Column headers are sortable buttons, not columnheader role.
export const physicalInventoryList = {
  // Title shown in the top-left header area (not a heading role element)
  titleText: 'Inventario físico',
  newButton: { role: 'button', name: 'Nuevo' },
  columns: {
    movementDate: { role: 'button', name: 'Fecha del movimiento' },
    name: { role: 'button', name: 'Nombre' },
    warehouse: { role: 'button', name: 'Almacén' },
    inventoryType: { role: 'button', name: 'Tipo de Inventario' },
    status: { role: 'button', name: 'Procesar Declaración' },
  },
};

// --- Physical Inventory: Detail (New Inventory form) ---
export const physicalInventoryDetail = {
  // Title is "Nuevo" in the breadcrumb/header area
  titleText: 'Nuevo',
  cancel: { role: 'button', name: 'Cancelar' },
  save: { role: 'button', name: 'Guardar', exact: true },
  // Fields
  movementDate: 'input[type="date"]',
  name: 'input[placeholder=""]',
  warehouse: 'input[placeholder*="Almacén"]',
  // Lines tab
  linesTab: /^Líneas \d+$/,
  addLine: { role: 'button', name: /Añadir línea/ },
  processButton: { role: 'button', name: /Recuento de Inventario|Process Inventory/ },
  // Line columns (buttons — sortable)
  lineColumns: {
    lineNo: { role: 'button', name: 'Línea' },
    product: { role: 'button', name: 'Producto' },
    userCount: { role: 'button', name: 'Conteo del usuario' },
    uOM: { role: 'button', name: 'Unidad' },
    systemCount: { role: 'button', name: 'Conteo del sistema' },
  },
  // Inline add row fields
  addLineFields: {
    product: 'input[placeholder*="Producto"]',
    userCount: 'input[type="number"]',
  },
};

// --- Context Switcher ---
export const contextSwitcher = {
  apply: { role: 'button', name: 'Apply' },
  logout: { role: 'button', name: 'Logout' },
};

// --- Feedback ---
export const feedback = {
  toast: '[data-sonner-toast]',
  toastSuccess: '[data-sonner-toast][data-type="success"]',
  toastError: '[data-sonner-toast][data-type="error"]',
};

/**
 * Helper to use role-based selectors with Playwright page.
 *
 * Usage:
 *   import { byRole } from './selectors.js';
 *   await byRole(page, salesOrderList.newButton).click();
 */
export function byRole(page, sel) {
  const opts = { name: sel.name };
  if (sel.level) opts.level = sel.level;
  if (sel.exact) opts.exact = sel.exact;
  return page.getByRole(sel.role, opts);
}
