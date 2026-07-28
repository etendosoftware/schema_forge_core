import React from 'react';

// Keep the persisted-draft failure message consistent across onboarding steps.
export function DraftSaveWarning({ show, message }) {
  if (!show) return null;

  return (
    <div
      role="alert"
      data-testid="draft-save-warning"
      className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
    >
      {message}
    </div>
  );
}

export default DraftSaveWarning;
