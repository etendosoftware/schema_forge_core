import GoodsShipmentPage from './GoodsShipmentPage';

const windowMeta = { category: 'sales', name: 'Goods Shipment' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <GoodsShipmentPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
