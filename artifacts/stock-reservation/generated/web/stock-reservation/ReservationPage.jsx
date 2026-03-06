import { MasterDetailPage } from '@/components/contract-ui';
import ReservationTable from './ReservationTable';
import ReservationForm from './ReservationForm';
import ReservationStockTable from './ReservationStockTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'releasedQty', label: 'Released Qty', type: 'number' },
  { key: 'uom', label: 'Uom', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const statusField = 'status';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'locator', label: 'Locator', type: 'selector', required: true, lookup: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'quantity', label: 'Quantity', type: 'number', required: true },
  ],
  derived: [

  ],
};

export default function ReservationPage(props) {
  return (
    <MasterDetailPage
      entity="reservation"
      detailEntity="reservationStock"
      Table={ReservationTable}
      Form={ReservationForm}
      DetailTable={ReservationStockTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Reservation"
      detailLabel="Reservation Stock"
      {...props}
    />
  );
}
