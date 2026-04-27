import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import PaymentMethodTable from './PaymentMethodTable';
import PaymentMethodForm from './PaymentMethodForm';
import PaymentGroupsSection from '@/windows/custom/payment-method/PaymentGroupsSection';
import catalogs from './mockCatalogs';


const breadcrumb = 'Settings / Payment Method';

const labelOverrides = {
  "es_ES": {
    "Name": "Nombre",
    "Description": "Descripción",
    "Isactive": "Activo",
    "Payin_Allow": "Cobro permitido",
    "Automatic_Receipt": "Cobro automático",
    "Automatic_Deposit": "Depósito automático",
    "Payout_Allow": "Pago permitido",
    "Automatic_Payment": "Pago automático",
    "Automatic_Withdrawn": "Retiro automático"
  }
};


// @sf-generated-start summary:paymentMethod
const summary = [

];

const statusField = null;
// @sf-generated-end summary:paymentMethod

// @sf-generated-start extraBadges:paymentMethod
const extraBadges = [];
// @sf-generated-end extraBadges:paymentMethod

// @sf-generated-start processes:paymentMethod
const processes = [

];
// @sf-generated-end processes:paymentMethod

// @sf-generated-start draftMode:paymentMethod
const draftMode = null;
// @sf-generated-end draftMode:paymentMethod



export const api = {
  "specName": "payment-method",
  "baseUrl": "/sws/neo/payment-method",
  "crud": {
    "paymentMethod": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/payment-method/paymentMethod",
      "detailUrl": "/sws/neo/payment-method/paymentMethod/{id}",
      "supportedFilters": [
        "name"
      ]
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
    "category": "settings"
  }
};

// @sf-generated-start component:PaymentMethodPage
export default function PaymentMethodPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="paymentMethod"
        Form={PaymentMethodForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        catalogs={catalogs}
        entityLabel="Payment Method"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        hidePrint
        hideMoreMenu
        bottomSection={PaymentGroupsSection}
        labelOverrides={labelOverrides}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="paymentMethod"
      Table={PaymentMethodTable}
      entityLabel="Payment Method"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      hidePrint
      hideMoreMenu
      labelOverrides={labelOverrides}
      {...props}
    />
  );
}
// @sf-generated-end component:PaymentMethodPage
