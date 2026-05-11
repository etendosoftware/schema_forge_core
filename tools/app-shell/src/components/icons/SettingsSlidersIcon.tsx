
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const SettingsSlidersIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.75 8H7.25"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12.75 8H19.25"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.75 16H12.25"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.75 16H19.25"/>
  <circle cx="10" cy="8" r="2.25" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
  <circle cx="15" cy="16" r="2.25" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
</svg>
` }
  });
};

export default SettingsSlidersIcon;
