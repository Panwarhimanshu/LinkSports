'use client';

import { Suspense } from 'react';
import OpportunityAdmin from '@/components/admin/OpportunityAdmin';

export default function Page() {
  return <Suspense><OpportunityAdmin kind="job" /></Suspense>;
}
