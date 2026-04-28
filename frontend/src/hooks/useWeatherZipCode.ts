/**
 * useWeatherZipCode — canonical resolver for the app-wide "weather ZIP".
 *
 * Returns the ZIP that every weather-aware surface (Weather & Alerts,
 * dashboard tile, header location, Garden Designer banner, Planting Calendar
 * frost/soil/maple helpers, planting validation) should use.
 *
 * Resolution precedence is encoded as an ordered array so future overrides
 * (e.g. a manual "use a different location" toggle) become a one-line array
 * reorder:
 *
 *   1. localStorage `weatherZipCode` (kept in sync with the saved property
 *      ZIP by the save flow — see `pinWeatherZip` and `PropertyFormModal`).
 *   2. Primary property ZIP (from `useProperty()`).
 *
 * Per the AUDIT-021 product decision, property save is the source of truth:
 * the save flow overwrites `localStorage.weatherZipCode` with the saved
 * property's ZIP, so a stale pinned value cannot mask the new property ZIP.
 *
 * Listens for:
 *   - `weatherZipCodeChanged` (CustomEvent) — same-tab pin/save updates.
 *   - `storage` event for `weatherZipCode` — cross-tab pin updates.
 *
 * `useProperty` itself is a `useSyncExternalStore` consumer, so property
 * cache invalidation re-renders this hook automatically.
 */
import { useEffect, useState } from 'react';
import { useProperty, PrimaryProperty } from './useProperty';

export type WeatherZipSource = 'pinned' | 'property' | 'none';

export interface WeatherZipResolution {
  zipCode: string;
  source: WeatherZipSource;
  /** True until the property fetch resolves AND there is no pinned ZIP. */
  isLoading: boolean;
}

type ResolutionStep = (prop: PrimaryProperty | null) => { zip: string | null; source: WeatherZipSource };

function readPinnedZip(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('weatherZipCode');
  } catch {
    return null;
  }
}

// Precedence order — swap rows to flip the policy. Property save keeps the
// pinned slot in sync with the saved property ZIP, so the array order is no
// longer load-bearing for "stale pin masks property ZIP". Kept as an array so
// a future manual-override feature is a one-line reorder.
const RESOLUTION_ORDER: ResolutionStep[] = [
  () => {
    const pinned = readPinnedZip();
    return { zip: pinned && pinned.trim() ? pinned.trim() : null, source: 'pinned' };
  },
  (prop) => {
    const zip = prop?.zipCode ?? null;
    return { zip: zip && zip.trim() ? zip.trim() : null, source: 'property' };
  },
];

function resolve(prop: PrimaryProperty | null): { zip: string; source: WeatherZipSource } {
  for (const step of RESOLUTION_ORDER) {
    const { zip, source } = step(prop);
    if (zip) return { zip, source };
  }
  return { zip: '', source: 'none' };
}

export function useWeatherZipCode(): WeatherZipResolution {
  const property = useProperty();
  const [pinTick, setPinTick] = useState(0);

  // Re-resolve when the pinned ZIP changes in the same tab (CustomEvent) or
  // another tab (storage event). The actual read happens fresh on every
  // render via `resolve()`.
  useEffect(() => {
    const bump = () => setPinTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'weatherZipCode') bump();
    };
    window.addEventListener('weatherZipCodeChanged', bump);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('weatherZipCodeChanged', bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Touch pinTick so React tracks it — value is only a re-render trigger.
  void pinTick;

  const { zip, source } = resolve(property);
  // Loading is true only when nothing is resolved yet AND we don't have a
  // pinned override — useProperty is still in flight.
  const pinned = readPinnedZip();
  const isLoading = !zip && !pinned && property === null;

  return { zipCode: zip, source, isLoading };
}

/**
 * Writes a ZIP into the canonical pin locations and notifies same-tab
 * listeners. Mirrors the WeatherAlerts manual-save handler so future
 * writers (property save, future settings UI) cannot drift.
 *
 *   - localStorage `weatherZipCode` (current pin)
 *   - localStorage `weatherZipCode__user_${userId}` (per-user backup, used by
 *     AuthContext to restore on login/session resume)
 *   - dispatches `weatherZipCodeChanged` CustomEvent with the new ZIP
 */
export function pinWeatherZip(zip: string, userId: number | null | undefined): void {
  if (!zip) return;
  try {
    window.localStorage.setItem('weatherZipCode', zip);
    if (userId != null) {
      window.localStorage.setItem(`weatherZipCode__user_${userId}`, zip);
    }
  } catch {
    // Quota / disabled storage — degrade silently; the dispatch below still
    // notifies same-tab listeners for the lifetime of the page.
  }
  window.dispatchEvent(new CustomEvent('weatherZipCodeChanged', { detail: zip }));
}
