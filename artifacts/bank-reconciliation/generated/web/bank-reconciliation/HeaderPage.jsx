import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { toast } from 'sonner';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import catalogs from './mockCatalogs';


const breadcrumb = 'Finance / Bank Reconciliation';


// @sf-generated-start summary:header
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'transactionDate', column: 'TransactionDate', type: 'date' },
  { key: 'endingBalance', column: 'EndingBalance', type: 'amount' },
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
const draftMode = null;
// @sf-generated-end draftMode:header

// @sf-generated-start requiredHeaderFields:header
const requiredHeaderFields = ['documentNo', 'transactionDate', 'documentStatus'];
// @sf-generated-end requiredHeaderFields:header



export const api = {
  "specName": "bank-reconciliation",
  "baseUrl": "/sws/neo/bank-reconciliation",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/bank-reconciliation/header",
      "detailUrl": "/sws/neo/bank-reconciliation/header/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [],
  "actions": [],
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

// @sf-generated-start component:HeaderPage
export default function HeaderPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="header"
        Form={HeaderForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        catalogs={catalogs}
        entityLabel="Header"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        menuActions={({ status }) => [
          { key: 'reconcileGroup', label: 'Reconcile', onClick: () => {}, }
        ]}
        requiredHeaderFields={requiredHeaderFields}
        sendDocument
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="header"
      Table={HeaderTable}
      entityLabel="Bank Reconciliation"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      rowQuickActions={{}}
      sendDocument
      {...props}
    />
  );
}
// @sf-generated-end component:HeaderPage
