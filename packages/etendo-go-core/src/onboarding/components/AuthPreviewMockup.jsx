import React from 'react';

export function AuthPreviewMockup() {
  const baseUrl = import.meta.env?.BASE_URL || '/';
  return (
    <div className="relative mt-8 -mb-12 -mr-12 flex-1 xl:-mr-14">
      <img
        src={`${baseUrl}auth-dashboard-preview.png`}
        alt="Etendo dashboard preview"
        className="absolute inset-0 h-full w-full select-none pointer-events-none object-contain object-right-bottom drop-shadow-[0_28px_56px_rgba(15,23,42,0.16)]"
      />
    </div>
  );
}

export default AuthPreviewMockup;
