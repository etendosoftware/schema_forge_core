import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { toast } from 'sonner';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import OrderBottomPanel from '../../../custom/OrderBottomPanel';
import OrderCreateInvoice from '../../../custom/OrderCreateInvoice';
import OrderDraftChips from '../../../custom/OrderDraftChips';
import OrderReactivateBulkAction from '../../../custom/OrderReactivateBulkAction';
import catalogs from './mockCatalogs';


const breadcrumb = 'Sales / Sales Order';

const labelOverrides = {
  "es_ES": {
    "C_BPartner_ID": "Contacto",
    "DeliveryStatus": "Estado de entrega",
    "InvoiceStatus": "Estado de facturación"
  },
  "en_US": {
    "C_BPartner_ID": "Contact",
    "DeliveryStatus": "Delivery Status",
    "InvoiceStatus": "Invoicing Status"
  }
};


// @sf-generated-start summary:header
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'amount' },
  { key: 'summedLineAmount', column: 'TotalLines', type: 'amount' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:header

// @sf-generated-start extraBadges:header
const extraBadges = [];
// @sf-generated-end extraBadges:header

// @sf-generated-start processes:header
const processes = [

];
// @sf-generated-end processes:header

// @sf-generated-start draftMode:header
const draftMode = {
  "enabled": true,
  "processField": "documentAction",
  "processValue": "CO",
  "label": "soConfirmBtn"
};
// @sf-generated-end draftMode:header

// @sf-generated-start requiredHeaderFields:header
const requiredHeaderFields = ['documentNo', 'orderDate', 'businessPartner', 'partnerAddress', 'priceList', 'paymentTerms', 'grandTotalAmount', 'summedLineAmount'];
// @sf-generated-end requiredHeaderFields:header

// @sf-generated-start addLineFields:lines
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
    { key: 'grossUnitPrice', value: '0' },
  ],
};
// @sf-generated-end addLineFields:lines

