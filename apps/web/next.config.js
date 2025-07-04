/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');
const { withAxiom } = require('next-axiom');

const ENV_FILES = ['.env', '.env.local', `.env.${process.env.NODE_ENV || 'development'}`];

ENV_FILES.forEach((file) => {
  require('dotenv').config({
    path: path.join(__dirname, `../../${file}`),
  });
});

// !: This is a temp hack to get caveat working without placing it back in the public directory.
// !: By inlining this at build time we should be able to sign faster.
const FONT_CAVEAT_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/caveat.ttf'),
);

const FONT_NOTO_SANS_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/arial.ttf'),
);

const FONT_DANCING_SCRIPT_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/dancing-script-regular.ttf'),
);

const FONT_GREAT_VIBES_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/great-vibes-regular.ttf'),
);

const FONT_COOKIE_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/cookie-regular.ttf'),
);

const FONT_MONTE_CARLO_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/monte-carlo-regular.ttf'),
);

const FONT_LATO_BYTES = fs.readFileSync(
  path.join(__dirname, '../../packages/assets/fonts/lato-regular.ttf'),
);

/** @type {import('next').NextConfig} */
const config = {
  output: process.env.DOCKER_OUTPUT ? 'standalone' : undefined,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    serverComponentsExternalPackages: ['@node-rs/bcrypt', '@documenso/pdf-sign', 'playwright'],
    serverActions: {
      bodySizeLimit: '200mb',
    },
    swcPlugins: [['@lingui/swc-plugin', {}]],
  },
  reactStrictMode: true,
  transpilePackages: [
    '@documenso/assets',
    '@documenso/ee',
    '@documenso/lib',
    '@documenso/prisma',
    '@documenso/tailwind-config',
    '@documenso/trpc',
    '@documenso/ui',
  ],
  env: {
    APP_VERSION: version,
    NEXT_PUBLIC_PROJECT: 'web',
    FONT_CAVEAT_URI: `data:font/ttf;base64,${FONT_CAVEAT_BYTES.toString('base64')}`,
    FONT_NOTO_SANS_URI: `data:font/ttf;base64,${FONT_NOTO_SANS_BYTES.toString('base64')}`,
    FONT_DANCING_SCRIPT_URI: `data:font/ttf;base64,${FONT_DANCING_SCRIPT_BYTES.toString('base64')}`,
    FONT_GREAT_VIBES_URI: `data:font/ttf;base64,${FONT_GREAT_VIBES_BYTES.toString('base64')}`,
    FONT_COOKIE_URI: `data:font/ttf;base64,${FONT_COOKIE_BYTES.toString('base64')}`,
    FONT_MONTE_CARLO_URI: `data:font/ttf;base64,${FONT_MONTE_CARLO_BYTES.toString('base64')}`,
    FONT_LATO_URI: `data:font/ttf;base64,${FONT_LATO_BYTES.toString('base64')}`,
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
  },
  webpack: (config, { isServer }) => {
    // fixes: Module not found: Can’t resolve ‘../build/Release/canvas.node’
    if (isServer) {
      config.resolve.alias.canvas = false;
    }

    config.module.rules.push({
      test: /\.po$/,
      use: {
        loader: '@lingui/loader',
      },
    });

    return config;
  },
  async rewrites() {
    return [
      {
        source: '/ingest/:path*',
        destination: 'https://eu.posthog.com/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        permanent: true,
        source: '/documents/:id/sign',
        destination: '/sign/:token',
        has: [
          {
            type: 'query',
            key: 'token',
          },
        ],
      },
      {
        permanent: true,
        source: '/documents/:id/signed',
        destination: '/sign/:token',
        has: [
          {
            type: 'query',
            key: 'token',
          },
        ],
      },
    ];
  },
};

module.exports = withAxiom(config);
