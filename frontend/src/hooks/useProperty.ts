/**
 * useProperty — returns the user's primary property (first in /api/properties),
 * or null if none exists / still loading / the request failed.
 *
 * Used primarily as the second-tier fallback for the weather ZIP resolution
 * chain: pinned `weatherZipCode` in localStorage > primary property ZIP > ''.
 *
 * The Property model does not have a dedicated `zip_code` column; the ZIP is
 * embedded in the free-form `address` string. We extract it with a US 5-digit
 * (optionally +4) regex, matching the backend's own `_extract_zipcode` behavior
 * in `services/geocoding_service.py`.
 *
 * Caching: the underlying fetch is memoized at module scope via a shared
 * Promise so N concurrent consumers issue a single network request per page
 * load. Callers get null during the loading window and a stable object once
 * resolved.
 *
 * Invalidation: app code can call `invalidatePrimaryPropertyCache()` after a
 * property is created, edited, or deleted. Mounted `useProperty()` instances
 * re-render with the freshly fetched property via `useSyncExternalStore`.
 */
import { useSyncExternalStore } from 'react';
import { apiGet } from '../utils/api';

export interface PrimaryProperty {
  id: number;
  name: string;
  address: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Module-level cache so multiple components sharing this hook reuse the same
// fetch instead of each issuing its own /api/properties request.
let cachedPropertyPromise: Promise<PrimaryProperty | null> | null = null;
let cachedProperty: PrimaryProperty | null = null;
// Bump on every invalidation so useSyncExternalStore re-fires getSnapshot and
// returns a new identity, triggering a re-render in mounted consumers.
let cacheVersion = 0;

const propertyChangedListeners = new Set<() => void>();

const US_ZIP_REGEX = /\b(\d{5})(?:-\d{4})?\b/;

/**
 * Extracts a US ZIP from a free-form address string. Mirrors backend
 * `services/geocoding_service.py::_extract_zipcode` — keep both regexes in sync.
 * Exported so save-site code can derive a ZIP without re-deriving the regex.
 */
export function extractZipFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(US_ZIP_REGEX);
  return match ? match[1] : null;
}

async function fetchPrimaryProperty(): Promise<PrimaryProperty | null> {
  try {
    const response = await apiGet('/api/properties');
    if (!response.ok) {
      return null;
    }
    const properties = await response.json();
    if (!Array.isArray(properties) || properties.length === 0) {
      return null;
    }
    const primary = properties[0];
    return {
      id: primary.id,
      name: primary.name,
      address: primary.address ?? null,
      zipCode: extractZipFromAddress(primary.address),
      latitude: primary.latitude ?? null,
      longitude: primary.longitude ?? null,
    };
  } catch {
    // Network error, 401 unauthenticated, malformed response — all degrade
    // to "no property available" so consumers fall through to their empty
    // state instead of crashing.
    return null;
  }
}

function getPrimaryPropertyPromise(): Promise<PrimaryProperty | null> {
  if (!cachedPropertyPromise) {
    cachedPropertyPromise = fetchPrimaryProperty().then((result) => {
      cachedProperty = result;
      // Notify listeners once the initial fetch resolves so subscribers that
      // mounted before the promise resolved receive the eventual value.
      cacheVersion++;
      propertyChangedListeners.forEach((listener) => listener());
      return result;
    });
  }
  return cachedPropertyPromise;
}

/**
 * Clears the cached property promise so the next render re-fetches and
 * notifies all mounted consumers. Safe to call from app code after a
 * property create/edit/delete.
 */
export function invalidatePrimaryPropertyCache(): void {
  cachedPropertyPromise = null;
  cachedProperty = null;
  cacheVersion++;
  propertyChangedListeners.forEach((listener) => listener());
}

/**
 * Subscribe to property cache changes (initial fetch resolution AND
 * invalidations). Returns an unsubscribe function. Used internally by
 * `useProperty` via `useSyncExternalStore`; exposed for non-hook callers
 * that need to react to property changes (rare).
 */
export function subscribePrimaryPropertyChanged(listener: () => void): () => void {
  propertyChangedListeners.add(listener);
  return () => {
    propertyChangedListeners.delete(listener);
  };
}

/**
 * Test-only alias retained for backward compatibility. Delegates to
 * `invalidatePrimaryPropertyCache`.
 */
export function __resetPrimaryPropertyCacheForTests(): void {
  invalidatePrimaryPropertyCache();
}

function subscribe(listener: () => void): () => void {
  return subscribePrimaryPropertyChanged(listener);
}

function getSnapshot(): PrimaryProperty | null {
  // Kick off the fetch on first read; the promise resolution will bump
  // cacheVersion and notify subscribers, causing this snapshot to be re-read.
  if (!cachedPropertyPromise) {
    void getPrimaryPropertyPromise();
  }
  return cachedProperty;
}

function getServerSnapshot(): PrimaryProperty | null {
  return null;
}

/**
 * Returns the user's primary property (or null if they have none / still
 * loading / request failed). Consumers must be prepared for the initial
 * `null` render and should use optional chaining (`property?.zipCode`) at
 * every call site.
 */
export function useProperty(): PrimaryProperty | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Re-export so callers can introspect cache version if needed (mostly tests).
export function __getPrimaryPropertyCacheVersion(): number {
  return cacheVersion;
}
