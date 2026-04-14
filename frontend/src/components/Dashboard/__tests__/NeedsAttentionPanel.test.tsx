/**
 * NeedsAttentionPanel wires GET /api/dashboard/today and renders prioritized
 * signal rows with deep-link handlers.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

jest.mock('../../../contexts/SimulationContext', () => ({
  useToday: () => '2026-04-14',
}));

import NeedsAttentionPanel from '../NeedsAttentionPanel';
import type { NeedsAttentionNavHandlers } from '../NeedsAttentionPanel';
import { installFetchMock, clearFetchMock } from '../testUtils';
import type { DashboardToday } from '../types';

const makeNav = (): NeedsAttentionNavHandlers => ({
  onViewCalendar: jest.fn(),
  onViewHarvests: jest.fn(),
  onViewIndoorStarts: jest.fn(),
  onViewCompost: jest.fn(),
  onViewSeeds: jest.fn(),
  onViewLivestock: jest.fn(),
  onViewWeather: jest.fn(),
  onViewGardenDesigner: jest.fn(),
});

const emptyPayload = (): DashboardToday => ({
  date: '2026-04-14',
  signals: {
    harvestReady: [],
    indoorStartsDue: [],
    transplantsDue: [],
    frostRisk: { atRisk: false, forecastLowF: null, windowHours: 24, source: 'weather-forecast' },
    rainAlert: { expected: false, inchesExpected: 0.0, windowHours: 48 },
    compostOverdue: [],
    seedLowStock: [],
    seedExpiring: [],
    livestockActionsDue: [],
  },
  meta: { generatedAt: '2026-04-14T14:00:00Z', userTimezone: 'UTC' },
});

describe('NeedsAttentionPanel', () => {
  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('renders loading skeleton before fetch resolves', async () => {
    installFetchMock([{ match: '/api/dashboard/today', response: emptyPayload() }]);
    render(<NeedsAttentionPanel {...makeNav()} />);
    expect(screen.getByTestId('needs-attention-loading')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('needs-attention-loading')).not.toBeInTheDocument();
    });
  });

  test('renders "All clear" when all signal arrays are empty', async () => {
    installFetchMock([{ match: '/api/dashboard/today', response: emptyPayload() }]);
    render(<NeedsAttentionPanel {...makeNav()} />);
    await waitFor(() => {
      expect(screen.getByText(/All clear/i)).toBeInTheDocument();
    });
  });

  test('renders rows for each non-empty signal category', async () => {
    const payload = emptyPayload();
    payload.signals.harvestReady = [
      { plantingEventId: 7, plantName: 'Lettuce', variety: 'Buttercrunch', bedId: 3, bedName: 'Bed Alpha', quantity: 12, daysPastExpected: 4 },
    ];
    payload.signals.transplantsDue = [
      { plantingEventId: 11, plantName: 'Tomato', variety: 'Cherokee Purple', transplantDate: '2026-04-14', quantity: 4, bedId: 4, bedName: 'Bed Beta' },
    ];
    payload.signals.compostOverdue = [
      { pileId: 5, pileName: 'Main', daysSinceLastTurn: 13, turnFrequencyDays: 7 },
    ];

    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
    render(<NeedsAttentionPanel {...makeNav()} />);

    await waitFor(() => {
      expect(screen.getByText(/Harvest ready/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Transplant due/i)).toBeInTheDocument();
    expect(screen.getByText(/Compost overdue/i)).toBeInTheDocument();
  });

  test('renders frost risk + rain alert rows when flags are true', async () => {
    const payload = emptyPayload();
    payload.signals.frostRisk = { atRisk: true, forecastLowF: 28, windowHours: 24, source: 'weather-forecast' };
    payload.signals.rainAlert = { expected: true, inchesExpected: 0.65, windowHours: 48 };

    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
    render(<NeedsAttentionPanel {...makeNav()} />);

    await waitFor(() => {
      expect(screen.getByText(/Frost risk.*28/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Rain expected.*0\.65/i)).toBeInTheDocument();
  });

  test('renders error state with retry button on fetch failure', async () => {
    installFetchMock([{ match: '/api/dashboard/today', response: {}, status: 500, ok: false }]);
    render(<NeedsAttentionPanel {...makeNav()} />);

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load today's signals/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  test('row click fires the matching nav handler', async () => {
    const payload = emptyPayload();
    payload.signals.harvestReady = [
      { plantingEventId: 7, plantName: 'Lettuce', variety: null, bedId: 3, bedName: 'Bed Alpha', quantity: 12, daysPastExpected: 4 },
    ];
    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);

    const nav = makeNav();
    render(<NeedsAttentionPanel {...nav} />);

    await waitFor(() => {
      expect(screen.getByText(/Harvest ready/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Harvest ready/i));
    expect(nav.onViewHarvests).toHaveBeenCalledTimes(1);
  });

  test('fetch URL respects API_BASE_URL and passes the simulated date param', async () => {
    const fetchMock = installFetchMock([{ match: '/api/dashboard/today', response: emptyPayload() }]);
    render(<NeedsAttentionPanel {...makeNav()} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const calledUrl = String((fetchMock.mock.calls[0] as any[])[0]);
    expect(calledUrl).toMatch(/\/api\/dashboard\/today\?date=2026-04-14/);
  });

  test('caps visible rows at 5 with a "+ N more" toggle that expands', async () => {
    const payload = emptyPayload();
    // Build 7 harvest-ready rows so we exceed the DEFAULT_VISIBLE cap of 5.
    payload.signals.harvestReady = Array.from({ length: 7 }, (_, i) => ({
      plantingEventId: 100 + i,
      plantName: `Crop ${i}`,
      variety: null,
      bedId: null,
      bedName: null,
      quantity: 1,
      daysPastExpected: 0,
    }));
    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
    render(<NeedsAttentionPanel {...makeNav()} />);

    await waitFor(() => {
      expect(screen.getByText(/Harvest ready — Crop 0/i)).toBeInTheDocument();
    });
    // Only first 5 visible initially.
    expect(screen.getByText(/Harvest ready — Crop 4/i)).toBeInTheDocument();
    expect(screen.queryByText(/Harvest ready — Crop 5/i)).not.toBeInTheDocument();

    // Click expand.
    const moreBtn = screen.getByRole('button', { name: /\+ 2 more/i });
    act(() => { fireEvent.click(moreBtn); });
    expect(screen.getByText(/Harvest ready — Crop 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Harvest ready — Crop 6/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show less/i })).toBeInTheDocument();
  });
});
