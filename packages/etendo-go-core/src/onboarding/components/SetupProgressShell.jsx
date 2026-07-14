import React from 'react';

export function SetupProgressShell({ children, background }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#f5f7fb]">
      {background && <div className="h-screen w-14 shrink-0">{background}</div>}

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
        {children}
      </div>
    </div>
  );
}

export default SetupProgressShell;
