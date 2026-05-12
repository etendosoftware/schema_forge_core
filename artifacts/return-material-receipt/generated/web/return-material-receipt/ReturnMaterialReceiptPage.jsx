import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import ReturnMaterialReceiptTable from './ReturnMaterialReceiptTable';
import ReturnMaterialReceiptForm from './ReturnMaterialReceiptForm';
import ReturnMaterialReceiptLineTable from './ReturnMaterialReceiptLineTable';
import ReturnMaterialReceiptLineForm from './ReturnMaterialReceiptLineForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import ReturnMaterialReceiptBottomPanel from '../../../custom/ReturnMaterialReceiptBottomPanel';
import catalogs from './mockCatalogs';


const breadcrumb = 'Sales / Return Material Receipt';


// @sf-generated-start summary:returnMaterialReceipt
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'selector' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:returnMaterialReceipt

// @sf-generated-start extraBadges:returnMaterialReceipt
const extraBadges = [];
// @sf-generated-end extraBadges:returnMaterialReceipt

// @sf-generated-start processes:returnMaterialReceipt
const processes = [
  { name: 'Process Receipt', label: 'Process  Receipt', style: 'positive', columnName: 'documentAction' },
];
// @sf-generated-end processes:returnMaterialReceipt

// @sf-generated-start draftMode:returnMaterialReceipt
const draftMode = null;
// @sf-generated-end draftMode:returnMaterialReceipt

// @sf-generated-start requiredHeaderFields:returnMaterialReceipt
const requiredHeaderFields = ['documentNo', 'movementDate', 'businessPartner', 'warehouse', 'partnerAddress'];
// @sf-generated-end requiredHeaderFields:returnMaterialReceipt

// @sf-generated-start addLineFields:returnMaterialReceiptLine
const addLineFields = {
  entry: [
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
  ],
  derived: [

  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:returnMaterialReceiptLine

export const api = {
  "specName": "return-material-receipt",
  "baseUrl": "/sws/neo/return-material-receipt",
  "crud": {
    "returnMaterialReceipt": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-material-receipt/returnMaterialReceipt",
      "detailUrl": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}",
      "supportedFilters": [
        "documentNo",
        "movementDate",
        "businessPartner",
        "documentStatus"
      ]
    },
    "returnMaterialReceiptLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/return-material-receipt/returnMaterialReceiptLine",
      "detailUrl": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "returnMaterialReceipt",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/selectors/businessPartner"
    },
    {
      "entity": "returnMaterialReceipt",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "search",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/selectors/warehouse"
    },
    {
      "entity": "returnMaterialReceipt",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/selectors/partnerAddress",
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
      "entity": "returnMaterialReceipt",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/selectors/salesOrder"
    },
    {
      "entity": "returnMaterialReceiptLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/selectors/product"
    },
    {
      "entity": "returnMaterialReceiptLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "search",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/selectors/uOM"
    },
    {
      "entity": "returnMaterialReceiptLine",
      "field": "salesOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/selectors/salesOrderLine"
    }
  ],
  "actions": [
    {
      "name": "receiveMaterials",
      "label": "Pick/Edit Lines",
      "actionType": "createFrom",
      "entity": "returnMaterialReceipt",
      "column": "RM_Receipt_PickEdit",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/receiveMaterials",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/receiveMaterials",
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
      "processId": "5E9F9D7EECC24E4FBB2C60840FF613BE",
      "processType": "obuiapp"
    },
    {
      "name": "createLinesFrom",
      "label": "Create Lines From",
      "actionType": "createFrom",
      "entity": "returnMaterialReceipt",
      "column": "CreateFrom",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/createLinesFrom",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/createLinesFrom",
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
      "name": "documentAction",
      "label": "Process Shipment",
      "actionType": "documentAction",
      "entity": "returnMaterialReceipt",
      "column": "DocAction",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/documentAction",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/documentAction",
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
      "processId": "109",
      "processType": "classic"
    },
    {
      "name": "posted",
      "label": "Posted",
      "actionType": "documentAction",
      "entity": "returnMaterialReceipt",
      "column": "Posted",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/posted",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/posted",
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
      "provenance": "extracted"
    },
    {
      "name": "calculateFreight",
      "label": "Calculate Freight Amount",
      "actionType": "utilityAction",
      "entity": "returnMaterialReceipt",
      "column": "Calculate_Freight",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/calculateFreight",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/calculateFreight",
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
      "processId": "800141",
      "processType": "classic"
    },
    {
      "name": "sendMaterials",
      "label": "Send Materials",
      "actionType": "createFrom",
      "entity": "returnMaterialReceipt",
      "column": "RM_Shipment_Pickedit",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/sendMaterials",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/sendMaterials",
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
      "processId": "4AD70293357245AB96E59C2CDB43A35D",
      "processType": "obuiapp"
    },
    {
      "name": "generateTo",
      "label": "Generate Invoice from Receipt",
      "actionType": "createFrom",
      "entity": "returnMaterialReceipt",
      "column": "GenerateTo",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/generateTo",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/generateTo",
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
      "processId": "154",
      "processType": "classic"
    },
    {
      "name": "updateLines",
      "label": "Update Attributes from Shipment",
      "actionType": "utilityAction",
      "entity": "returnMaterialReceipt",
      "column": "UpdateLines",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/updateLines",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/updateLines",
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
      "processId": "800010",
      "processType": "classic"
    },
    {
      "name": "invoicefromshipment",
      "label": "Invoicefromshipment",
      "actionType": "utilityAction",
      "entity": "returnMaterialReceipt",
      "column": "Invoicefromshipment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/invoicefromshipment",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/invoicefromshipment",
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
      "processId": "62250E8866EA4D96A66C309878DC039E",
      "processType": "obuiapp"
    },
    {
      "name": "processGoodsJava",
      "label": "Process_Goods_Java",
      "actionType": "utilityAction",
      "entity": "returnMaterialReceipt",
      "column": "Process_Goods_Java",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/processGoodsJava",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/processGoodsJava",
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
      "processId": "49DEE812BF0545269781FCEBF2235924",
      "processType": "classic"
    },
    {
      "name": "explode",
      "label": "Explode",
      "actionType": "utilityAction",
      "entity": "returnMaterialReceiptLine",
      "column": "Explode",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/{id}/action/explode",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/{id}/action/explode",
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
      "processId": "DAE719940FE9463F8A3E3C401BBAFC53",
      "processType": "classic"
    },
    {
      "name": "managePrereservation",
      "label": "Manage_Prereservation",
      "actionType": "utilityAction",
      "entity": "returnMaterialReceiptLine",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "endpoint": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/{id}/action/managePrereservation",
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/{id}/action/managePrereservation",
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
  }
};

// @sf-generated-start component:ReturnMaterialReceiptPage
export default function ReturnMaterialReceiptPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="returnMaterialReceipt"
        detailEntity="returnMaterialReceiptLine"
        Form={ReturnMaterialReceiptForm}
        DetailTable={ReturnMaterialReceiptLineTable}
        DetailForm={ReturnMaterialReceiptLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Return Material Receipt"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "M_InOut", config: {} } }]}
        bottomSection={ReturnMaterialReceiptBottomPanel}
        requiredHeaderFields={requiredHeaderFields}
        linesLayout="inlineEditable"
        sendDocument
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="returnMaterialReceipt"
      Table={ReturnMaterialReceiptTable}
      entityLabel="Return Material Receipt"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="movementDate"
      rowQuickActions={{}}
      sendDocument
      {...props}
    />
  );
}
// @sf-generated-end component:ReturnMaterialReceiptPage
