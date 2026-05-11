
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const ClockIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <circle cx="12" cy="12" r="7.25" stroke="currentColor" stroke-width="1.5"/>
  <path stroke="currentColor" stroke-width="1.5" d="M12 8V12L14 14"/>
</svg>
` }
  });
};

export default ClockIcon;
