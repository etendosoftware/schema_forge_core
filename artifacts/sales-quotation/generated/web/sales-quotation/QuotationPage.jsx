import { ListView, DetailView } from '@/components/contract-ui';
import QuotationTable from './QuotationTable';
import QuotationForm from './QuotationForm';
import QuotationLineTable from './QuotationLineTable';
import QuotationLineForm from './QuotationLineForm';
import RelatedDocuments from './RelatedDocuments';
import catalogs from './mockCatalogs';


const breadcrumb = 'Sales / Sales Quotation';

// @sf-generated-start summary:quotation
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:quotation

// @sf-custom-slot extraBadges:quotation
// @sf-generated-start extraBadges:quotation
const extraBadges = [];
// @sf-generated-end extraBadges:quotation

// @sf-generated-start processes:quotation
const processes = [
  { name: 'Convert to Order', label: 'Convert to  Order', style: 'positive' },
  { name: 'Void', label: 'Void', style: 'destructive' },
  { name: 'Reactivate', label: 'Reactivate', style: 'positive' },
];
// @sf-generated-end processes:quotation

// @sf-generated-start addLineFields:quotationLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, label: 'Product', reference: 'Product', inputMode: 'search' },
    { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true, label: 'Ordered Quantity' },
    { key: 'unitPrice', column: 'PriceActual', type: 'text', required: true, label: 'Net Unit Price' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, label: 'Tax', reference: 'Tax', inputMode: 'selector' },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
  ],
  derived: [
    { key: 'discount', column: 'Discount', type: 'text', label: 'Discount' },
  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:quotationLine

const api = {
  "specName": "sales-quotation",
  "baseUrl": "/sws/neo/sales-quotation",
  "crud": {
    "quotation": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-quotation/quotation",
      "detailUrl": "/sws/neo/sales-quotation/quotation/{id}",
      "supportedFilters": [
        "documentNo",
        "orderDate",
        "businessPartner",
        "validUntil",
        "documentStatus"
      ]
    },
    "quotationLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-quotation/quotationLine",
      "detailUrl": "/sws/neo/sales-quotation/quotationLine/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "quotation",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotation/selectors/businessPartner"
    },
    {
      "entity": "quotation",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-quotation/quotation/selectors/partnerAddress"
    },
    {
      "entity": "quotation",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/paymentMethod"
    },
    {
      "entity": "quotation",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/currency"
    },
    {
      "entity": "quotationLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/product"
    },
    {
      "entity": "quotationLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/tax"
    }
  ],
  "actions": [
    {
      "entity": "quotation",
      "field": "rMPickFromShipment",
      "column": "RM_PickFromShipment",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMPickFromShipment"
    },
    {
      "entity": "quotation",
      "field": "rMReceiveMaterials",
      "column": "RM_ReceiveMaterials",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMReceiveMaterials"
    },
    {
      "entity": "quotation",
      "field": "rMCreateInvoice",
      "column": "RM_CreateInvoice",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMCreateInvoice"
    },
    {
      "entity": "quotation",
      "field": "copyFrom",
      "column": "CopyFrom",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/copyFrom"
    },
    {
      "entity": "quotation",
      "field": "copyFromPO",
      "column": "CopyFromPO",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/copyFromPO"
    },
    {
      "entity": "quotation",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/documentAction"
    },
    {
      "entity": "quotation",
      "field": "createOrder",
      "column": "Convertquotation",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/createOrder"
    },
    {
      "entity": "quotation",
      "field": "calculatePromotions",
      "column": "Calculate_Promotions",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/calculatePromotions"
    },
    {
      "entity": "quotation",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/posted"
    },
    {
      "entity": "quotation",
      "field": "generateTemplate",
      "column": "Generatetemplate",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/generateTemplate"
    },
    {
      "entity": "quotation",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/processNow"
    },
    {
      "entity": "quotation",
      "field": "cancelandreplace",
      "column": "Cancelandreplace",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/cancelandreplace"
    },
    {
      "entity": "quotation",
      "field": "confirmcancelandreplace",
      "column": "Confirmcancelandreplace",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/confirmcancelandreplace"
    },
    {
      "entity": "quotation",
      "field": "createPOLines",
      "column": "Create_POLines",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/createPOLines"
    },
    {
      "entity": "quotation",
      "field": "aPRMAddPayment",
      "column": "EM_APRM_AddPayment",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/aPRMAddPayment"
    },
    {
      "entity": "quotation",
      "field": "rMAddOrphanLine",
      "column": "RM_AddOrphanLine",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMAddOrphanLine"
    },
    {
      "entity": "quotation",
      "field": "rMPickfromreceipt",
      "column": "RM_Pickfromreceipt",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMPickfromreceipt"
    },
    {
      "entity": "quotationLine",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/explode"
    },
    {
      "entity": "quotationLine",
      "field": "managePrereservation",
      "column": "Manage_Prereservation",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/managePrereservation"
    },
    {
      "entity": "quotationLine",
      "field": "manageReservation",
      "column": "Manage_Reservation",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/manageReservation"
    },
    {
      "entity": "quotationLine",
      "field": "selectOrderLine",
      "column": "Relate_Orderline",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/selectOrderLine"
    }
  ],
  "queryParams": {
    "pagination": {
      "startRow": "_startRow",
      "endRow": "_endRow",
      "default": "0-100"
    },
    "sorting": {
      "param": "_sortBy",
      "example": "_sortBy=sales-quotationDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:QuotationPage
export default function QuotationPage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:QuotationPage
  if (recordId) {
    return (
      <DetailView
        entity="quotation"
        detailEntity="quotationLine"
        Form={QuotationForm}
        DetailTable={QuotationLineTable}
        DetailForm={QuotationLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Quotation"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        documentPreview={{ titlePrefix: 'Quotation', pdfUrl: null }}
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }]}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="quotation"
      Table={QuotationTable}
      entityLabel="Quotations"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:QuotationPage

// @sf-custom-slot section:QuotationPage-custom
