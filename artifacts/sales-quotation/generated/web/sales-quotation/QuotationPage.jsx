import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { toast } from 'sonner';
import QuotationTable from './QuotationTable';
import QuotationForm from './QuotationForm';
import QuotationLineTable from './QuotationLineTable';
import QuotationLineForm from './QuotationLineForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import QuotationBottomPanel from '../../../custom/QuotationBottomPanel';
import QuotationTopbarActions from '../../../custom/QuotationTopbarActions';
import catalogs from './mockCatalogs';


const breadcrumb = 'Sales / Sales Quotation';

const labelOverrides = {
  "es_ES": {
    "C_BPartner_ID": "Contacto",
    "C_Reject_Reason_ID": "Razón de rechazo"
  },
  "en_US": {
    "C_BPartner_ID": "Contact",
    "C_Reject_Reason_ID": "Reject Reason"
  }
};


// @sf-generated-start summary:quotation
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:quotation

// @sf-generated-start extraBadges:quotation
const extraBadges = [];
// @sf-generated-end extraBadges:quotation

// @sf-generated-start processes:quotation
const processes = [

];
// @sf-generated-end processes:quotation

// @sf-generated-start draftMode:quotation
const draftMode = {
  "enabled": true,
  "processField": "documentAction",
  "processValue": "CO",
  "label": "soConfirmBtn",
  "completedStatuses": [
    "CA",
    "ETGO_CI",
    "CL",
    "VO",
    "CJ"
  ]
};
// @sf-generated-end draftMode:quotation

// @sf-generated-start requiredHeaderFields:quotation
const requiredHeaderFields = ['documentNo', 'orderDate', 'businessPartner', 'partnerAddress', 'priceList', 'paymentTerms', 'grandTotalAmount', 'summedLineAmount'];
// @sf-generated-end requiredHeaderFields:quotation

