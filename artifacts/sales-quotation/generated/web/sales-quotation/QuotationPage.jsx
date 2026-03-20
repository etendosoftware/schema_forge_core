import { ListView, DetailView } from '@/components/contract-ui';
import QuotationTable from './QuotationTable';
import QuotationForm from './QuotationForm';
import QuotationLineTable from './QuotationLineTable';
import QuotationLineForm from './QuotationLineForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Sales Quotation';

// @sf-generated-start summary:quotation
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:quotation

// @sf-generated-start processes:quotation
const processes = [

];
// @sf-generated-end processes:quotation

// @sf-generated-start addLineFields:quotationLine
const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true },
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, reference: 'Product', inputMode: 'search' },
    { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
    { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
    { key: 'orderedQuantity', column: 'QtyOrdered', type: 'text', required: true },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text' },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
    { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'User1', inputMode: 'selector' },
    { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'User2', inputMode: 'selector' },
  ],
  derived: [
    { key: 'unitPrice', column: 'PriceActual', type: 'text' },
    { key: 'grossUnitPrice', column: 'Gross_Unit_Price', type: 'text' },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', reference: 'Tax', inputMode: 'selector' },
    { key: 'listPrice', column: 'PriceList', type: 'text' },
    { key: 'discount', column: 'Discount', type: 'text' },
    { key: 'taxableAmount', column: 'Taxbaseamt', type: 'number' },
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
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/priceList"
    },
    {
      "entity": "quotation",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/paymentMethod"
    },
    {
      "entity": "quotation",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/paymentTerms"
    },
    {
      "entity": "quotation",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/warehouse"
    },
    {
      "entity": "quotation",
      "field": "rejectReason",
      "column": "C_Reject_Reason_ID",
      "reference": "Reject_Reason",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/rejectReason"
    },
    {
      "entity": "quotation",
      "field": "currency",
      "column": "C_Currency_ID",
      "url": "/sws/neo/sales-quotation/quotation/selectors/currency"
    },
    {
      "entity": "quotation",
      "field": "salesRepresentative",
      "column": "SalesRep_ID",
      "reference": "User",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotation/selectors/salesRepresentative"
    },
    {
      "entity": "quotation",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-quotation/quotation/selectors/project"
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
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/operativeUOM"
    },
    {
      "entity": "quotationLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/uOM"
    },
    {
      "entity": "quotationLine",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/tax"
    },
    {
      "entity": "quotationLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/project"
    },
    {
      "entity": "quotationLine",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/stDimension"
    },
    {
      "entity": "quotationLine",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/ndDimension"
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
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Quotation"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
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
