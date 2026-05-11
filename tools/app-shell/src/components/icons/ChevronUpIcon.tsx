
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const ChevronUpIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.25 14.25L12 10.75L8.75 14.25"/>
</svg>
` }
  });
};

export default ChevronUpIcon;
