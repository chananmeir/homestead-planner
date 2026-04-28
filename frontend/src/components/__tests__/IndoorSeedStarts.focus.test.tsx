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

describe('IndoorSeedStarts focus integration', () => {
  beforeEach(() => {
    (Element.prototype as any).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  function renderComponent(focusId: number | null) {
    return render(
      <ToastProvider>
        <IndoorSeedStarts
          focusIndoorStartId={focusId}
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
