import React from 'react';

export function SetupProgressShell({ children, background }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f7fb]">
      {background && <div className="absolute inset-0">{background}</div>}

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        {children}
      </div>
    </div>
  );
}

export default SetupProgressShell;
