/**
 * Parses a non-ok fetch Response and extracts a human-readable error message.
 * Supports NEO Headless and Etendo JsonDataService error shapes.
 */
export async function extractApiErrorMessage(res) {
  try {
    const data = await res.json();
    if (data?.error?.message) return data.error.message;
    const err = data?.response?.error;
    if (err?.message) return err.message;
    if (typeof err === 'string') return err;
    if (data?.message) return data.message;
  } catch {
    // non-JSON body
  }
  return `Error ${res.status}`;
}
