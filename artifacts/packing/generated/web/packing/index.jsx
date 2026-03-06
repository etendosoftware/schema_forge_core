import PackingPage from './PackingPage';

export default function App({ token, apiBaseUrl, window }) {
  return <PackingPage token={token} apiBaseUrl={apiBaseUrl} window={window} />;
}
