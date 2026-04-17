import ReservationPage from './ReservationPage';

const windowMeta = { category: 'warehouse-transactions', name: 'Stock Reservation' };

export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <ReservationPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} {...rest} />;
}