// @sf-generated-start addLineFields:quotationLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, label: 'Product', reference: 'Product', inputMode: 'search', forceCalloutFields: ["listPrice","unitPrice","tax","uOM","grossUnitPrice","discount"] },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
    { key: 'orderedQuantity', column: 'QtyOrdered', type: 'number', required: true, label: 'Ordered Quantity', defaultValue: 1 },
    { key: 'listPrice', column: 'PriceList', type: 'number', required: true, label: 'Net List Price' },
    { key: 'discount', column: 'Discount', type: 'number', label: 'Discount', defaultValue: 0 },
    { key: 'tax', column: 'C_Tax_ID', type: 'selector', required: true, label: 'Tax', reference: 'Tax', inputMode: 'selector', forceCalloutFields: ["lineGrossAmount","grossUnitPrice","lineNetAmount"] },
  ],
  derived: [

  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:quotationLine

export const api = {
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
      "url": "/sws/neo/sales-quotation/quotation/selectors/partnerAddress",
      "context": {
        "required": [
          {
            "param": "C_BPartner_ID",
            "source": "field",
            "field": "businessPartner"
          }
        ]
      }
    },
    {
      "entity": "quotation",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/priceList",
      "context": {
        "required": [
          {
            "param": "isSOTrx",
            "source": "windowCategory"
          }
        ]
      }
    },
    {
      "entity": "quotation",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-quotation/quotation/selectors/paymentMethod",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          }
        ]
      }
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
      "url": "/sws/neo/sales-quotation/quotationLine/selectors/tax",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          },
          {
            "param": "DateInvoiced",
            "source": "parentField",
            "field": "invoiceDate",
            "fallbackField": "orderDate",
            "format": "DD-MM-YYYY"
          }
        ]
      }
    }
  ],
  "actions": [
    {
      "name": "rMPickFromShipment",
      "entity": "quotation",
      "column": "RM_PickFromShipment",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMPickFromShipment",
      "processId": "A2C19D0EF6594D14A64BC62E99A89CC3",
      "processType": "obuiapp"
    },
    {
      "name": "rMReceiveMaterials",
      "entity": "quotation",
      "column": "RM_ReceiveMaterials",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMReceiveMaterials"
    },
    {
      "name": "rMCreateInvoice",
      "entity": "quotation",
      "column": "RM_CreateInvoice",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMCreateInvoice",
      "processId": "FF80808133362F6A013336781FCE0066",
      "processType": "classic"
    },
    {
      "name": "copyFrom",
      "entity": "quotation",
      "column": "CopyFrom",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/copyFrom",
      "processId": "211",
      "processType": "classic"
    },
    {
      "name": "copyFromPO",
      "entity": "quotation",
      "column": "CopyFromPO",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/copyFromPO",
      "processId": "8B81D80B06364566B87853FEECAB5DE0",
      "processType": "obuiapp"
    },
    {
      "name": "documentAction",
      "entity": "quotation",
      "column": "DocAction",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/documentAction",
      "processId": "104",
      "processType": "classic"
    },
    {
      "name": "createOrder",
      "entity": "quotation",
      "column": "Convertquotation",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/createOrder",
      "processId": "A3FE1F9892394386A49FB707AA50A0FA",
      "processType": "classic"
    },
    {
      "name": "calculatePromotions",
      "entity": "quotation",
      "column": "Calculate_Promotions",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/calculatePromotions",
      "processId": "9EB2228A60684C0DBEC12D5CD8D85218",
      "processType": "classic"
    },
    {
      "name": "generateTemplate",
      "entity": "quotation",
      "column": "Generatetemplate",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/generateTemplate",
      "processId": "800022",
      "processType": "classic"
    },
    {
      "name": "processNow",
      "entity": "quotation",
      "column": "Processing",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/processNow",
      "processId": "104",
      "processType": "classic"
    },
    {
      "name": "posted",
      "entity": "quotation",
      "column": "Posted",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/posted",
      "processId": "57496FB9CF9E4E8F847224017941570E",
      "processType": "obuiapp"
    },
    {
      "name": "cancelandreplace",
      "entity": "quotation",
      "column": "Cancelandreplace",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/cancelandreplace",
      "processId": "A2FAF49712D1445ABE750315CE1B473A",
      "processType": "obuiapp"
    },
    {
      "name": "confirmcancelandreplace",
      "entity": "quotation",
      "column": "Confirmcancelandreplace",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/confirmcancelandreplace",
      "processId": "0C2AFAEFB67B4CB8A1429195EB119A49",
      "processType": "obuiapp"
    },
    {
      "name": "createPOLines",
      "entity": "quotation",
      "column": "Create_POLines",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/createPOLines",
      "processId": "6995A4C2592D434A9E16B71E1694CBCA",
      "processType": "obuiapp"
    },
    {
      "name": "aPRMAddPayment",
      "entity": "quotation",
      "column": "EM_APRM_AddPayment",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/aPRMAddPayment",
      "processId": "9BED7889E1034FE68BD85D5D16857320",
      "processType": "obuiapp"
    },
    {
      "name": "rMAddOrphanLine",
      "entity": "quotation",
      "column": "RM_AddOrphanLine",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMAddOrphanLine",
      "processId": "23D1B163EC0B41F790CE39BF01DA320E",
      "processType": "classic"
    },
    {
      "name": "rMPickfromreceipt",
      "entity": "quotation",
      "column": "RM_Pickfromreceipt",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotation/{id}/action/rMPickfromreceipt",
      "processId": "A2C19D0EF6594D14A64BC62E99A89CC3",
      "processType": "obuiapp"
    },
    {
      "name": "explode",
      "entity": "quotationLine",
      "column": "Explode",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/explode",
      "processId": "DFC78024B1F54CBB95DC73425BA6687F",
      "processType": "classic"
    },
    {
      "name": "managePrereservation",
      "entity": "quotationLine",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/managePrereservation",
      "processId": "70E42AD47E5F4698A9ACCCAF3EB72B9E",
      "processType": "obuiapp"
    },
    {
      "name": "manageReservation",
      "entity": "quotationLine",
      "column": "Manage_Reservation",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/manageReservation",
      "processId": "5F547560D3DE401AA0B570F22E2C6C06",
      "processType": "obuiapp"
    },
    {
      "name": "selectOrderLine",
      "entity": "quotationLine",
      "column": "Relate_Orderline",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/sales-quotation/quotationLine/{id}/action/selectOrderLine",
      "processId": "C4265E27C8134096B49DFBF69369DFC6",
      "processType": "obuiapp"
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
      "example": "_sortBy=creationDate desc"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  },
  "window": {
    "category": "sales"
  },
  "labelOverrides": {
    "es_ES": {
      "C_BPartner_ID": "Contacto",
      "C_Reject_Reason_ID": "Razón de rechazo"
    },
    "en_US": {
      "C_BPartner_ID": "Contact",
      "C_Reject_Reason_ID": "Reject Reason"
    }
  }
};

// @sf-generated-start component:QuotationPage
export default function QuotationPage({ windowName, recordId, ...props }) {
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
        hideDeleteWhenComplete
        hidePrint
        hideSaveStatuses={["CA","ETGO_CI","CL","VO","CJ"]}
        noHeaderBorder
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "C_Order", config: {} } }]}
        bottomSection={QuotationBottomPanel}
        topbarRight={QuotationTopbarActions}
        menuActions={({ status }) => [
          { key: 'reject', label: 'Reject', destructive: true, visible: ["UE"].includes(status), labelKey: 'rejectQuotation', onClick: () => {}, }
        ]}
        draftMode={draftMode}
        requiredHeaderFields={requiredHeaderFields}
        salesTheme
        labelOverrides={labelOverrides}
        linesLayout="inlineEditable"
        sendDocument
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="quotation"
      Table={QuotationTable}
      entityLabel="Sales Quotation"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="orderDate"
      hidePrint
      labelOverrides={labelOverrides}
      rowQuickActions={{}}
      sendDocument
      {...props}
    />
  );
}
// @sf-generated-end component:QuotationPage
