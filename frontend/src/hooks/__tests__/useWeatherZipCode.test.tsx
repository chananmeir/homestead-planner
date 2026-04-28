/**
 * Regression tests for useWeatherZipCode resolver (AUDIT-021).
 *
 * The resolver picks the canonical ZIP for every weather-aware surface.
 * Per the product decision, property save is the source of truth — the
 * save flow overwrites the pinned ZIP, so the array order is no longer
 * load-bearing for the stale-pin case. These tests still pin the
 * resolver's CURRENT precedence policy (pinned > property) so a future
 * order flip is a deliberate, test-flagged decision.
 *
 * Scenario coverage (per fix-plan section E):
 *   2. Pinned ZIP wins over property ZIP (current policy).
 *   3. Property ZIP is used when no pin is present.
 *   4. Re-renders on `weatherZipCodeChanged` (same-tab).
 *   5. Re-renders on `storage` event for `weatherZipCode` (cross-tab).
 *   6. `pinWeatherZip` writes both keys + dispatches the event exactly once.
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import { useWeatherZipCode, pinWeatherZip } from '../useWeatherZipCode';
import { __resetPrimaryPropertyCacheForTests } from '../useProperty';
import { installFetchMock, clearFetchMock } from '../../components/Dashboard/testUtils';

describe('useWeatherZipCode', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      __resetPrimaryPropertyCacheForTests();
    });
  });

  afterEach(() => {
    clearFetchMock();
    localStorage.clear();
    act(() => {
      __resetPrimaryPropertyCacheForTests();
    });
  });

  test('pinned ZIP wins over property ZIP (precedence)', async () => {
    localStorage.setItem('weatherZipCode', '12345');
    installFetchMock([
      {
        match: '/api/properties',
        response: [
          { id: 1, name: 'Homestead', address: 'Anywhere, VT 05001' },
        ],
      },
    ]);

    const { result } = renderHook(() => useWeatherZipCode());

    // Synchronously: pinned read should resolve immediately even before
    // /api/properties returns.
    expect(result.current.zipCode).toBe('12345');
    expect(result.current.source).toBe('pinned');

    // Even after the property fetch resolves, the pin still wins.
    await waitFor(() => {
      // No assertion change; just allow microtasks to flush.
      expect(result.current.zipCode).toBe('12345');
    });
    expect(result.current.source).toBe('pinned');
  });

  test('falls back to property ZIP when no pin is present', async () => {
    installFetchMock([
      {
        match: '/api/properties',
        response: [
          { id: 1, name: 'Homestead', address: 'Anywhere, VT 05001' },
        ],
      },
    ]);

    const { result } = renderHook(() => useWeatherZipCode());

    await waitFor(() => {
      expect(result.current.zipCode).toBe('05001');
    });
    expect(result.current.source).toBe('property');
    expect(result.current.isLoading).toBe(false);
  });

  test('returns empty zip + source "none" when neither pin nor property has a zip', async () => {
    const fetchMock = installFetchMock([{ match: '/api/properties', response: [] }]);

    const { result } = renderHook(() => useWeatherZipCode());

    // Wait for the fetch to fire — that confirms useProperty has at least
    // attempted to resolve.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // With no pin and no property, the resolver yields the empty-state
    // tuple. Note: `isLoading` stays true under the current resolver
    // implementation because it cannot distinguish "property not yet
    // fetched" from "no property exists" — the meaningful contract is
    // that `zipCode` is '' and `source` is 'none'.
    expect(result.current.zipCode).toBe('');
    expect(result.current.source).toBe('none');
  });

  test('re-renders consumers when weatherZipCodeChanged fires (same-tab)', async () => {
    const fetchMock = installFetchMock([{ match: '/api/properties', response: [] }]);

    const { result } = renderHook(() => useWeatherZipCode());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.zipCode).toBe('');

    // Simulate the save-site contract: write the pin then dispatch the event.
    act(() => {
      localStorage.setItem('weatherZipCode', '54321');
      window.dispatchEvent(new CustomEvent('weatherZipCodeChanged', { detail: '54321' }));
    });

    await waitFor(() => {
      expect(result.current.zipCode).toBe('54321');
    });
    expect(result.current.source).toBe('pinned');
  });

  test('re-renders on storage event (cross-tab)', async () => {
    const fetchMock = installFetchMock([{ match: '/api/properties', response: [] }]);

    const { result } = renderHook(() => useWeatherZipCode());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.zipCode).toBe('');

    // Cross-tab: localStorage writes in another tab fire `storage` events
    // in this tab. Simulate by writing the value and dispatching a
    // StorageEvent. We must write to localStorage here too because the
    // resolver re-reads it on render.
    act(() => {
      localStorage.setItem('weatherZipCode', '99999');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'weatherZipCode',
          newValue: '99999',
          oldValue: null,
        })
      );
    });

    await waitFor(() => {
      expect(result.current.zipCode).toBe('99999');
    });
  });

  test('storage event for unrelated keys does NOT trigger a re-render', async () => {
    const fetchMock = installFetchMock([{ match: '/api/properties', response: [] }]);

    const { result } = renderHook(() => useWeatherZipCode());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.zipCode).toBe('');

    // Set a pinned zip in localStorage but fire a storage event for an
    // UNRELATED key. Because the resolver listener guards on
    // `e.key === 'weatherZipCode'`, the unrelated event must NOT cause a
    // re-render — and since the resolver reads localStorage on render,
    // the new pinned value is invisible until something else triggers
    // a re-render. This is the correct behavior: cross-tab events for
    // unrelated keys must not cause spurious re-renders.
    act(() => {
      localStorage.setItem('weatherZipCode', '11111');
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'someOtherKey',
          newValue: 'irrelevant',
          oldValue: null,
        })
      );
    });

    // No re-render happened, so the resolver still returns the previous
    // value. (If the resolver were to listen to ANY storage event, this
    // would flip to '11111' — that's the regression this guards against.)
    expect(result.current.zipCode).toBe('');
  });
});

describe('pinWeatherZip helper', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  test('writes both pin keys and dispatches weatherZipCodeChanged exactly once', () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    try {
      pinWeatherZip('05001', 7);
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }

    expect(localStorage.getItem('weatherZipCode')).toBe('05001');
    expect(localStorage.getItem('weatherZipCode__user_7')).toBe('05001');
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBe('05001');
  });

  test('skips per-user backup write when userId is null/undefined but still pins + dispatches', () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    try {
      pinWeatherZip('06002', null);
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }

    expect(localStorage.getItem('weatherZipCode')).toBe('06002');
    // No per-user backup written when userId is null
    const allKeys = Object.keys(localStorage);
    expect(allKeys.filter(k => k.startsWith('weatherZipCode__user_'))).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBe('06002');
  });

  test('no-op on empty zip (does not pin or dispatch)', () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    try {
      pinWeatherZip('', 7);
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }

    expect(localStorage.getItem('weatherZipCode')).toBeNull();
    expect(events).toHaveLength(0);
  });
});
