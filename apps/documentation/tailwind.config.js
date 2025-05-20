/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@documenso/tailwind-config');
const path = require('path');

module.exports = {
  ...baseConfig,
  content: [
    ...baseConfig.content,
    `${path.join(require.resolve('@documenso/ui'), '..')}/**/*.{ts,tsx}`,
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      serif: ['Caveat', 'cursive'],
      dancing: ['"Dancing Script"', 'cursive'],
      greatVibes: ['"Great Vibes"', 'cursive'],
      cookie: ['"Cookie"', 'cursive'],
      monteCarlo: ['"Monte Carlo"', 'cursive'],
      lato: ['"Lato"', 'sans-serif'],
    },
  },
};
