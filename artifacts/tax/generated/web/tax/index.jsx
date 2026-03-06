import TaxTable from './TaxTable';
import TaxForm from './TaxForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <TaxTable data={[]} />
    </div>
  );
}
