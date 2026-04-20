import PriceListPage from './PriceListPage';

const windowMeta = { category: 'reference', name: 'Price List' };

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <PriceListPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
// @sf-generated-end component:App
