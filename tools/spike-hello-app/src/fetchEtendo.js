export async function fetchEtendo(path, opts = {}) {
  const res = await fetch(`/api/etendo${path}`, opts);
  if (!res.ok) throw new Error(`Etendo call failed: ${res.status}`);
  return res.json();
}

export async function fetchMe() {
  const res = await fetch('/api/me');
  if (!res.ok) throw new Error(`me failed: ${res.status}`);
  return res.json();
}
