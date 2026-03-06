import ProductTable from './ProductTable';
import ProductForm from './ProductForm';

export default function App({ token, apiBaseUrl, window }) {
  return (
    <div>
      <ProductTable data={[]} />
    </div>
  );
}
