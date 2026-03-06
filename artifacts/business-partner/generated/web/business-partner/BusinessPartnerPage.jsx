import { MasterDetailPage } from '@/components/contract-ui';
import BusinessPartnerTable from './BusinessPartnerTable';
import BusinessPartnerForm from './BusinessPartnerForm';
import BpLocationTable from './BpLocationTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const statusField = null;

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'name', label: 'Name', type: 'text', required: true, lookup: true },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'postalCode', label: 'Postal Code', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
  ],
  derived: [

  ],
};

export default function BusinessPartnerPage(props) {
  return (
    <MasterDetailPage
      entity="businessPartner"
      detailEntity="bpLocation"
      Table={BusinessPartnerTable}
      Form={BusinessPartnerForm}
      DetailTable={BpLocationTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Business Partner"
      detailLabel="Bp Location"
      {...props}
    />
  );
}
