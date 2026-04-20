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
import type { NeedsAttentionPanelProps } from '../NeedsAttentionPanel';
import { installFetchMock, clearFetchMock } from '../testUtils';
import type { DashboardToday } from '../types';

const makeNav = (): NeedsAttentionPanelProps => ({
  onNavigate: jest.fn(),
});

const emptyPayload = (): DashboardToday => ({
  date: '2026-04-14',
  signals: {
    harvestReady: [],
    indoorStartsDue: [],
    transplantsDue: [],
    directSeedDue: [],
    germinationCheck: [],
    indoorGerminationCheck: [],
    frostRisk: { signalKey: 'frost-risk', atRisk: false, forecastLowF: null, windowHours: 24, source: 'weather-forecast' },
    rainAlert: { signalKey: 'rain-alert', expected: false, inchesExpected: 0.0, windowHours: 48 },
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
      { signalKey: 'harvest:7', plantingEventId: 7, plantName: 'Lettuce', variety: 'Buttercrunch', bedId: 3, bedName: 'Bed Alpha', quantity: 12, daysPastExpected: 4 },
    ];
    payload.signals.transplantsDue = [
      { signalKey: 'transplant:11', plantingEventId: 11, plantName: 'Tomato', variety: 'Cherokee Purple', transplantDate: '2026-04-14', quantity: 4, bedId: 4, bedName: 'Bed Beta' },
    ];
    payload.signals.compostOverdue = [
      { signalKey: 'compost:5', pileId: 5, pileName: 'Main', daysSinceLastTurn: 13, turnFrequencyDays: 7 },
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
    payload.signals.frostRisk = { signalKey: 'frost-risk', atRisk: true, forecastLowF: 28, windowHours: 24, source: 'weather-forecast' };
    payload.signals.rainAlert = { signalKey: 'rain-alert', expected: true, inchesExpected: 0.65, windowHours: 48 };

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
      { signalKey: 'harvest:7', plantingEventId: 7, plantName: 'Lettuce', variety: null, bedId: 3, bedName: 'Bed Alpha', quantity: 12, daysPastExpected: 4 },
    ];
    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);

    const nav = makeNav();
    render(<NeedsAttentionPanel {...nav} />);

    await waitFor(() => {
      expect(screen.getByText(/Harvest ready/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Harvest ready/i));
    expect(nav.onNavigate).toHaveBeenCalledTimes(1);
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

  // -------------------------------------------------------------------------
  // Indoor germination check signal
  // -------------------------------------------------------------------------

  test('renders an indoor germination row when payload includes one', async () => {
    const payload = emptyPayload();
    payload.signals.indoorGerminationCheck = [
      {
        signalKey: 'indoor-germ-iss-7',
        plantingEventId: null,
        indoorSeedStartId: 7,
        plantName: 'Tomato',
        variety: 'Cherokee Purple',
        seedStartDate: '2026-04-01',
        expectedGerminationDate: '2026-04-08',
        germinationDays: 7,
        quantity: 12,
      },
    ];

    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
    render(<NeedsAttentionPanel {...makeNav()} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Check indoor germination — Tomato \(Cherokee Purple\)/i)
      ).toBeInTheDocument();
    });

    // Subtitle should mention the quantity and the (locale-formatted) date.
    // formatDate uses { month: 'short', day: 'numeric' } => "Apr 1" in en-US.
    expect(screen.getByText(/12 plants/i)).toBeInTheDocument();
    expect(screen.getByText(/started Apr 1/i)).toBeInTheDocument();
  });

  test('indoor germination check row emits onNavigate with indoorGerminationCheck target', async () => {
    const payload = emptyPayload();
    payload.signals.indoorGerminationCheck = [
      {
        signalKey: 'indoor-germ-iss-7',
        plantingEventId: null,
        indoorSeedStartId: 7,
        plantName: 'Tomato',
        variety: 'Cherokee Purple',
        seedStartDate: '2026-04-01',
        expectedGerminationDate: '2026-04-08',
        germinationDays: 7,
        quantity: 12,
      },
    ];

    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
    const nav = makeNav();
    render(<NeedsAttentionPanel {...nav} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Check indoor germination — Tomato/i)
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Check indoor germination — Tomato/i));

    expect(nav.onNavigate).toHaveBeenCalledTimes(1);
  });

  test('renders both direct-seed germinationCheck AND indoorGerminationCheck rows when both are populated', async () => {
    const payload = emptyPayload();
    payload.signals.germinationCheck = [
      {
        signalKey: 'germination-42',
        plantingEventId: 42,
        plantName: 'Carrot',
        variety: 'Nantes',
        directSeedDate: '2026-04-04',
        expectedGerminationDate: '2026-04-14',
        germinationDays: 10,
        quantity: 30,
        bedId: 5,
        bedName: 'Bed Herb',
      },
    ];
    payload.signals.indoorGerminationCheck = [
      {
        signalKey: 'indoor-germ-iss-7',
        plantingEventId: null,
        indoorSeedStartId: 7,
        plantName: 'Tomato',
        variety: 'Cherokee Purple',
        seedStartDate: '2026-04-01',
        expectedGerminationDate: '2026-04-08',
        germinationDays: 7,
        quantity: 12,
      },
    ];

    installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
    render(<NeedsAttentionPanel {...makeNav()} />);

    // Both titles should be present — proves buildRows wiring is additive
    // and order-independent for the two related signals.
    await waitFor(() => {
      expect(
        screen.getByText(/Check germination — Carrot \(Nantes\)/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Check indoor germination — Tomato \(Cherokee Purple\)/i)
    ).toBeInTheDocument();
  });

  test('caps visible rows at 5 with a "+ N more" toggle that expands', async () => {
    const payload = emptyPayload();
    // Build 7 harvest-ready rows so we exceed the DEFAULT_VISIBLE cap of 5.
    payload.signals.harvestReady = Array.from({ length: 7 }, (_, i) => ({
      signalKey: `harvest:${100 + i}`,
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

  // ---------------------------------------------------------------------------
  // Navigate payload assertions — verify each row emits the correct discriminated
  // union target to onNavigate. One payload shape per signal type.
  // ---------------------------------------------------------------------------

  describe('onNavigate payload per row kind', () => {
    /**
     * Helper: render with a payload containing just ONE non-empty signal kind,
     * then click the first row it produced and return the emitted target.
     */
    async function clickFirstRow(
      overrides: (p: DashboardToday) => void,
      rowMatcher: RegExp
    ): Promise<any> {
      const payload = emptyPayload();
      overrides(payload);
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      const nav = makeNav();
      render(<NeedsAttentionPanel {...nav} />);
      await waitFor(() => {
        expect(screen.getByText(rowMatcher)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(rowMatcher));
      expect(nav.onNavigate).toHaveBeenCalledTimes(1);
      return (nav.onNavigate as jest.Mock).mock.calls[0][0];
    }

    test('harvest row emits { kind: harvest, plantingEventId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.harvestReady = [
            { signalKey: 'harvest:7', plantingEventId: 7, plantName: 'Lettuce', variety: null, bedId: 3, bedName: 'Bed Alpha', quantity: 12, daysPastExpected: 4 },
          ];
        },
        /Harvest ready/i
      );
      expect(target).toEqual({ kind: 'harvest', plantingEventId: 7 });
    });

    test('indoor start row emits { kind: indoorStart, indoorSeedStartId, plantingEventId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.indoorStartsDue = [
            {
              signalKey: 'indoor-start:42',
              plantingEventId: 42,
              indoorSeedStartId: 9,
              plantName: 'Tomato',
              variety: 'Roma',
              seedStartDate: '2026-04-01',
              quantity: 12,
            },
          ];
        },
        /Indoor start due/i
      );
      expect(target).toEqual({
        kind: 'indoorStart',
        indoorSeedStartId: 9,
        plantingEventId: 42,
      });
    });

    test('indoor germination check row emits { kind: indoorGerminationCheck, indoorSeedStartId, plantingEventId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.indoorGerminationCheck = [
            {
              signalKey: 'indoor-germ-iss-7',
              plantingEventId: null,
              indoorSeedStartId: 7,
              plantName: 'Tomato',
              variety: 'Cherokee Purple',
              seedStartDate: '2026-04-01',
              expectedGerminationDate: '2026-04-08',
              germinationDays: 7,
              quantity: 12,
            },
          ];
        },
        /Check indoor germination/i
      );
      expect(target).toEqual({
        kind: 'indoorGerminationCheck',
        indoorSeedStartId: 7,
        plantingEventId: null,
      });
    });

    test('transplant row with bedId emits { kind: transplant, plantingEventId, bedId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.transplantsDue = [
            {
              signalKey: 'transplant:11',
              plantingEventId: 11,
              plantName: 'Tomato',
              variety: 'Cherokee Purple',
              transplantDate: '2026-04-14',
              quantity: 4,
              bedId: 4,
              bedName: 'Bed Beta',
            },
          ];
        },
        /Transplant due/i
      );
      expect(target).toEqual({
        kind: 'transplant',
        plantingEventId: 11,
        bedId: 4,
      });
    });

    test('transplant row without bedId (bedId null) still emits valid target with bedId null', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.transplantsDue = [
            {
              signalKey: 'transplant:12',
              plantingEventId: 12,
              plantName: 'Pepper',
              variety: null,
              transplantDate: '2026-04-14',
              quantity: 3,
              bedId: null,
              bedName: null,
            },
          ];
        },
        /Transplant due/i
      );
      expect(target.kind).toBe('transplant');
      expect(target.plantingEventId).toBe(12);
      // bedId is null (not undefined) — the row still fires and target is valid.
      expect(target.bedId).toBeNull();
    });

    test('direct seed row emits { kind: directSeed, plantingEventId, bedId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.directSeedDue = [
            {
              signalKey: 'direct-seed:21',
              plantingEventId: 21,
              plantName: 'Carrot',
              variety: 'Nantes',
              directSeedDate: '2026-04-14',
              quantity: 30,
              bedId: 5,
              bedName: 'Bed Herb',
            },
          ];
        },
        /Direct seed due/i
      );
      expect(target).toEqual({
        kind: 'directSeed',
        plantingEventId: 21,
        bedId: 5,
      });
    });

    test('outdoor germination check row emits { kind: germinationCheck, plantingEventId, bedId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.germinationCheck = [
            {
              signalKey: 'germination-42',
              plantingEventId: 42,
              plantName: 'Carrot',
              variety: 'Nantes',
              directSeedDate: '2026-04-04',
              expectedGerminationDate: '2026-04-14',
              germinationDays: 10,
              quantity: 30,
              bedId: 5,
              bedName: 'Bed Herb',
            },
          ];
        },
        /Check germination — Carrot/i
      );
      expect(target).toEqual({
        kind: 'germinationCheck',
        plantingEventId: 42,
        bedId: 5,
      });
    });

    test('compost overdue row emits { kind: compost, pileId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.compostOverdue = [
            { signalKey: 'compost:5', pileId: 5, pileName: 'Main', daysSinceLastTurn: 13, turnFrequencyDays: 7 },
          ];
        },
        /Compost overdue/i
      );
      expect(target).toEqual({ kind: 'compost', pileId: 5 });
    });

    test('seed low stock row emits { kind: seedLow, seedId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.seedLowStock = [
            { signalKey: 'seed-low:88', seedId: 88, plantName: 'Kale', variety: 'Lacinato', quantityRemaining: 1 },
          ];
        },
        /Low seed stock/i
      );
      expect(target).toEqual({ kind: 'seedLow', seedId: 88 });
    });

    test('seed expiring row emits { kind: seedExpiring, seedId }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.seedExpiring = [
            {
              signalKey: 'seed-exp:91',
              seedId: 91,
              plantName: 'Basil',
              variety: null,
              expiresOn: '2026-05-01',
              daysUntilExpiry: 17,
            },
          ];
        },
        /Seed expiring/i
      );
      expect(target).toEqual({ kind: 'seedExpiring', seedId: 91 });
    });

    test('livestock row emits { kind: livestock, type }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.livestockActionsDue = [
            {
              signalKey: 'livestock:egg-collection',
              type: 'egg-collection',
              label: 'Collect eggs',
              animal: 'Chickens',
            },
          ];
        },
        /Collect eggs/i
      );
      expect(target).toEqual({ kind: 'livestock', type: 'egg-collection' });
    });

    test('frost risk row emits { kind: weatherFrost }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.frostRisk = { signalKey: 'frost-risk', atRisk: true, forecastLowF: 28, windowHours: 24, source: 'weather-forecast' };
        },
        /Frost risk/i
      );
      expect(target).toEqual({ kind: 'weatherFrost' });
    });

    test('rain alert row emits { kind: weatherRain }', async () => {
      const target = await clickFirstRow(
        (p) => {
          p.signals.rainAlert = { signalKey: 'rain-alert', expected: true, inchesExpected: 0.65, windowHours: 48 };
        },
        /Rain expected/i
      );
      expect(target).toEqual({ kind: 'weatherRain' });
    });
  });

  // ---------------------------------------------------------------------------
  // Missing-id rows: button is disabled and onNavigate is NOT called.
  // ---------------------------------------------------------------------------

  describe('rows with missing required id are disabled', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test('harvest row with null plantingEventId is disabled and does not fire onNavigate', async () => {
      const payload = emptyPayload();
      payload.signals.harvestReady = [
        // Force an invalid payload to assert disabled-row behavior. The backend
        // type says plantingEventId: number, but we intentionally coerce to
        // null to simulate a broken payload — the UI must survive this.
        { signalKey: 'harvest:bad', plantingEventId: null as unknown as number, plantName: 'Lettuce', variety: null, bedId: null, bedName: null, quantity: 1, daysPastExpected: 0 },
      ];
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      const nav = makeNav();
      render(<NeedsAttentionPanel {...nav} />);

      const row = await screen.findByText(/Harvest ready — Lettuce/i);
      const btn = row.closest('button') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.disabled).toBe(true);

      fireEvent.click(btn);
      expect(nav.onNavigate).not.toHaveBeenCalled();
      // warnMissingId fires at buildRows time; it may or may not have happened
      // yet depending on de-dup state, but should never throw.
    });

    test('compost row with null pileId is disabled', async () => {
      const payload = emptyPayload();
      payload.signals.compostOverdue = [
        { signalKey: 'compost:bad', pileId: null as unknown as number, pileName: 'BrokenPile', daysSinceLastTurn: 9, turnFrequencyDays: 7 },
      ];
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      const nav = makeNav();
      render(<NeedsAttentionPanel {...nav} />);

      const row = await screen.findByText(/Compost overdue — BrokenPile/i);
      const btn = row.closest('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.click(btn);
      expect(nav.onNavigate).not.toHaveBeenCalled();
    });

    test('indoor germination with BOTH ids null is disabled', async () => {
      const payload = emptyPayload();
      payload.signals.indoorGerminationCheck = [
        {
          signalKey: 'indoor-germ-bad',
          plantingEventId: null,
          indoorSeedStartId: null,
          plantName: 'Tomato',
          variety: null,
          seedStartDate: '2026-04-01',
          expectedGerminationDate: '2026-04-08',
          germinationDays: 7,
          quantity: 12,
        },
      ];
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      const nav = makeNav();
      render(<NeedsAttentionPanel {...nav} />);

      const row = await screen.findByText(/Check indoor germination/i);
      const btn = row.closest('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.click(btn);
      expect(nav.onNavigate).not.toHaveBeenCalled();
    });
  });
});
