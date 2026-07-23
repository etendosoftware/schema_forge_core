import React from 'react';

export function SetupProgressShell({ children, background, headerContent }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb]">
      {background && <div className="absolute inset-0">{background}</div>}

      {headerContent && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end p-4 sm:p-6">
          <div className="pointer-events-auto">{headerContent}</div>
        </div>
      )}

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16 sm:py-20">
        {children}
      </div>
    </div>
  );
}

export default SetupProgressShell;
