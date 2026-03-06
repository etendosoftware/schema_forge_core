import PaymentMethodTable from './PaymentMethodTable';
import PaymentMethodForm from './PaymentMethodForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <PaymentMethodTable data={[]} />
    </div>
  );
}
