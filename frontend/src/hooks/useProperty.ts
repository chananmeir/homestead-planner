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
 */
import { useEffect, useState } from 'react';
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

const US_ZIP_REGEX = /\b(\d{5})(?:-\d{4})?\b/;

function extractZipFromAddress(address: string | null | undefined): string | null {
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
    cachedPropertyPromise = fetchPrimaryProperty();
  }
  return cachedPropertyPromise;
}

/**
 * Returns the user's primary property (or null if they have none / still
 * loading / request failed). Consumers must be prepared for the initial
 * `null` render and should use optional chaining (`property?.zipCode`) at
 * every call site.
 */
export function useProperty(): PrimaryProperty | null {
  const [property, setProperty] = useState<PrimaryProperty | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPrimaryPropertyPromise().then((result) => {
      if (!cancelled) {
        setProperty(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return property;
}
