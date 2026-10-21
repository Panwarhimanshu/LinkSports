import type { Metadata } from 'next';
import EditCvPage from '@/components/cv/EditCvPage';

export const metadata: Metadata = { title: 'Edit CV', robots: { index: false } };

export default function Page() {
  return <EditCvPage />;
}
