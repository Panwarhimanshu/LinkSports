import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // private app screens and the admin area
      disallow: ['/edit', '/me', '/admin', '/auth/'],
    },
    sitemap: 'https://www.linksports.in/sitemap.xml',
  };
}
