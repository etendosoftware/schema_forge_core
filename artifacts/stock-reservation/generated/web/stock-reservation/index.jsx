import ReservationPage from './ReservationPage';

export default function App({ token, apiBaseUrl, window }) {
  return <ReservationPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
