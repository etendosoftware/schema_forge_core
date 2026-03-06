import PaymentTermTable from './PaymentTermTable';
import PaymentTermForm from './PaymentTermForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <PaymentTermTable data={[]} />
    </div>
  );
}
