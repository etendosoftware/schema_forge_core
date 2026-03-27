import { ListView, DetailView } from '@/components/contract-ui';
import BusinessPartnerTable from './BusinessPartnerTable';
import BusinessPartnerForm from './BusinessPartnerForm';
import BpLocationTable from './BpLocationTable';
import BpLocationForm from './BpLocationForm';

import BillingPreferencesForm from './BillingPreferencesForm';
import BpBankAccountTable from './BpBankAccountTable';
import BpBankAccountForm from './BpBankAccountForm';
import UserTable from './UserTable';
import UserForm from './UserForm';
import BpartnerDiscountTable from './BpartnerDiscountTable';
import BpartnerDiscountForm from './BpartnerDiscountForm';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'businessPartnerCategory', column: 'C_BP_Group_ID', type: 'string' },
  { key: 'active', column: 'IsActive', type: 'boolean' },
];

const statusField = null;

const processes = [
  { name: 'setNewCurrency', label: 'Set New Currency', style: 'destructive', columnName: 'setNewCurrency' },
];

const addLineFields = {
  entry: [
    { key: 'name', column: 'Name', type: 'text', required: true, lookup: true },
  ],
  derived: [

  ],
};

const userAddLineFields = {
  entry: [
    { key: 'firstName', column: 'Firstname', type: 'text', required: true },
    { key: 'lastName', column: 'Lastname', type: 'text', required: true },
    { key: 'phone', column: 'Phone', type: 'text', required: false },
    { key: 'position', column: 'Title', type: 'text', required: false },
  ],
  derived: []
};

const discountAddLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true },
    { key: 'discount', column: 'C_Discount_ID', type: 'selector', required: true, reference: 'Discount', inputMode: 'selector' },
    { key: 'customer', column: 'IsCustomer', type: 'boolean', required: false },
    { key: 'vendor', column: 'IsVendor', type: 'boolean', required: false },
  ],
  derived: []
};

const bankAccountAddLineFields = {
  entry: [
    { key: 'bankName', column: 'Bank_Name', type: 'text', required: false },
    { key: 'bankFormat', column: 'BankFormat', label: 'Bank Account Format', type: 'select', required: true, options: [
      { value: 'GENERIC', label: 'Use Generic Account No.' },
      { value: 'IBAN', label: 'Use IBAN' },
      { value: 'SWIFT', label: 'Use SWIFT + Generic Account No.' },
    ] },
    { key: 'accountNo', column: 'AccountNo', type: 'text', required: false },
    { key: 'iBAN', column: 'Iban', type: 'text', required: false },
  ],
  derived: []
};

const secondaryTabs = [
  { key: 'billing', label: 'Billing Preferences', isFormTab: true, Form: BillingPreferencesForm },
  { key: 'user', label: 'Contact', isFormTab: false, Table: UserTable, Form: UserForm, addLineFields: userAddLineFields },
  { key: 'bpBankAccount', label: 'Bank Account', isFormTab: false, Table: BpBankAccountTable, Form: BpBankAccountForm, addLineFields: bankAccountAddLineFields },
  { key: 'bpartnerDiscount', label: 'Basic Discount', isFormTab: false, Table: BpartnerDiscountTable, Form: BpartnerDiscountForm, addLineFields: discountAddLineFields },
];

export default function BusinessPartnerPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="bpartner"
        detailEntity="bpartnerLocation"
        Form={BusinessPartnerForm}
        DetailTable={BpLocationTable}
        DetailForm={BpLocationForm}
        secondaryTabs={secondaryTabs}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Contact"
        detailLabel="Location/Address"
        detailTabIndex={3}
        windowName={windowName}
        recordId={recordId}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="bpartner"
      Table={BusinessPartnerTable}
      entityLabel="Contacts"
      windowName={windowName}
      {...props}
    />
  );
}
