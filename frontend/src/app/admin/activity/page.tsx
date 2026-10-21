'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import { Badge, Btn, Card, PageHeader, Select, Table } from '@/components/admin/ui';

const TYPES: [string, string][] = [
  ['', 'All events'], ['USER_SIGNUP', 'Sign-ups'], ['SPORT_SELECTED', 'Sport picked'], ['CV_UPDATED', 'CV updated'],
  ['PHOTOS_UPLOADED', 'Photos uploaded'], ['PDF_DOWNLOADED', 'PDF downloads'], ['STORY_CARD_EXPORTED', 'Story cards'], ['PROFILE_SHARED', 'Profile shared'],
];

export default function AdminActivityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [type, setType] = useState('');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminAPI.getCvActivity({ limit }).then((r) => setEvents(r.data.data || [])).catch(() => setEvents([])).finally(() => setLoading(false));
  }, [limit]);

  const rows = type ? events.filter((e) => e.action === type) : events;

  return (
    <>
      <PageHeader title="Activity" subtitle="Live log of what players do on the website and the app." />
      <Card actions={<Select label="Event type" value={type} onChange={setType} options={TYPES} />} title={`${rows.length} events`}>
        <Table head={['When', 'Player', 'Event', 'Sport', 'Device']} loading={loading} empty={!rows.length}>
          {rows.map((e) => (
            <tr key={e.event_id}>
              <td className="px-5 py-3 whitespace-nowrap text-gray-500">{new Date(e.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="px-5 py-3 font-medium text-gray-900">{e.player_name || '—'}</td>
              <td className="px-5 py-3"><Badge value="applied" label={String(e.action).toLowerCase().replace(/_/g, ' ')} /></td>
              <td className="px-5 py-3 text-gray-600">{e.sport || '—'}</td>
              <td className="px-5 py-3 text-gray-600">{e.metadata?.device || e.metadata?.format || '—'}</td>
            </tr>
          ))}
        </Table>
        {limit < 200 && events.length >= limit && (
          <div className="mt-4"><Btn variant="outline" onClick={() => setLimit(200)}>Load more</Btn></div>
        )}
      </Card>
    </>
  );
}
