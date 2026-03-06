import BpLocationTable from './BpLocationTable';
import BpLocationForm from './BpLocationForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <BpLocationTable data={[]} />
    </div>
  );
}
