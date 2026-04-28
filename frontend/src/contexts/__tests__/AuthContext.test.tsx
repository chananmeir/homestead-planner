/**
 * AuthContext register() regression tests (AUDIT-021 retest-failure).
 *
 * Covers the "Expected Fix Direction" #6 register-side scenarios from
 * `weather-zip-propagation-retest-failure.md`:
 *
 *   - Register clears a stale un-namespaced `weatherZipCode` when no per-user
 *     backup exists for the new account.
 *   - Register restores the per-user backup when one exists.
 *   - Register dispatches `weatherZipCodeChanged` exactly once (so resolver
 *     consumers re-evaluate and fall through to the property fallback).
 *
 * The real `useWeatherZipCode` hook is intentionally left unmocked so the
 * register -> dispatch -> resolver chain is exercised end-to-end. Only the
 * fetch boundary is mocked.
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';

import { AuthProvider, useAuth } from '../AuthContext';
import { installFetchMock, clearFetchMock } from '../../components/Dashboard/testUtils';

interface RegisterController {
  current: ((u: string, e: string, p: string) => Promise<void>) | null;
}

function RegisterHarness({ controller }: { controller: RegisterController }) {
  const { register } = useAuth();
  // Expose register through the controller ref so the test body can drive it.
  controller.current = register;
  return null;
}

function renderAuth() {
  const controller: RegisterController = { current: null };
  const utils = render(
    <AuthProvider>
      <RegisterHarness controller={controller} />
    </AuthProvider>
  );
  return { ...utils, controller };
}

describe('AuthContext.register — weather ZIP reset (AUDIT-021)', () => {
  beforeEach(() => {
    localStorage.clear();
    // AuthProvider issues GET /api/auth/check on mount. Mock that as
    // unauthenticated so register() runs in a fresh-session shape. Routes
    // for register() itself are added per-test before the register call.
    installFetchMock([
      { match: '/api/auth/check', response: { error: 'not authenticated' }, status: 401 },
    ]);
  });

  afterEach(() => {
    clearFetchMock();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('register clears stale un-namespaced ZIP when no per-user backup exists', async () => {
    // Pre-condition: a stale pin from a previous browser user/session.
    localStorage.setItem('weatherZipCode', '99999');

    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    // Re-install the fetch mock with both auth/check and auth/register routes
    // (register's POST happens after AuthProvider mounts — installFetchMock
    // resets `global.fetch` so we redo it here with the union of routes).
    installFetchMock([
      { match: '/api/auth/check', response: { error: 'not authenticated' }, status: 401 },
      {
        match: '/api/auth/register',
        response: { user: { id: 99, username: 'newuser', email: 'new@example.com' } },
        status: 200,
      },
    ]);

    try {
      const { controller } = renderAuth();

      // Wait for AuthProvider mount so `register` is wired up.
      await waitFor(() => expect(controller.current).toBeTruthy());

      await act(async () => {
        await controller.current!('newuser', 'new@example.com', 'pw1234567890');
      });

      // No per-user backup exists for user 99 -> stale `weatherZipCode` cleared.
      expect(localStorage.getItem('weatherZipCode')).toBeNull();
      // weatherZipCodeChanged dispatched so same-tab resolver consumers re-render.
      expect(events.length).toBeGreaterThanOrEqual(1);
      // Detail is empty when there's no restored value.
      expect(events[events.length - 1].detail).toBe('');
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }
  });

  test('register restores per-user backup when one exists for the new user id', async () => {
    // Pre-condition: stale current pin AND a per-user backup for the user
    // that's about to be (re-)registered. The backup wins.
    localStorage.setItem('weatherZipCode', '99999');
    localStorage.setItem('weatherZipCode__user_42', '12345');

    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    installFetchMock([
      { match: '/api/auth/check', response: { error: 'not authenticated' }, status: 401 },
      {
        match: '/api/auth/register',
        response: { user: { id: 42, username: 'returner', email: 'r@example.com' } },
        status: 200,
      },
    ]);

    try {
      const { controller } = renderAuth();

      await waitFor(() => expect(controller.current).toBeTruthy());

      await act(async () => {
        await controller.current!('returner', 'r@example.com', 'pw1234567890');
      });

      // Backup wins — current pin overwritten by the per-user backup.
      expect(localStorage.getItem('weatherZipCode')).toBe('12345');
      expect(localStorage.getItem('weatherZipCode__user_42')).toBe('12345');
      // Dispatch fires with the restored ZIP in detail.
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[events.length - 1].detail).toBe('12345');
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }
  });

  test('register dispatches weatherZipCodeChanged exactly once with post-register state', async () => {
    // No prior pin, no backup. Register dispatches exactly once with empty detail.
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('weatherZipCodeChanged', listener);

    installFetchMock([
      { match: '/api/auth/check', response: { error: 'not authenticated' }, status: 401 },
      {
        match: '/api/auth/register',
        response: { user: { id: 7, username: 'solo', email: 's@example.com' } },
        status: 200,
      },
    ]);

    try {
      const { controller } = renderAuth();

      await waitFor(() => expect(controller.current).toBeTruthy());

      await act(async () => {
        await controller.current!('solo', 's@example.com', 'pw1234567890');
      });

      // Exactly one dispatch from the register flow.
      expect(events).toHaveLength(1);
      // Post-register state with no pin and no backup -> empty detail.
      expect(events[0].detail).toBe('');
      // No leftover pin.
      expect(localStorage.getItem('weatherZipCode')).toBeNull();
    } finally {
      window.removeEventListener('weatherZipCodeChanged', listener);
    }
  });
});
