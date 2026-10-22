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
const nextConfig = {
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
