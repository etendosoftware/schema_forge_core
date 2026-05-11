
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const PillIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.0061 12L12 5.9939C10.3415 4.33537 7.65244 4.33537 5.9939 5.9939C4.33537 7.65244 4.33537 10.3415 5.9939 12L12 18.0061C13.6585 19.6646 16.3476 19.6646 18.0061 18.0061C19.6646 16.3476 19.6646 13.6585 18.0061 12Z"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 15L15 9"/>
</svg>
` }
  });
};

export default PillIcon;
