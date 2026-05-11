
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const FastForwardIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 15.8603L4.75 18.25V5.75L8 8.13971"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.25 12L10.75 5.75V18.25L19.25 12Z"/>
</svg>
` }
  });
};

export default FastForwardIcon;
