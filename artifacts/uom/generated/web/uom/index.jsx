import UomTable from './UomTable';
import UomForm from './UomForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <UomTable data={[]} />
    </div>
  );
}
