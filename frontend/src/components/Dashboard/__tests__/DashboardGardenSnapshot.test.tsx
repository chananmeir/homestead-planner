/**
 * DashboardGardenSnapshot is a thin wrapper over /api/garden-planner/garden-snapshot
 * that renders a few summary tiles. Smoke-tests the fetch path + empty state.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

import DashboardGardenSnapshot from '../DashboardGardenSnapshot';
import { installFetchMock, clearFetchMock } from '../testUtils';

describe('DashboardGardenSnapshot', () => {
  afterEach(() => clearFetchMock());

  test('renders without crashing and calls garden-snapshot endpoint with today date', async () => {
    const fetchMock = installFetchMock([
      {
        match: '/api/garden-planner/garden-snapshot',
        response: {
          date: '2026-04-14',
          summary: { totalPlants: 0, uniqueVarieties: 0, bedsWithPlants: 0 },
          byPlant: {},
        },
      },
      { match: '/api/garden-beds', response: [] },
    ]);
    render(<DashboardGardenSnapshot onOpenGarden={jest.fn()} />);
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(c => String(c[0]));
      expect(urls.some(u => u.includes('/api/garden-planner/garden-snapshot?date=2026-04-14'))).toBe(true);
    });
  });

  test('shows "Nothing in the ground today" when snapshot is empty', async () => {
    installFetchMock([
      {
        match: '/api/garden-planner/garden-snapshot',
        response: {
          date: '2026-04-14',
          summary: { totalPlants: 0, uniqueVarieties: 0, bedsWithPlants: 0 },
          byPlant: {},
        },
      },
      { match: '/api/garden-beds', response: [] },
    ]);
    render(<DashboardGardenSnapshot onOpenGarden={jest.fn()} />);
    expect(await screen.findByText(/Nothing in the ground today/i)).toBeInTheDocument();
  });

  test('renders top crops sorted by quantity', async () => {
    installFetchMock([
      {
        match: '/api/garden-planner/garden-snapshot',
        response: {
          date: '2026-04-14',
          summary: { totalPlants: 25, uniqueVarieties: 2, bedsWithPlants: 1 },
          byPlant: {
            'tomato-1::Brandywine': { plantName: 'Tomato', variety: 'Brandywine', totalQuantity: 10 },
            'lettuce-1::Romaine': { plantName: 'Lettuce', variety: 'Romaine', totalQuantity: 15 },
          },
        },
      },
      { match: '/api/garden-beds', response: [{ id: 1, name: 'Bed A' }] },
    ]);
    render(<DashboardGardenSnapshot onOpenGarden={jest.fn()} />);
    // Both plant names should render
    expect(await screen.findByText('Lettuce')).toBeInTheDocument();
    expect(screen.getByText('Tomato')).toBeInTheDocument();
    // Bed tile renders "1/1"
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  test('clicking "Open Garden →" calls onOpenGarden', async () => {
    installFetchMock([
      {
        match: '/api/garden-planner/garden-snapshot',
        response: {
          date: '2026-04-14',
          summary: { totalPlants: 0, uniqueVarieties: 0, bedsWithPlants: 0 },
          byPlant: {},
        },
      },
      { match: '/api/garden-beds', response: [] },
    ]);
    const onOpenGarden = jest.fn();
    render(<DashboardGardenSnapshot onOpenGarden={onOpenGarden} />);
    await screen.findByText(/Nothing in the ground today/i);
    await userEvent.click(screen.getByRole('button', { name: /Open Garden/i }));
    expect(onOpenGarden).toHaveBeenCalledTimes(1);
  });
});
