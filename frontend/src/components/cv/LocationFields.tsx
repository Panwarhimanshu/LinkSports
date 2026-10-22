'use client';

import { useId } from 'react';
import { INDIA_STATES, canonicalState, citiesOf } from '@/lib/india';
import { Field, inputCls } from './ui';

/**
 * State + City. Picking a state fills the City suggestions with that state's cities, and the city is cleared if
 * it doesn't belong to the newly chosen state. City is still free text, so small towns can be typed in.
 */
export default function LocationFields({ state, city, onChange }: {
  state: string; city: string; onChange: (next: { state: string; city: string }) => void;
}) {
  const listId = useId();
  const known = canonicalState(state);
  const cities = citiesOf(state);

  const pickState = (next: string) => {
    const stillValid = cities.length === 0 ? false : citiesOf(next).some((c) => c.toLowerCase() === city.trim().toLowerCase());
    onChange({ state: next, city: stillValid ? city : '' });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="State">
        <select className={inputCls} value={known || state} onChange={(e) => pickState(e.target.value)} autoComplete="address-level1">
          <option value="">Select state</option>
          {/* a saved state that isn't in the list (typo or an older entry) is kept, not lost */}
          {state && !known && <option value={state}>{state}</option>}
          {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="City">
        <input
          className={inputCls}
          list={listId}
          value={city}
          onChange={(e) => onChange({ state, city: e.target.value })}
          placeholder={known ? 'Choose or type' : 'Select state first'}
          autoComplete="address-level2"
        />
        <datalist id={listId}>
          {cities.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Field>
    </div>
  );
}
