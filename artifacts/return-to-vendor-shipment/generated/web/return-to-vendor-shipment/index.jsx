import ReturnShipmentPage from './ReturnShipmentPage';

const windowMeta = { category: 'procurement', name: 'Return to Vendor Shipment' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <ReturnShipmentPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
