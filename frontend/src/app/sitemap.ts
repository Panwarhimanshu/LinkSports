import { MetadataRoute } from 'next';

// Only the pages that exist and should be found by search engines. Individual player CVs (/cv/{username})
// are indexed through the links players share.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.linksports.in';
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
