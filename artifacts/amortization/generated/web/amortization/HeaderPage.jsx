import { useState, useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { toast } from 'sonner';
import HeaderTable from './HeaderTable';
import HeaderForm from './HeaderForm';
import LinesTable from './LinesTable';
import LinesForm from './LinesForm';
import { AttachmentsTab } from '@/components/attachments';
import catalogs from './mockCatalogs';

import HeaderSidebar from '../../../custom/HeaderSidebar';
import AmortizationConfirmModal from '../../../custom/AmortizationConfirmModal';

const breadcrumb = 'Finance / Amortization';

const labelOverrides = {
  "es_ES": {
    "Name": "Nombre",
    "Description": "Descripción",
    "DateAcct": "Fecha contable",
    "StartDate": "Fecha de inicio",
    "Totalamortization": "Amortización total",
    "C_Currency_ID": "Moneda",
    "A_Asset_ID": "Activo",
    "Amortization_Percentage": "% Amortización",
    "Amortizationamt": "Importe amortización",
    "Line": "Nº línea"
  },
  "en_US": {
    "Name": "Name",
    "Description": "Description",
    "DateAcct": "Accounting Date",
    "StartDate": "Starting Date",
    "Totalamortization": "Total Amortization",
    "C_Currency_ID": "Currency",
    "A_Asset_ID": "Asset",
    "Amortization_Percentage": "Amortization %",
    "Amortizationamt": "Amortization Amount",
    "Line": "Line No."
  }
};


// @sf-generated-start summary:header
const summary = [

];

const statusField = null;
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
  "processField": "Processed",
  "processValue": "Y",
  "label": "confirm",
  "disableWhenEmpty": true
};
// @sf-generated-end draftMode:header

// @sf-generated-start requiredHeaderFields:header
const requiredHeaderFields = ['name', 'accountingDate', 'currency'];
// @sf-generated-end requiredHeaderFields:header

// @sf-generated-start addLineFields:lines
const addLineFields = {
  entry: [
    { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', reference: 'Asset', inputMode: 'selector' },
    { key: 'amortizationPercentage', column: 'Amortization_Percentage', type: 'number', label: 'Amortization Percentage' },
    { key: 'amortizationAmount', column: 'Amortizationamt', type: 'number', required: true, label: 'Amortization Amount' },
  ],
  derived: [

  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:lines

export const api = {
  "specName": "amortization",
  "baseUrl": "/sws/neo/amortization",
  "crud": {
    "header": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/amortization/header",
      "detailUrl": "/sws/neo/amortization/header/{id}",
      "supportedFilters": [
        "name",
        "accountingDate",
        "startingDate"
      ]
    },
    "lines": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/amortization/lines",
      "detailUrl": "/sws/neo/amortization/lines/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "header",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/amortization/header/selectors/currency"
    },
    {
      "entity": "lines",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/amortization/lines/selectors/asset"
    },
    {
      "entity": "lines",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/amortization/lines/selectors/currency"
    }
  ],
  "actions": [
    {
      "entity": "header",
      "field": "processed",
      "column": "Processed",
      "url": "/sws/neo/amortization/header/{id}/action/processed",
      "processId": "800134",
      "processType": "classic"
    },
    {
      "entity": "header",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/amortization/header/{id}/action/posted"
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
  },
  "labelOverrides": {
    "es_ES": {
      "Name": "Nombre",
      "Description": "Descripción",
      "DateAcct": "Fecha contable",
      "StartDate": "Fecha de inicio",
      "Totalamortization": "Amortización total",
      "C_Currency_ID": "Moneda",
      "A_Asset_ID": "Activo",
      "Amortization_Percentage": "% Amortización",
      "Amortizationamt": "Importe amortización",
      "Line": "Nº línea"
    },
    "en_US": {
      "Name": "Name",
      "Description": "Description",
      "DateAcct": "Accounting Date",
      "StartDate": "Starting Date",
      "Totalamortization": "Total Amortization",
      "C_Currency_ID": "Currency",
      "A_Asset_ID": "Asset",
      "Amortization_Percentage": "Amortization %",
      "Amortizationamt": "Amortization Amount",
      "Line": "Line No."
    }
  }
};

// @sf-generated-start component:HeaderPage
export default function HeaderPage({ windowName, recordId, ...props }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const draftModeWithConfirm = { ...draftMode, onConfirm: () => setShowConfirmModal(true) };
  if (recordId) {
    return (
      <>
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
        whiteFormBackground
        sidebarClassName="w-[30%] shrink-0 overflow-y-auto border-l border-[#E8EAEF] p-2"
        toolbarButtonSize="default"
        customTabs={[{ key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "A_Amortization", config: {} } }]}
        menuActions={({ data, status }) => [
          { key: 'reactivate', label: 'Reactivate', visible: (data?.processed === 'Y' || data?.processed === true), labelKey: 'reactivate', columnName: 'Processed',  }
        ]}
        draftMode={draftModeWithConfirm}
        requiredHeaderFields={requiredHeaderFields}
        titleField="name"
        labelOverrides={labelOverrides}
        linesLayout="inlineEditable"
        {...props}
        sidebarContent={(data) => (
          <HeaderSidebar
            recordId={recordId}
            data={data}
            token={props.token}
            apiBaseUrl={props.apiBaseUrl}
          />
        )}
      />
      {showConfirmModal && (
        <AmortizationConfirmModal
          recordId={recordId}
          token={props.token}
          apiBaseUrl={props.apiBaseUrl}
          onClose={(success) => {
            setShowConfirmModal(false);
            if (success) window.location.reload();
          }}
        />
      )}
      </>
    );
  }

  return (
    <ListView
      entity="header"
      Table={HeaderTable}
      entityLabel="Amortization"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      hiddenColumns={["processed"]}
      listbarPaddingX="px-2"
      tablePaddingX="px-2"
      hidePrint
      hideLink
      labelOverrides={labelOverrides}
      rowQuickActions={{}}
      {...props}
    />
  );
}
// @sf-generated-end component:HeaderPage
