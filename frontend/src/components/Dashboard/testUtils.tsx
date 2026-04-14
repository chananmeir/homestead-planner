/**
 * Shared test utilities for Dashboard component tests.
 *
 * Provides:
 *  - A fetch mock helper that routes by URL substring to a provided response map.
 *  - A small GardenPlan factory for tests.
 *
 * Placed outside __tests__ so Jest's testMatch does not treat it as a test file.
 */
import React, { ReactNode } from 'react';
import type { GardenPlan } from '../../types';

// ---------------------------------------------------------------------------
// Fetch mocking
// ---------------------------------------------------------------------------

export interface FetchRoute {
  match: string | RegExp;
  response: any;
  status?: number;
  ok?: boolean;
}

/**
 * Install a fetch mock that matches request URLs against the provided routes.
 * Unmatched requests return a 404 by default. Returns the jest.Mock so callers
 * can assert on it (e.g. `expect(fetchMock).not.toHaveBeenCalled()`).
 */
export function installFetchMock(routes: FetchRoute[] = []): jest.Mock {
  const mock = jest.fn(async (url: RequestInfo | URL) => {
    const href = typeof url === 'string' ? url : url.toString();
    const route = routes.find(r =>
      typeof r.match === 'string' ? href.includes(r.match) : r.match.test(href)
    );
    if (!route) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'not mocked', url: href }),
      } as any;
    }
    return {
      ok: route.ok ?? (route.status ?? 200) < 400,
      status: route.status ?? 200,
      json: async () => route.response,
    } as any;
  });
  (global as any).fetch = mock;
  return mock;
}

export function clearFetchMock() {
  delete (global as any).fetch;
}

// ---------------------------------------------------------------------------
// Simple GardenPlan factory
// ---------------------------------------------------------------------------

export function makePlan(overrides: Partial<GardenPlan> = {}): GardenPlan {
  return {
    id: 1,
    userId: 1,
    name: '2026 Plan',
    year: 2026,
    strategy: 'manual',
    successionPreference: 'per-seed',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    items: [],
    ...overrides,
  } as GardenPlan;
}

// Harmless wrapper for children prop scenarios
export const Wrap: React.FC<{ children: ReactNode }> = ({ children }) => <>{children}</>;
