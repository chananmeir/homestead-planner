/**
 * Regression tests for useProperty (AUDIT-021).
 *
 * Original bug: the module-scoped cached promise resolved to `null` for
 * accounts with no property and was never invalidated, so creating a
 * property after first render did not update consumers.
 *
 * Fix: cache invalidation API + `useSyncExternalStore` so all mounted
 * consumers re-render after `invalidatePrimaryPropertyCache()`.
 *
 * Scenario coverage (per fix-plan section E + acceptance criteria):
 *  1. `useProperty` returns `null` when no property exists, and updates to
 *     the new property after `invalidatePrimaryPropertyCache()` triggers
 *     a re-fetch.
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  useProperty,
  invalidatePrimaryPropertyCache,
  extractZipFromAddress,
  subscribePrimaryPropertyChanged,
  __resetPrimaryPropertyCacheForTests,
} from '../useProperty';
import { installFetchMock, clearFetchMock } from '../../components/Dashboard/testUtils';

describe('useProperty', () => {
  beforeEach(() => {
    // Always start each test with a clean module cache so prior tests cannot
    // leak a resolved property promise into this one.
    act(() => {
      __resetPrimaryPropertyCacheForTests();
    });
  });

  afterEach(() => {
    clearFetchMock();
    act(() => {
      __resetPrimaryPropertyCacheForTests();
    });
  });

  test('returns null on first render then resolves to fetched property', async () => {
    installFetchMock([
      {
        match: '/api/properties',
        response: [
          {
            id: 1,
            name: 'Homestead',
            address: '123 Farm Rd, Town, VT 05001',
            latitude: 43.5,
            longitude: -72.5,
          },
        ],
      },
    ]);

    const { result } = renderHook(() => useProperty());

    // Initial synchronous render: cache empty, returns null.
    expect(result.current).toBeNull();

    // After fetch resolves, hook re-renders with the property.
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.zipCode).toBe('05001');
    expect(result.current?.id).toBe(1);
  });

  test('null cache from "no properties yet" updates after invalidation when a property is created', async () => {
    // First fetch — user has no property.
    const initialMock = installFetchMock([
      { match: '/api/properties', response: [] },
    ]);

    const { result, rerender } = renderHook(() => useProperty());

    // Stays null because the empty-array response resolved the cache to null.
    await waitFor(() => expect(initialMock).toHaveBeenCalled());
    expect(result.current).toBeNull();

    // User creates a property: simulate the save-site contract by invalidating
    // the cache and providing a NEW fetch mock so the next request returns the
    // new property.
    clearFetchMock();
    installFetchMock([
      {
        match: '/api/properties',
        response: [
          {
            id: 42,
            name: 'New Homestead',
            address: '500 Orchard Ln, City, NH 03301',
            latitude: 43.2,
            longitude: -71.5,
          },
        ],
      },
    ]);

    act(() => {
      invalidatePrimaryPropertyCache();
    });

    // Force a re-render so the hook re-reads the now-empty cache and kicks
    // off a fresh fetch.
    rerender();

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.id).toBe(42);
    expect(result.current?.zipCode).toBe('03301');
  });

  test('subscribePrimaryPropertyChanged fires on invalidation', async () => {
    installFetchMock([{ match: '/api/properties', response: [] }]);
    const listener = jest.fn();
    const unsubscribe = subscribePrimaryPropertyChanged(listener);

    // Trigger an invalidation explicitly.
    act(() => {
      invalidatePrimaryPropertyCache();
    });
    expect(listener).toHaveBeenCalled();

    const callsBeforeUnsub = listener.mock.calls.length;
    unsubscribe();
    act(() => {
      invalidatePrimaryPropertyCache();
    });
    // Listener removed — count unchanged.
    expect(listener.mock.calls.length).toBe(callsBeforeUnsub);
  });

  test('extractZipFromAddress handles common shapes and edge cases', () => {
    expect(extractZipFromAddress('123 Farm Rd, Town, VT 05001')).toBe('05001');
    expect(extractZipFromAddress('500 Orchard Ln, City, NH 03301-1234')).toBe('03301');
    expect(extractZipFromAddress(null)).toBeNull();
    expect(extractZipFromAddress(undefined)).toBeNull();
    expect(extractZipFromAddress('')).toBeNull();
    // No five-digit ZIP present
    expect(extractZipFromAddress('No zip here')).toBeNull();
  });
});
