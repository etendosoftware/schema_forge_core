import QuotationPage from './QuotationPage';

export default function App({ token, apiBaseUrl, window }) {
  return <QuotationPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
