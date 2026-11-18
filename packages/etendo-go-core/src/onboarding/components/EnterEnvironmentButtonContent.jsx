import React from 'react';
import { CircleNotchIcon, CaretRightIcon } from '@phosphor-icons/react';

export function EnterEnvironmentButtonContent({ isLoggingIn, label }) {
  if (isLoggingIn) {
    return <CircleNotchIcon className="h-4 w-4 animate-spin" data-testid="Loader2__79cf84" />;
  }

  return (
    <>
      {label} <CaretRightIcon className="h-4 w-4 ml-1" data-testid="ChevronRight__79cf84" />
    </>
  );
}

export default EnterEnvironmentButtonContent;
