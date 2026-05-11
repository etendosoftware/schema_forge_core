
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const CropIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.75 7.75H15.25C15.8023 7.75 16.25 8.19772 16.25 8.75V19.25"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.25 16.25H8.75C8.19772 16.25 7.75 15.8023 7.75 15.25V4.75"/>
</svg>
` }
  });
};

export default CropIcon;
