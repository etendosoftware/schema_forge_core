import CommissionPage from './CommissionPage';

export default function App({ token, apiBaseUrl, window }) {
  return <CommissionPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
