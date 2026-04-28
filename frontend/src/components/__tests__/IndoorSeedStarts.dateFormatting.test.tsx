import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

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

describe('IndoorSeedStarts date formatting', () => {
  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('renders expected transplant ISO datetime as a valid local date', async () => {
    installFetchMock([
      {
        match: '/api/planting-events/needs-indoor-starts',
        response: { events: [], count: 0 },
      },
      {
        match: '/api/indoor-seed-starts',
        response: [
          {
            id: 91,
            plantId: 'tomato',
            variety: 'Cherokee Purple',
            startDate: '2026-04-01T00:00:00',
            expectedTransplantDate: '2026-05-20T00:00:00',
            seedsStarted: 12,
            status: 'growing',
          },
        ],
      },
      {
        match: '/api/plants',
        response: [{ id: 'tomato', name: 'Tomato' }],
      },
      { match: '/api/seeds', response: [] },
    ]);

    render(
      <ToastProvider>
        <IndoorSeedStarts />
      </ToastProvider>
    );

    await screen.findByTestId('iss-card-91');

    expect(screen.getByText('May 20, 2026')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    });
  });
});
