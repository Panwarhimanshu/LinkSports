'use client';

import TabPage from '@/components/shell/TabPage';
import EditCv from './EditCv';
import EditCoachCv from './EditCoachCv';

/** Edit CV tab. A client component because TabPage takes a render function. */
export default function EditCvPage() {
  return <TabPage tab="edit">{({ profile, save, user }) => (user?.role === 'coach' ? <EditCoachCv profile={profile} save={save} /> : <EditCv profile={profile} save={save} />)}</TabPage>;
}
