import BusinessPartnerPage from './BusinessPartnerPage';

export default function App({ token, apiBaseUrl, window }) {
  return <BusinessPartnerPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
