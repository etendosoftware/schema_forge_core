/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../../artifacts/**/generated/**/*.{js,jsx}',
    // Scan EVERY workspace package source (matches `packages/*` in the root
    // package.json workspaces). UI components live in `packages/app-shell-core/src`
    // and carry classes like `bg-popover` that exist nowhere in the app's own
    // files — without scanning them Tailwind purges those utilities and the
    // popover/calendar surfaces render with a transparent background. Using a
    // generic glob (not a single package) means any future package moved or
    // created under packages/ is covered automatically and never falls out of scope.
    '../../packages/*/src/**/*.{js,jsx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			'accent-highlight': {
  				DEFAULT: 'hsl(var(--accent-highlight))',
  				foreground: 'hsl(var(--accent-highlight-foreground))'
  			},
  			'page-bg': 'hsl(var(--page-bg))',
  			'text-primary': 'hsl(var(--text-primary))',
  			'search-bg': 'hsl(var(--search-bg))',
  			'topbar-icon': 'hsl(var(--topbar-icon))',
  			'topbar-breadcrumb': 'hsl(var(--topbar-breadcrumb))',
  			'text-secondary': 'hsl(var(--text-secondary))',
  			'search-placeholder': 'hsl(var(--search-placeholder))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		zIndex: {
  			60: '60',
  			70: '70',
  		}
  	}
  },
  plugins: [],
};
