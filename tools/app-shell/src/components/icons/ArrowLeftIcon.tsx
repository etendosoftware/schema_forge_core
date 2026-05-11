
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const ArrowLeftIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.25 6.75L4.75 12L10.25 17.25"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.25 12H5"/>
</svg>
` }
  });
};

export default ArrowLeftIcon;
