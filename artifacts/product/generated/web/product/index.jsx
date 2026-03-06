import { SingleEntityPage } from '@/components/contract-ui';
import ProductTable from './ProductTable';
import ProductForm from './ProductForm';
import catalogs from './mockCatalogs';

export default function App(props) {
  return (
    <SingleEntityPage
      entity="product"
      Table={ProductTable}
      Form={ProductForm}
      catalogs={catalogs}
      entityLabel="Product"
      {...props}
    />
  );
}
