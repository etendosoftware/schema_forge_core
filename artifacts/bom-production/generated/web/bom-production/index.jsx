import ProductionPage from './ProductionPage';

export default function App({ token, apiBaseUrl, window }) {
  return <ProductionPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
