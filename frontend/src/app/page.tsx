import type { Metadata } from 'next';
import CvCreator from '@/components/cv/CvCreator';

export const metadata: Metadata = {
  title: 'Free Sports CV Maker — Build Your Player CV in 3 Minutes | LinkSports.in',
  description:
    'Create your free digital sports resume. Pick your sport, add your stats and achievements, then download a PDF CV and an Instagram Story card. Football, cricket, badminton, athletics, kabaddi and more.',
  keywords: [
    'Sports CV', 'Free Sports CV', 'Player CV Creator', 'Digital Sports Resume', 'Football CV Maker',
    'Cricket Player Profile', 'Athlete Portfolio India', 'Grassroots Sports Identity', 'Scout Verification Link',
  ],
  alternates: { canonical: 'https://www.linksports.in/' },
  openGraph: {
    title: 'Free Sports CV Maker | LinkSports.in',
    description: 'Build your free sports CV and Instagram Story card in under 3 minutes.',
    url: 'https://www.linksports.in/',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'LinkSports Player CV Creator',
  url: 'https://www.linksports.in/',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  description: 'Free digital sports resume and Instagram Story card maker for Indian athletes.',
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CvCreator />
    </>
  );
}
