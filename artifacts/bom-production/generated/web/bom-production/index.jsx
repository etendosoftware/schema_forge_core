import ProductionPage from './ProductionPage';

const windowMeta = { category: 'warehouse', name: 'BOM Production' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <ProductionPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
