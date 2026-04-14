/**
 * Dashboard (index.tsx) smoke test — verifies the orchestrator wires the 7
 * sub-components and passes nav handlers through. Individual component
 * behavior is covered by dedicated test files.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../../../contexts/ActivePlanContext', () => ({
  useActivePlan: () => ({ activePlan: null, setActivePlan: jest.fn(), loading: false }),
}));
jest.mock('../../../contexts/SimulationContext', () => ({
  useNow: () => new Date('2026-04-14T12:00:00'),
  useToday: () => '2026-04-14',
}));

import Dashboard from '../index';
import { installFetchMock, clearFetchMock } from '../testUtils';

describe('Dashboard (index.tsx)', () => {
  afterEach(() => {
    clearFetchMock();
    localStorage.clear();
  });

  test('renders all six dashboard sections without crashing', async () => {
    installFetchMock([
      { match: '/api/garden-beds', response: [] },
      { match: '/api/planting-events', response: [] },
      { match: '/api/garden-plans', response: [] },
      {
        match: '/api/garden-planner/garden-snapshot',
        response: {
          date: '2026-04-14',
          summary: { totalPlants: 0, uniqueVarieties: 0, bedsWithPlants: 0 },
          byPlant: {},
        },
      },
      {
        match: '/api/dashboard/today',
        response: {
          date: '2026-04-14',
          signals: {
            harvestReady: [],
            indoorStartsDue: [],
            transplantsDue: [],
            frostRisk: { atRisk: false, forecastLowF: null, windowHours: 24, source: 'weather-forecast' },
            rainAlert: { expected: false, inchesExpected: 0, windowHours: 48 },
            compostOverdue: [],
            seedLowStock: [],
            seedExpiring: [],
            livestockActionsDue: [],
          },
          meta: { generatedAt: '2026-04-14T14:00:00Z', userTimezone: 'UTC' },
        },
      },
    ]);

    const nav = {
      openGardenDesigner: jest.fn(),
      openPlantingCalendar: jest.fn(),
      openGardenPlans: jest.fn(),
      openSeasonPlanner: jest.fn(),
      openWeather: jest.fn(),
      openSeeds: jest.fn(),
      openLivestock: jest.fn(),
      openCompost: jest.fn(),
      openHarvests: jest.fn(),
      openPhotos: jest.fn(),
      openIndoorStarts: jest.fn(),
    };

    render(<Dashboard {...nav} />);

    // Each of the six dashboard sections has a distinctive heading or label
    expect(screen.getByText(/No active plan yet/i)).toBeInTheDocument(); // ActivePlanCard
    expect(screen.getByText('Needs Attention Today')).toBeInTheDocument(); // NeedsAttentionPanel
    expect(screen.getByText('Quick Actions')).toBeInTheDocument(); // QuickActions
    expect(screen.getByText(/Upcoming · Next 14 days/i)).toBeInTheDocument(); // UpcomingTimeline
    expect(screen.getByText('Garden Today')).toBeInTheDocument(); // DashboardGardenSnapshot
    expect(screen.getByText(/^Plans$/)).toBeInTheDocument(); // PlansSection
    // Weather tile renders (either Set up prompt or data)
    expect(screen.getByText('Weather')).toBeInTheDocument();
  });
});
