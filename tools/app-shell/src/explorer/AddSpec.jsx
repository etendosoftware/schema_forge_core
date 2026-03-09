import { useState } from 'react';
import { upsertSpec, populateSpec } from './useDiscovery';

export default function AddSpec({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    Name: '',
    SpecType: 'W',
    WindowID: '',
    ProcessID: '',
    ModuleID: '',
    Description: '',
  });
  const [autoPopulate, setAutoPopulate] = useState(true);
  const [includeAllMethods, setIncludeAllMethods] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const result = await upsertSpec(form);
      const specId = result.SpecID;

      let populateMsg = '';
      if (autoPopulate && specId) {
        const popResult = await populateSpec({
          SpecID: specId,
          ModuleID: form.ModuleID,
          IncludeAllMethods: includeAllMethods ? 'Y' : 'N',
          ExcludeSystemColumns: 'Y',
        });
        populateMsg = ` — Populated ${popResult.EntitiesCreated || '?'} entities, ${popResult.FieldsCreated || '?'} fields`;
      }

      setSuccess(`Spec created: ${specId}${populateMsg}`);
      setForm({ Name: '', SpecType: 'W', WindowID: '', ProcessID: '', ModuleID: form.ModuleID, Description: '' });
      onCreated?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2 text-xs text-blue-400 hover:bg-blue-600/10 transition-colors text-left"
      >
        + Add Spec
      </button>
    );
  }

  return (
    <div className="border-b border-zinc-800 p-3 bg-zinc-900/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">New Spec</span>
        <button onClick={() => setOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Close</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={form.Name}
          onChange={e => update('Name', e.target.value)}
          placeholder="Spec name (URL slug)"
          required
          className="w-full bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex gap-2">
          <select
            value={form.SpecType}
            onChange={e => update('SpecType', e.target.value)}
            className="bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
          >
            <option value="W">Window</option>
            <option value="P">Process</option>
          </select>

          {form.SpecType === 'W' ? (
            <input
              value={form.WindowID}
              onChange={e => update('WindowID', e.target.value)}
              placeholder="AD_Window_ID"
              required
              className="flex-1 bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
            />
          ) : (
            <input
              value={form.ProcessID}
              onChange={e => update('ProcessID', e.target.value)}
              placeholder="AD_Process_ID"
              required
              className="flex-1 bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
            />
          )}
        </div>

        <input
          value={form.ModuleID}
          onChange={e => update('ModuleID', e.target.value)}
          placeholder="Module ID"
          required
          className="w-full bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
        />

        <input
          value={form.Description}
          onChange={e => update('Description', e.target.value)}
          placeholder="Description (optional)"
          className="w-full bg-zinc-800 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
        />

        <div className="flex items-center gap-4 text-[10px] text-zinc-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPopulate}
              onChange={e => setAutoPopulate(e.target.checked)}
              className="rounded"
            />
            Auto-populate from AD
          </label>
          {autoPopulate && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAllMethods}
                onChange={e => setIncludeAllMethods(e.target.checked)}
                className="rounded"
              />
              Enable all methods
            </label>
          )}
        </div>

        {error && <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">{error}</div>}
        {success && <div className="text-xs text-green-400 bg-green-900/20 rounded px-2 py-1">{success}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Spec'}
        </button>
      </form>
    </div>
  );
}
