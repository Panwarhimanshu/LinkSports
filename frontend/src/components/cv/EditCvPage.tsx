'use client';

import TabPage from '@/components/shell/TabPage';
import EditCv from './EditCv';

/** Edit CV tab. A client component because TabPage takes a render function. */
export default function EditCvPage() {
  return <TabPage tab="edit">{({ profile, save }) => <EditCv profile={profile} save={save} />}</TabPage>;
}
