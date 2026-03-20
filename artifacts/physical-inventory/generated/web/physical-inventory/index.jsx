import InventoryPage from './InventoryPage';

const windowMeta = { category: 'warehouse', name: 'Physical Inventory' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <InventoryPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
