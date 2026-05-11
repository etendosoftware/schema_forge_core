
import React from 'react';
import type { IconProps } from '@iconicapp/iconic-react';

const UndoIcon = ({ size=24, color = "#FFFFFF", ...props }: IconProps): React.ReactElement | null => {
  return React.createElement('svg', {
    width: size,
    height: size,
    color: color,
    fill: 'transparent',
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
    dangerouslySetInnerHTML: { __html: `
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.25 4.75L4.75 9L9.25 13.25"/>
  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5.5 9H15.25C17.4591 9 19.25 10.7909 19.25 13V19.25"/>
</svg>
` }
  });
};

export default UndoIcon;