export const api = {
  "specName": "sales-order",
  "baseUrl": "/sws/neo/sales-order",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/header",
      "detailUrl": "/sws/neo/sales-order/header/{id}",
      "supportedFilters": [
        "documentNo",
        "orderDate",
        "businessPartner",
        "documentStatus"
      ]
    },
    "lines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/sales-order/lines",
      "detailUrl": "/sws/neo/sales-order/lines/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "header",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/businessPartner"
    },
    {
      "entity": "header",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/sales-order/header/selectors/partnerAddress",
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
      "entity": "header",
      "field": "priceList",
      "column": "M_PriceList_ID",
      "reference": "PriceList",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/priceList",
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
      "entity": "header",
      "field": "paymentMethod",
      "column": "FIN_Paymentmethod_ID",
      "reference": "PaymentMethod",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/paymentMethod",
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
      "entity": "header",
      "field": "paymentTerms",
      "column": "C_PaymentTerm_ID",
      "reference": "PaymentTerm",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/paymentTerms"
    },
    {
      "entity": "header",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/header/selectors/warehouse"
    },
    {
      "entity": "header",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/header/selectors/currency"
    },
    {
      "entity": "lines",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/sales-order/lines/selectors/product"
    },
    {
      "entity": "lines",
      "field": "tax",
      "column": "C_Tax_ID",
      "reference": "Tax",
      "inputMode": "selector",
      "url": "/sws/neo/sales-order/lines/selectors/tax",
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
      "label": "RM_PickFromShipment",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_PickFromShipment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/rMPickFromShipment",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/rMPickFromShipment",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "A2C19D0EF6594D14A64BC62E99A89CC3",
      "processType": "obuiapp"
    },
    {
      "name": "rMReceiveMaterials",
      "label": "RM_ReceiveMaterials",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_ReceiveMaterials",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/rMReceiveMaterials",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/rMReceiveMaterials",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted"
    },
    {
      "name": "rMCreateInvoice",
      "label": "Create Invoice",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_CreateInvoice",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/rMCreateInvoice",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/rMCreateInvoice",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "FF80808133362F6A013336781FCE0066",
      "processType": "classic"
    },
    {
      "name": "aPRMAddPayment",
      "label": "Add Payment",
      "actionType": "paymentAction",
      "entity": "header",
      "column": "EM_APRM_AddPayment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/aPRMAddPayment",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/aPRMAddPayment",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates or processes payment records",
        "May update invoice/order payment status"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Payment amount exceeds remaining balance",
        "Payment method is not configured for the business partner",
        "Invoice is already fully paid"
      ],
      "provenance": "extracted",
      "processId": "9BED7889E1034FE68BD85D5D16857320",
      "processType": "obuiapp"
    },
    {
      "name": "documentAction",
      "label": "Process Order",
      "actionType": "documentAction",
      "entity": "header",
      "column": "DocAction",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/documentAction",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/documentAction",
      "parameters": [
        {
          "name": "docAction",
          "type": "string",
          "required": true,
          "description": "Document action code (e.g. CO=Complete, VO=Void, RE=Reactivate)"
        }
      ],
      "preconditions": [
        {
          "field": "documentStatus",
          "operator": "in",
          "values": [
            "DR",
            "IP"
          ],
          "description": "Document must be in draft or in-progress state"
        }
      ],
      "effects": [
        "Updates document status",
        "May trigger workflow transitions"
      ],
      "dryRunSupported": true,
      "edgeCases": [
        "Document is already completed or closed",
        "Document has pending lines or missing required fields",
        "User lacks permission to execute the action"
      ],
      "provenance": "extracted",
      "processId": "104",
      "processType": "classic"
    },
    {
      "name": "copyFrom",
      "label": "Copy Lines",
      "actionType": "createFrom",
      "entity": "header",
      "column": "CopyFrom",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/copyFrom",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/copyFrom",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "211",
      "processType": "classic"
    },
    {
      "name": "copyFromPO",
      "label": "Copy from Orders",
      "actionType": "createFrom",
      "entity": "header",
      "column": "CopyFromPO",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/copyFromPO",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/copyFromPO",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "8B81D80B06364566B87853FEECAB5DE0",
      "processType": "obuiapp"
    },
    {
      "name": "calculatePromotions",
      "label": "Calculate Promotions",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Calculate_Promotions",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/calculatePromotions",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/calculatePromotions",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "9EB2228A60684C0DBEC12D5CD8D85218",
      "processType": "classic"
    },
    {
      "name": "rMAddOrphanLine",
      "label": "RM_AddOrphanLine",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "RM_AddOrphanLine",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/rMAddOrphanLine",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/rMAddOrphanLine",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "23D1B163EC0B41F790CE39BF01DA320E",
      "processType": "classic"
    },
    {
      "name": "createOrder",
      "label": "Create Order",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Convertquotation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/createOrder",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/createOrder",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "A3FE1F9892394386A49FB707AA50A0FA",
      "processType": "classic"
    },
    {
      "name": "cancelAndReplace",
      "label": "Cancel and Replace",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Cancelandreplace",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/cancelAndReplace",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/cancelAndReplace",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "A2FAF49712D1445ABE750315CE1B473A",
      "processType": "obuiapp"
    },
    {
      "name": "confirmCancelAndReplace",
      "label": "Confirm Cancel and Replace",
      "actionType": "utilityAction",
      "entity": "header",
      "column": "Confirmcancelandreplace",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/confirmCancelAndReplace",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/confirmCancelAndReplace",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "0C2AFAEFB67B4CB8A1429195EB119A49",
      "processType": "obuiapp"
    },
    {
      "name": "processNow",
      "label": "Process Order",
      "actionType": "documentAction",
      "entity": "header",
      "column": "Processing",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/processNow",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/processNow",
      "parameters": [
        {
          "name": "docAction",
          "type": "string",
          "required": true,
          "description": "Document action code (e.g. CO=Complete, VO=Void, RE=Reactivate)"
        }
      ],
      "preconditions": [
        {
          "field": "documentStatus",
          "operator": "in",
          "values": [
            "DR",
            "IP"
          ],
          "description": "Document must be in draft or in-progress state"
        }
      ],
      "effects": [
        "Updates document status",
        "May trigger workflow transitions"
      ],
      "dryRunSupported": true,
      "edgeCases": [
        "Document is already completed or closed",
        "Document has pending lines or missing required fields",
        "User lacks permission to execute the action"
      ],
      "provenance": "extracted",
      "processId": "104",
      "processType": "classic"
    },
    {
      "name": "posted",
      "label": "Posted",
      "actionType": "documentAction",
      "entity": "header",
      "column": "Posted",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/posted",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/posted",
      "parameters": [
        {
          "name": "docAction",
          "type": "string",
          "required": true,
          "description": "Document action code (e.g. CO=Complete, VO=Void, RE=Reactivate)"
        }
      ],
      "preconditions": [
        {
          "field": "documentStatus",
          "operator": "in",
          "values": [
            "DR",
            "IP"
          ],
          "description": "Document must be in draft or in-progress state"
        }
      ],
      "effects": [
        "Updates document status",
        "May trigger workflow transitions"
      ],
      "dryRunSupported": true,
      "edgeCases": [
        "Document is already completed or closed",
        "Document has pending lines or missing required fields",
        "User lacks permission to execute the action"
      ],
      "provenance": "extracted",
      "processId": "57496FB9CF9E4E8F847224017941570E",
      "processType": "obuiapp"
    },
    {
      "name": "generateTemplate",
      "label": "Copy Product Template",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Generatetemplate",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/generateTemplate",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/generateTemplate",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "800022",
      "processType": "classic"
    },
    {
      "name": "createPOLines",
      "label": "Create_POLines",
      "actionType": "createFrom",
      "entity": "header",
      "column": "Create_POLines",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/createPOLines",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/createPOLines",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "6995A4C2592D434A9E16B71E1694CBCA",
      "processType": "obuiapp"
    },
    {
      "name": "rMPickfromreceipt",
      "label": "RM_Pickfromreceipt",
      "actionType": "createFrom",
      "entity": "header",
      "column": "RM_Pickfromreceipt",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/header/{id}/action/rMPickfromreceipt",
      "method": "POST",
      "url": "/sws/neo/sales-order/header/{id}/action/rMPickfromreceipt",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "Creates child or related records",
        "May copy data from source document"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Source document has no valid lines to copy",
        "Target entity already has linked records",
        "Required reference data is missing (price list, warehouse, etc.)"
      ],
      "provenance": "extracted",
      "processId": "A2C19D0EF6594D14A64BC62E99A89CC3",
      "processType": "obuiapp"
    },
    {
      "name": "manageReservation",
      "label": "Manage Reservation",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Manage_Reservation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/lines/{id}/action/manageReservation",
      "method": "POST",
      "url": "/sws/neo/sales-order/lines/{id}/action/manageReservation",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "5F547560D3DE401AA0B570F22E2C6C06",
      "processType": "obuiapp"
    },
    {
      "name": "explode",
      "label": "Explode",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Explode",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/lines/{id}/action/explode",
      "method": "POST",
      "url": "/sws/neo/sales-order/lines/{id}/action/explode",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "DFC78024B1F54CBB95DC73425BA6687F",
      "processType": "classic"
    },
    {
      "name": "selectOrderLine",
      "label": "Select Order Line",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Relate_Orderline",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/lines/{id}/action/selectOrderLine",
      "method": "POST",
      "url": "/sws/neo/sales-order/lines/{id}/action/selectOrderLine",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "C4265E27C8134096B49DFBF69369DFC6",
      "processType": "obuiapp"
    },
    {
      "name": "managePrereservation",
      "label": "Manage_Prereservation",
      "actionType": "utilityAction",
      "entity": "lines",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/sales-order/lines/{id}/action/managePrereservation",
      "method": "POST",
      "url": "/sws/neo/sales-order/lines/{id}/action/managePrereservation",
      "parameters": [],
      "preconditions": [],
      "effects": [
        "May update related records"
      ],
      "dryRunSupported": false,
      "edgeCases": [
        "Required context is missing",
        "User lacks permission",
        "Record is in an incompatible state"
      ],
      "provenance": "extracted",
      "processId": "70E42AD47E5F4698A9ACCCAF3EB72B9E",
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
      "DeliveryStatus": "Estado de entrega",
      "InvoiceStatus": "Estado de facturación"
    },
    "en_US": {
      "C_BPartner_ID": "Contact",
      "DeliveryStatus": "Delivery Status",
      "InvoiceStatus": "Invoicing Status"
    }
  }
};

// @sf-generated-start component:HeaderPage
export default function HeaderPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="header"
        detailEntity="lines"
        Form={HeaderForm}
        DetailTable={LinesTable}
        DetailForm={LinesForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Header"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        hideDeleteWhenComplete
        hidePrint
        noHeaderBorder
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "C_Order", config: {} } }]}
        bottomSection={OrderBottomPanel}
        topbarRight={OrderCreateInvoice}
        topbarExtra={OrderDraftChips}
        menuActions={({ data, status }) => [
          { key: 'reactivate', label: 'Reactivate', visible: status === 'CO' && !data?.hasLinkedDocuments, labelKey: 'reactivate', successKey: 'reactivated', documentAction: 'RE',  }
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
      entity="header"
      Table={HeaderTable}
      entityLabel="Sales Order"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="orderDate"
      bulkActions={(ctx) => <OrderReactivateBulkAction {...ctx} />}
      hidePrint
      labelOverrides={labelOverrides}
      rowQuickActions={{}}
      sendDocument
      {...props}
    />
  );
}
// @sf-generated-end component:HeaderPage
