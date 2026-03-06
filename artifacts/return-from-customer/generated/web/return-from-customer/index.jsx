import CustomerReturnPage from './CustomerReturnPage';

export default function App({ token, apiBaseUrl, window }) {
  return <CustomerReturnPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
