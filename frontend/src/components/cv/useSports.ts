'use client';

import { useEffect, useState } from 'react';
import { settingsAPI } from '@/lib/api';
import { SPORTS } from './sports';

/** Sport names for pickers. The list can be edited in Admin → Site & App Settings; falls back to the built-in list. */
export function useSports(): string[] {
  const [names, setNames] = useState<string[]>(() => SPORTS.map((s) => s.name));
  useEffect(() => {
    settingsAPI.get()
      .then((r) => {
        const fromServer: string[] = r.data.data?.sports || [];
        if (fromServer.length) setNames(fromServer);
      })
      .catch(() => undefined);
  }, []);
  return names;
}
