'use client';

import CvMonitor from '@/components/admin/CvMonitor';
import { PageHeader } from '@/components/admin/ui';

export default function AdminCvPage() {
  return (
    <>
      <PageHeader title="Players & CVs" subtitle="Sign-ups, CV completion and downloads from the CV creator (web + app)." />
      <CvMonitor />
    </>
  );
}
