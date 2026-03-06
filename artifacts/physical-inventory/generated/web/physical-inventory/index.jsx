import InventoryPage from './InventoryPage';

export default function App({ token, apiBaseUrl, window }) {
  return <InventoryPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
