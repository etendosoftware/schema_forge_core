import { ListView, DetailView } from '@/components/contract-ui';
import InvoiceTable from './InvoiceTable';
import InvoiceForm from './InvoiceForm';
import InvoiceLineTable from './InvoiceLineTable';
import catalogs from './mockCatalogs';

// @sf-generated-start summary:invoice
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
  { key: 'totalLines', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'paymentComplete', column: 'Ispaid', type: 'boolean' },
  { key: 'purchaseOrder', column: 'C_Order_ID', type: 'string' },
  { key: 'totalOutstanding', column: 'OutstandingAmt', type: 'amount' },
  { key: 'totalPaid', column: 'Totalpaid', type: 'amount' },
  { key: 'amountDue', column: 'DueAmt', type: 'amount' },
  { key: 'daysTillDue', column: 'DaysTillDue', type: 'number' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:invoice

// @sf-generated-start processes:invoice
const processes = [

];
// @sf-generated-end processes:invoice

// @sf-generated-start addLineFields:invoiceLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'invoicedQuantity', column: 'QtyInvoiced', type: 'number', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'account', column: 'Account_ID', type: 'selector', reference: 'Account', inputMode: 'selector' },
    { key: 'financialInvoiceLine', column: 'Financial_Invoice_Line', type: 'checkbox', required: true },
    { key: 'operativeQuantity', column: 'Aumqty', type: 'number' },
    { key: 'alternativeUOM', column: 'C_Aum', type: 'selector', reference: 'UOM', inputMode: 'selector' },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'selector', reference: 'AttributeSetInstance', inputMode: 'selector' },
    { key: 'deferredExpense', column: 'IsDeferred', type: 'checkbox', required: true },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'number' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number' },
    { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'number' },
    { key: 'listPrice', column: 'PriceList', type: 'number' },
    { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number' },
  ],
};
// @sf-generated-end addLineFields:invoiceLine

const api = {
  "specName": "purchase-invoice",
  "baseUrl": "/sws/neo/purchase-invoice",
  "crud": {
    "invoice": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoice",
      "detailUrl": "/sws/neo/purchase-invoice/invoice/{id}",
      "supportedFilters": [
        "businessPartner",
        "invoiceDate",
        "supplierReference",
        "documentNo",
        "documentStatus",
        "paymentComplete"
      ]
    },
    "invoiceLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceLine",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceLine/{id}",
      "supportedFilters": [
        "product"
      ]
    },
    "invoiceTax": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceTax",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceTax/{id}",
      "supportedFilters": []
    },
    "invoiceDiscount": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/invoiceDiscount",
      "detailUrl": "/sws/neo/purchase-invoice/invoiceDiscount/{id}",
      "supportedFilters": []
    },
    "paymentSchedule": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/purchase-invoice/paymentSchedule",
      "detailUrl": "/sws/neo/purchase-invoice/paymentSchedule/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "invoice",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/businessPartner"
    },
    {
      "entity": "invoice",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/partnerAddress"
    },
    {
      "entity": "invoice",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/priceList"
    },
    {
      "entity": "invoice",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/paymentTerms"
    },
    {
      "entity": "invoice",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/paymentMethod"
    },
    {
      "entity": "invoice",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/project"
    },
    {
      "entity": "invoice",
      "field": "costCenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/costCenter"
    },
    {
      "entity": "invoice",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/currency"
    },
    {
      "entity": "invoice",
      "field": "purchaseOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "url": "/sws/neo/purchase-invoice/invoice/selectors/purchaseOrder"
    },
    {
      "entity": "invoiceLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/product"
    },
    {
      "entity": "invoiceLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/tax"
    },
    {
      "entity": "invoiceLine",
      "field": "account",
      "column": "Account_ID",
      "reference": "Account",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/account"
    },
    {
      "entity": "invoiceLine",
      "field": "alternativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/alternativeUOM"
    },
    {
      "entity": "invoiceLine",
      "field": "attributeSetValue",
      "column": "M_AttributeSetInstance_ID",
      "reference": "AttributeSetInstance",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/attributeSetValue"
    },
    {
      "entity": "invoiceLine",
      "field": "uom",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/uom"
    },
    {
      "entity": "invoiceLine",
      "field": "purchaseOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/purchaseOrderLine"
    },
    {
      "entity": "invoiceLine",
      "field": "goodsReceiptLine",
      "column": "M_InOutLine_ID",
      "reference": "InOutLine",
      "url": "/sws/neo/purchase-invoice/invoiceLine/selectors/goodsReceiptLine"
    },
    {
      "entity": "invoiceTax",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "url": "/sws/neo/purchase-invoice/invoiceTax/selectors/tax"
    },
    {
      "entity": "invoiceDiscount",
      "field": "discount",
      "column": "C_Discount_ID",
      "reference": "Discount",
      "url": "/sws/neo/purchase-invoice/invoiceDiscount/selectors/discount"
    },
    {
      "entity": "paymentSchedule",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "url": "/sws/neo/purchase-invoice/paymentSchedule/selectors/paymentMethod"
    },
    {
      "entity": "paymentSchedule",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "url": "/sws/neo/purchase-invoice/paymentSchedule/selectors/currency"
    }
  ],
  "actions": [],
  "queryParams": {
    "pagination": {
      "startRow": "_startRow",
      "endRow": "_endRow",
      "default": "0-100"
    },
    "sorting": {
      "param": "_sortBy",
      "example": "_sortBy=purchase-invoiceDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:InvoicePage
export default function InvoicePage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:InvoicePage
  if (recordId) {
    return (
      <DetailView
        entity="invoice"
        detailEntity="invoiceLine"
        Form={InvoiceForm}
        DetailTable={InvoiceLineTable}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Invoice"
        detailLabel="Invoice Line"
        windowName={windowName}
        recordId={recordId}
      api={api}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="invoice"
      Table={InvoiceTable}
      entityLabel="Invoices"
      windowName={windowName}
      {...props}
    />
  );
}
// @sf-generated-end component:InvoicePage

// @sf-custom-slot section:InvoicePage-custom
