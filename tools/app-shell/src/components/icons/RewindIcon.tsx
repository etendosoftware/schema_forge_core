
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const RewindIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 15.8603L19.25 18.25V5.75L16 8.13971"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.75 12L13.25 5.75V18.25L4.75 12Z"/>
</svg>
` }
  });
};

export default RewindIcon;
