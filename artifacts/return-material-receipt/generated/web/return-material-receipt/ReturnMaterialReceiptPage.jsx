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
      "entity": "returnMaterialReceipt",
      "column": "RM_Receipt_PickEdit",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/receiveMaterials",
      "processId": "5E9F9D7EECC24E4FBB2C60840FF613BE",
      "processType": "obuiapp"
    },
    {
      "name": "createLinesFrom",
      "entity": "returnMaterialReceipt",
      "column": "CreateFrom",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/createLinesFrom"
    },
    {
      "name": "documentAction",
      "entity": "returnMaterialReceipt",
      "column": "DocAction",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/documentAction",
      "processId": "109",
      "processType": "classic"
    },
    {
      "name": "posted",
      "entity": "returnMaterialReceipt",
      "column": "Posted",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/posted"
    },
    {
      "name": "calculateFreight",
      "entity": "returnMaterialReceipt",
      "column": "Calculate_Freight",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/calculateFreight",
      "processId": "800141",
      "processType": "classic"
    },
    {
      "name": "sendMaterials",
      "entity": "returnMaterialReceipt",
      "column": "RM_Shipment_Pickedit",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/sendMaterials",
      "processId": "4AD70293357245AB96E59C2CDB43A35D",
      "processType": "obuiapp"
    },
    {
      "name": "generateTo",
      "entity": "returnMaterialReceipt",
      "column": "GenerateTo",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/generateTo",
      "processId": "154",
      "processType": "classic"
    },
    {
      "name": "updateLines",
      "entity": "returnMaterialReceipt",
      "column": "UpdateLines",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/updateLines",
      "processId": "800010",
      "processType": "classic"
    },
    {
      "name": "invoicefromshipment",
      "entity": "returnMaterialReceipt",
      "column": "Invoicefromshipment",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/invoicefromshipment",
      "processId": "62250E8866EA4D96A66C309878DC039E",
      "processType": "obuiapp"
    },
    {
      "name": "processGoodsJava",
      "entity": "returnMaterialReceipt",
      "column": "Process_Goods_Java",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceipt/{id}/action/processGoodsJava",
      "processId": "49DEE812BF0545269781FCEBF2235924",
      "processType": "classic"
    },
    {
      "name": "explode",
      "entity": "returnMaterialReceiptLine",
      "column": "Explode",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/{id}/action/explode",
      "processId": "DAE719940FE9463F8A3E3C401BBAFC53",
      "processType": "classic"
    },
    {
      "name": "managePrereservation",
      "entity": "returnMaterialReceiptLine",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/return-material-receipt/returnMaterialReceiptLine/{id}/action/managePrereservation",
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
