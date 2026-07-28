import React from 'react';
import { OnboardingSessionAction } from './OnboardingSessionAction.jsx';

export function PageHeader({ accountName, onLogout, isAuthenticated, logoutLabel, brandLabel }) {
  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4">
      <div className="max-w-2xl mx-auto flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-8 h-8 shrink-0 bg-amber-400 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="min-w-0 truncate font-semibold text-gray-900">{brandLabel}</span>
        </div>
        {isAuthenticated && (
          <div className="flex shrink-0 items-center gap-3">
            {accountName && <span className="max-w-32 min-w-0 truncate text-sm text-gray-500">{accountName}</span>}
            <OnboardingSessionAction onLogout={onLogout} label={logoutLabel} />
          </div>
        )}
      </div>
    </header>
  );
}

export default PageHeader;
