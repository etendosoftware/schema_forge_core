import { useState, useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { toast } from 'sonner';
import FinPaymentTable from './FinPaymentTable';
import FinPaymentForm from './FinPaymentForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import PaymentBottomPanel from '../../../custom/PaymentBottomPanel';
import PaymentActivityToggle from '../../../custom/PaymentActivityToggle';
import NewPaymentModal from '../../../custom/NewPaymentModal';
import catalogs from './mockCatalogs';


const breadcrumb = 'Finance / Payment In';


// @sf-generated-start summary:finPayment
const summary = [

];

const statusField = 'status';
// @sf-generated-end summary:finPayment

// @sf-generated-start extraBadges:finPayment
const extraBadges = [];
// @sf-generated-end extraBadges:finPayment

// @sf-generated-start processes:finPayment
const processes = [
  { name: 'aPRMProcessPayment', label: 'Process Payment', style: 'positive', columnName: 'aPRMProcessPayment',
    displayLogicRaw: "@status@='RPAP'" },
];
// @sf-generated-end processes:finPayment

// @sf-generated-start draftMode:finPayment
const draftMode = null;
// @sf-generated-end draftMode:finPayment

// @sf-generated-start requiredHeaderFields:finPayment
const requiredHeaderFields = [];
// @sf-generated-end requiredHeaderFields:finPayment



export const api = {
  "specName": "payment-in",
  "baseUrl": "/sws/neo/payment-in",
  "crud": {
    "finPayment": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/finPayment",
      "detailUrl": "/sws/neo/payment-in/finPayment/{id}",
      "supportedFilters": [
        "documentNo",
        "paymentDate",
        "businessPartner"
      ]
    },
    "finPaymentScheduleDetail": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-in/finPaymentScheduleDetail",
      "detailUrl": "/sws/neo/payment-in/finPaymentScheduleDetail/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "finPayment",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "reference": "BPartner",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/businessPartner"
    },
    {
      "entity": "finPayment",
      "field": "paymentMethod",
      "column": "Fin_Paymentmethod_ID",
      "reference": "Paymentmethod",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPayment/selectors/paymentMethod"
    },
    {
      "entity": "finPayment",
      "field": "account",
      "column": "Fin_Financial_Account_ID",
      "reference": "Financial_Account",
      "inputMode": "dependent",
      "url": "/sws/neo/payment-in/finPayment/selectors/account",
      "context": {
        "required": [
          {
            "param": "Fin_Paymentmethod_ID",
            "source": "field",
            "field": "paymentMethod"
          }
        ]
      }
    },
    {
      "entity": "finPayment",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "dependent",
      "url": "/sws/neo/payment-in/finPayment/selectors/currency",
      "context": {
        "required": [
          {
            "param": "FIN_Financial_Account_ID",
            "source": "field",
            "field": "account"
          }
        ]
      }
    },
    {
      "entity": "finPaymentScheduleDetail",
      "field": "invoicePaymentSchedule",
      "column": "FIN_Payment_Schedule_Invoice",
      "reference": "Payment_Schedule",
      "inputMode": "search",
      "url": "/sws/neo/payment-in/finPaymentScheduleDetail/selectors/invoicePaymentSchedule"
    }
  ],
  "actions": [
    {
      "name": "aPRMAddScheduledpayments",
      "label": "Add Details",
      "actionType": "paymentAction",
      "entity": "finPayment",
      "column": "EM_Aprm_Add_Scheduledpayments",
      "requiresRecord": true,
      "endpoint": "/sws/neo/payment-in/finPayment/{id}/action/aPRMAddScheduledpayments",
      "method": "POST",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMAddScheduledpayments",
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
      "name": "posted",
      "label": "Posted",
      "actionType": "documentAction",
      "entity": "finPayment",
      "column": "Posted",
      "requiresRecord": true,
      "endpoint": "/sws/neo/payment-in/finPayment/{id}/action/posted",
      "method": "POST",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/posted",
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
      "name": "aPRMProcessPayment",
      "label": "Payment Process",
      "actionType": "paymentAction",
      "entity": "finPayment",
      "column": "EM_APRM_Process_Payment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/payment-in/finPayment/{id}/action/aPRMProcessPayment",
      "method": "POST",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMProcessPayment",
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
      "processId": "6255BE488882480599C81284B70CD9B3",
      "processType": "classic"
    },
    {
      "name": "aprmExecutepayment",
      "label": "Execute Payment",
      "actionType": "paymentAction",
      "entity": "finPayment",
      "column": "EM_Aprm_Executepayment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/payment-in/finPayment/{id}/action/aprmExecutepayment",
      "method": "POST",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aprmExecutepayment",
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
      "processId": "E011F492B0814A74B63CD1F3B9FF0526",
      "processType": "classic"
    },
    {
      "name": "aPRMReversePayment",
      "label": "Reverse Payment",
      "actionType": "documentAction",
      "entity": "finPayment",
      "column": "EM_APRM_ReversePayment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/payment-in/finPayment/{id}/action/aPRMReversePayment",
      "method": "POST",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMReversePayment",
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
      "processId": "29D17F515727436DBCE32BC6CA28382B",
      "processType": "classic"
    },
    {
      "name": "aPRMReconcilePayment",
      "label": "Reconcile Payment",
      "actionType": "paymentAction",
      "entity": "finPayment",
      "column": "EM_APRM_Reconcile_Payment",
      "requiresRecord": true,
      "endpoint": "/sws/neo/payment-in/finPayment/{id}/action/aPRMReconcilePayment",
      "method": "POST",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aPRMReconcilePayment",
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
      "provenance": "extracted"
    },
    {
      "name": "aeatsiiSend",
      "label": "EM_Aeatsii_Send",
      "actionType": "createFrom",
      "entity": "finPayment",
      "column": "EM_Aeatsii_Send",
      "requiresRecord": true,
      "endpoint": "/sws/neo/payment-in/finPayment/{id}/action/aeatsiiSend",
      "method": "POST",
      "url": "/sws/neo/payment-in/finPayment/{id}/action/aeatsiiSend",
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
      "processId": "EA02D79CA1DE4B46909EA6EF64A66B53",
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
    "category": "finance"
  }
};

// @sf-generated-start component:FinPaymentPage
export default function FinPaymentPage({ windowName, recordId, ...props }) {
  const [showNewModal, setShowNewModal] = useState(false);
  if (recordId) {
    return (
      <DetailView
        entity="finPayment"
        Form={FinPaymentForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        catalogs={catalogs}
        entityLabel="Fin Payment"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        documentPreview={{ titlePrefix: 'Payment', pdfUrl: null }}
        hideDeleteWhenComplete
        customTabsAfterBottom
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "FIN_Payment", config: {} } }]}
        bottomSection={PaymentBottomPanel}
        topbarRight={PaymentActivityToggle}
        menuActions={({ status }) => [
          { key: 'reverse', label: 'Reverse Payment', destructive: true, visible: ["RPPC","RPR","RDNC"].includes(status), columnName: 'aPRMReversePayment',  }
        ]}
        salesTheme
        sendDocument
        {...props}
      />
    );
  }

  return (
    <>
    <ListView
      entity="finPayment"
      Table={FinPaymentTable}
      entityLabel="Payment In"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="paymentDate"
      rowQuickActions={{}}
      sendDocument
      {...props}
      onNew={() => setShowNewModal(true)}
    />
    {showNewModal && <NewPaymentModal token={props.token} apiBaseUrl={props.apiBaseUrl} windowName={windowName} onClose={() => setShowNewModal(false)} />}
    </>
  );
}
// @sf-generated-end component:FinPaymentPage
