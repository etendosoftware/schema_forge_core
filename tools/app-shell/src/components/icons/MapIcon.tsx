
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const MapIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.75 6.75L9.25 4.75V17.25L4.75 19.25V6.75Z"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.75 6.75L19.25 4.75V17.25L14.75 19.25V6.75Z"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.75 6.75L9.25 4.75V17.25L14.75 19.25V6.75Z"/>
</svg>
` }
  });
};

export default MapIcon;
