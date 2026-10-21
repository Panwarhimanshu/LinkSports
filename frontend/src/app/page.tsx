import type { Metadata } from 'next';
import CvCreator from '@/components/cv/CvCreator';

export const metadata: Metadata = {
  title: 'Free Sports CV Maker — Build Your Player CV in 3 Minutes | LinkSports.in',
  description:
    'Create your free digital sports resume. Pick your sport, add your stats and achievements, then download a PDF CV and an Instagram Story card. Football, cricket, badminton, athletics, kabaddi and more.',
  keywords: [
    'Sports CV', 'Free Sports CV', 'Create Player CV Online', 'Digital Sports Resume India', 'Football Player CV',
    'Cricket Profile Maker', 'Athlete Portfolio PDF', 'LinkSports Player Profile',
  ],
  alternates: { canonical: 'https://www.linksports.in/' },
  openGraph: {
    title: 'Free Sports CV Maker | LinkSports.in',
    description: 'Build your free sports CV and Instagram Story card in under 3 minutes.',
    url: 'https://www.linksports.in/',
    type: 'website',
  },
};

// The app itself plus the organisation behind it, so search engines and AI assistants can tie "free Sports CV" to LinkSports.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'LinkSports Player CV Creator',
      url: 'https://www.linksports.in/',
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      description: 'Free digital sports resume and Instagram Story card maker for Indian athletes.',
    },
    {
      '@type': 'SportsOrganization',
      name: 'LinkSports',
      url: 'https://www.linksports.in/',
      logo: 'https://www.linksports.in/logo.png',
      areaServed: { '@type': 'Country', name: 'India' },
      description: "India's sports networking platform: free Sports CVs for players, coaches and academies.",
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CvCreator />
    </>
  );
}
