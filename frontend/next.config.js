const fs = require('fs');
const path = require('path');

// Load the shared <repo>/.env (backend + web + mobile). Existing variables win, so
// hosting-provider env vars and frontend/.env.local still override it.
try {
  const file = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* optional */ }

/** @type {import('next').NextConfig} */
// Browser-side protections sent with every page.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Scripts are left to Next.js (it needs inline bootstrap code), but pages can never be framed, plugins and
  // injected <base> tags are blocked, and forms may only post back to this site.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
      // Old shared profile links keep working: /athlete/{slug} is now the public CV page
      { source: '/athlete/:id', destination: '/cv/:id', permanent: true },
      // The web app is only the player CV now. Old sections go back to the start page
      // (temporary redirects, so a section can come back later without browsers remembering the move).
      ...[
        '/listings', '/jobs', '/search', '/dashboard', '/connections', '/my-connections', '/messages',
        '/notifications', '/settings', '/profile', '/about', '/contact', '/home', '/opportunities',
        '/auth/register', '/auth/select-role', '/auth/google-select-role', '/auth/forgot-password', '/auth/verify-email',
      ].flatMap((path) => [
        { source: path, destination: '/', permanent: false },
        { source: `${path}/:rest*`, destination: '/', permanent: false },
      ]),
      { source: '/org/:path*', destination: '/', permanent: false },
      { source: '/coach/:path*', destination: '/', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.linksports.in',
    NEXT_PUBLIC_DEV_LOGIN: process.env.NEXT_PUBLIC_DEV_LOGIN || 'false',
  },
};

module.exports = nextConfig;
