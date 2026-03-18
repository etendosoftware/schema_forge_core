export default function ArtifactSelector({ artifacts, selected, onChange }) {
  // If no artifacts loaded from API, show manual input
  if (!artifacts || artifacts.length === 0) {
    return (
      <input
        type="text"
        placeholder="artifact name (e.g. business-partner)"
        value={selected ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700 w-56"
      />
    );
  }

  return (
    <select
      value={selected ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700"
    >
      <option value="">Select artifact...</option>
      {artifacts.map(a => (
        <option key={a} value={a}>{a}</option>
      ))}
    </select>
  );
}
