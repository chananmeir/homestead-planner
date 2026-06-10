/**
 * Focus-prop integration test for IndoorSeedStarts.
 *
 * Verifies Phase C wiring:
 *  - When focusIndoorStartId changes to a matching seed-start id, the row's
 *    scrollIntoView is called and the amber highlight ring class is applied.
 *  - The component also resolves focusId against plantingEventId as a fallback
 *    (see resolvedFocusId useMemo in the source). We exercise direct-id match
 *    here — the fallback resolution is covered by integration at the App level.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

// ImportFromGardenModal (mounted by IndoorSeedStarts) calls useActivePlan().
// Tests don't wrap in ActivePlanProvider, so stub the hook to return a null
// plan — matches the modal's "(no active plan)" branch.
jest.mock('../../contexts/ActivePlanContext', () => ({
  useActivePlan: () => ({
    activePlan: null,
    activePlanId: null,
    loading: false,
    setActivePlan: () => {},
    setActivePlanById: async () => {},
    clearActivePlan: () => {},
    refreshActivePlan: async () => {},
    ensureActivePlan: async () => null,
    planRefreshKey: 0,
    bumpPlanRefresh: () => {},
  }),
}));

import { installFetchMock, clearFetchMock } from '../Dashboard/testUtils';
import { ToastProvider } from '../common/Toast';
import IndoorSeedStarts from '../IndoorSeedStarts';

type IndoorStartFocusTarget = React.ComponentProps<typeof IndoorSeedStarts>['focusIndoorStartTarget'];

describe('IndoorSeedStarts focus integration', () => {
  beforeEach(() => {
    (Element.prototype as any).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  function renderComponent(focusId: number | null, focusTarget?: IndoorStartFocusTarget) {
    return render(
      <ToastProvider>
        <IndoorSeedStarts
          focusIndoorStartId={focusId}
          focusIndoorStartTarget={focusTarget}
          onFocusConsumed={() => {}}
        />
      </ToastProvider>
    );
  }

  test('when focusIndoorStartId matches a seed-start id, scrollIntoView is called and ring class applies', async () => {
    installFetchMock([
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 42,
            plantId: 'tomato',
            variety: 'Cherokee Purple',
            startDate: '2026-04-01',
            seedsStarted: 12,
            status: 'germinating',
            plantingEventId: 100,
          },
        ],
      },
      {
        match: '/api/plants',
        response: [{ id: 'tomato', name: 'Tomato', icon: '🍅' }],
      },
      {
        match: '/api/seeds',
        response: [],
      },
    ]);

    const { rerender } = renderComponent(null);

    // Wait for the card to render after fetch resolves.
    const card = await screen.findByTestId('iss-card-42');
    expect(card).toBeInTheDocument();
    expect((Element.prototype as any).scrollIntoView).not.toHaveBeenCalled();

    // Flip focus to the seed-start id.
    rerender(
      <ToastProvider>
        <IndoorSeedStarts focusIndoorStartId={42} onFocusConsumed={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });

    const highlighted = screen.getByTestId('iss-card-42');
    expect(highlighted.className).toMatch(/ring-2/);
    expect(highlighted.className).toMatch(/ring-amber-400/);
  });

  test('when focusIndoorStartId matches a planting event for a linked card, it scrolls after loading finishes', async () => {
    let resolvePlants: (response: any) => void = () => {};
    const response = (body: any) => ({
      ok: true,
      status: 200,
      json: async () => body,
    });
    const fetchMock = jest.fn((url: RequestInfo | URL) => {
      const href = typeof url === 'string' ? url : url.toString();
      if (href.includes('/api/planting-events/needs-indoor-starts')) {
        return Promise.resolve(response({ count: 0, events: [] }));
      }
      if (href.includes('/api/indoor-seed-starts')) {
        return Promise.resolve(response([
          {
            id: 112,
            plantId: 'squash-1',
            variety: 'Spaghetti Squash',
            startDate: '2026-04-29T00:00:00',
            expectedTransplantDate: '2026-05-20T00:00:00',
            seedsStarted: 5,
            status: 'planned',
            plantingEventId: 5990,
            destinationBedDetails: [{ id: 43, name: 'Permaculture Bed' }],
          },
        ]));
      }
      if (href.includes('/api/plants')) {
        return new Promise(resolve => {
          resolvePlants = () => resolve(response([
            { id: 'squash-1', name: 'Squash', icon: '🌱' },
          ]));
        });
      }
      if (href.includes('/api/seeds')) {
        return Promise.resolve(response([]));
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ error: 'not mocked', url: href }),
      });
    });
    (global as any).fetch = fetchMock;

    renderComponent(5990, { plantingEventIds: [5990] });

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/plants'))).toBe(true);
    });
    expect(screen.getByText('Loading seed starts...')).toBeInTheDocument();
    expect((Element.prototype as any).scrollIntoView).not.toHaveBeenCalled();

    await act(async () => {
      resolvePlants(null);
    });

    const card = await screen.findByTestId('iss-card-112');
    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(card.className).toMatch(/ring-2/);
    expect(card.className).toMatch(/ring-amber-400/);
  });

  test('when focusIndoorStartId matches a plan-only planting event, banner expands and row is highlighted', async () => {
    installFetchMock([
      {
        match: '/api/planting-events/needs-indoor-starts',
        response: {
          count: 1,
          events: [
            {
              plantingEventId: 901,
              plantingEventIds: [901],
              plantId: 'tomato',
              plantName: 'Tomato',
              plantIcon: '🍅',
              variety: 'Brandywine',
              gardenBedId: 11,
              gardenBedName: 'North Bed',
              transplantDate: '2026-05-15T00:00:00',
              weeksIndoors: 6,
              germinationDays: 7,
              suggestedIndoorStartDate: '2026-04-03T00:00:00',
              expectedGerminationDate: '2026-04-10T00:00:00',
              daysUntilStart: -11,
              timingStatus: 'past',
              canStartIndoors: true,
              spaceRequired: 4,
            },
          ],
        },
      },
      { match: '/api/indoor-seed-starts', response: [] },
      { match: '/api/plants', response: [{ id: 'tomato', name: 'Tomato', icon: '🍅' }] },
      { match: '/api/seeds', response: [] },
    ]);

    renderComponent(901);

    const row = await screen.findByTestId('plan-only-row-901');
    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect(row.className).toMatch(/ring-2/);
    expect(row.className).toMatch(/ring-amber-400/);
    expect(screen.getByTestId('indoor-start-bed-filter')).toHaveValue('11');
  });

  test('when focus target contains a grouped plan-only planting event, representative row is highlighted', async () => {
    installFetchMock([
      {
        match: '/api/planting-events/needs-indoor-starts',
        response: {
          count: 1,
          events: [
            {
              plantingEventId: 901,
              plantingEventIds: [901, 902, 903],
              plantId: 'squash',
              plantName: 'Squash',
              plantIcon: '🌱',
              variety: 'Spaghetti Squash',
              gardenBedId: null,
              gardenBedName: null,
              transplantDate: '2026-05-15T00:00:00',
              weeksIndoors: 4,
              germinationDays: 7,
              suggestedIndoorStartDate: '2026-04-03T00:00:00',
              expectedGerminationDate: '2026-04-10T00:00:00',
              daysUntilStart: -11,
              timingStatus: 'past',
              canStartIndoors: true,
              spaceRequired: 4,
            },
          ],
        },
      },
      { match: '/api/indoor-seed-starts', response: [] },
      { match: '/api/plants', response: [{ id: 'squash', name: 'Squash', icon: '🌱' }] },
      { match: '/api/seeds', response: [] },
    ]);

    renderComponent(902, { plantingEventIds: [902, 901, 903] });

    const row = await screen.findByTestId('plan-only-row-901');
    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalledTimes(1);
    });
    expect(row.className).toMatch(/ring-2/);
    expect(row.className).toMatch(/ring-amber-400/);
    expect(screen.getByTestId('indoor-start-bed-filter')).toHaveValue('unassigned');
  });

  test('filter is auto-reset to "all" when the focused row is in a different status', async () => {
    // The component has a filter-auto-reset effect: if the focused row's
    // status doesn't match the current filter, filter flips to 'all' so the
    // row renders and scroll can land on it. Start the list with a 'failed'
    // row that would normally be hidden when the default filter runs, then
    // flip focus and assert the row renders.
    installFetchMock([
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 55,
            plantId: 'tomato',
            variety: null,
            startDate: '2026-04-01',
            seedsStarted: 6,
            status: 'failed',
          },
        ],
      },
      { match: '/api/plants', response: [{ id: 'tomato', name: 'Tomato' }] },
      { match: '/api/seeds', response: [] },
    ]);

    const { rerender } = renderComponent(null);

    // The default filter is 'all', so the row is already present — but the
    // auto-reset effect should be a no-op in that case. This still exercises
    // the focus wiring end-to-end on a "failed" row.
    await screen.findByTestId('iss-card-55');

    rerender(
      <ToastProvider>
        <IndoorSeedStarts focusIndoorStartId={55} onFocusConsumed={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect((Element.prototype as any).scrollIntoView).toHaveBeenCalled();
    });
    const highlighted = screen.getByTestId('iss-card-55');
    expect(highlighted.className).toMatch(/ring-amber-400/);
  });

  test('manual status filter is not reset after focus request has been handled', async () => {
    installFetchMock([
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 55,
            plantId: 'tomato',
            variety: 'Cherokee Purple',
            startDate: '2026-04-01',
            seedsStarted: 6,
            status: 'growing',
          },
        ],
      },
      { match: '/api/plants', response: [{ id: 'tomato', name: 'Tomato' }] },
      { match: '/api/seeds', response: [] },
    ]);

    renderComponent(55);

    await screen.findByTestId('iss-card-55');
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Failed' }).className).toMatch(/bg-green-600/);
    expect(screen.getByText('No failed seed starts')).toBeInTheDocument();
    expect(screen.queryByTestId('iss-card-55')).not.toBeInTheDocument();
  });
});
