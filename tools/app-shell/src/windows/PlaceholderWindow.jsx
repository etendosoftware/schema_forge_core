export default function PlaceholderWindow({ token, apiBaseUrl, window: windowConfig }) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: 16 }}>
        {windowConfig?.label || 'Window'} — Placeholder
      </h2>
      <p style={{ color: '#666' }}>
        This is a placeholder. The generated component will replace this.
      </p>
      <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13, marginTop: 16 }}>
        {JSON.stringify({ token: token ? '***' : null, apiBaseUrl, window: windowConfig?.name }, null, 2)}
      </pre>
    </div>
  );
}
