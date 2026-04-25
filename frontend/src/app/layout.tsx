import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@/components/shared/QueryProvider';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import SessionExpiredHandler from '@/components/shared/SessionExpiredHandler';

export const metadata: Metadata = {
  title: { default: 'LinkSports - India\'s Sports Networking Platform', template: '%s | LinkSports' },
  description: 'India\'s first professional sports networking platform. Connecting athletes, coaches, academies, and sports professionals.',
  keywords: ['sports networking', 'athlete profile', 'sports jobs', 'cricket trials', 'football trials', 'sports academy India'],
  openGraph: {
    title: 'LinkSports.in',
    description: 'India\'s Sports Networking Platform - Linking Athletes to Opportunities',
    url: 'https://linksports.in',
    siteName: 'LinkSports',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryClientProvider>
          <SessionExpiredHandler />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#1f2937', color: '#fff', borderRadius: '8px' },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  );
}
