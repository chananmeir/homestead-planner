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

  // ---------------------------------------------------------------------------
  // Missed bucket (Slice C) — collapsed section below primary feed, renders
  // gray-toned rows from data.missed.*. Covers finding/plan:
  //   dev/active/production-readiness-audit/dashboard-stale-needs-attention-plan.md §2.3
  // ---------------------------------------------------------------------------

  describe('Missed bucket rendering', () => {
    /**
     * Fixture: an indoor-start row body. Kept in one place so Missed and
     * live tests compare identical shapes.
     */
    const makeIndoorRow = (id: number, variety: string) => ({
      signalKey: `indoor-${id}`,
      plantingEventId: id,
      indoorSeedStartId: null,
      plantName: 'Pepper',
      variety,
      seedStartDate: '2026-02-01',
      quantity: 8,
    });

    const makeTransplantRow = (id: number) => ({
      signalKey: `transplant-${id}`,
      plantingEventId: id,
      plantName: 'Tomato',
      variety: 'Roma',
      transplantDate: '2026-03-01',
      quantity: 4,
      bedId: 7,
      bedName: 'Bed Alpha',
    });

    const makeDirectSeedRow = (id: number) => ({
      signalKey: `direct-seed-${id}`,
      plantingEventId: id,
      plantName: 'Carrot',
      variety: 'Nantes',
      directSeedDate: '2026-02-15',
      quantity: 30,
      bedId: 9,
      bedName: 'Bed Beta',
    });

    test('does NOT render Missed section when data.missed is absent (undefined)', async () => {
      const payload = emptyPayload();
      // Do not set payload.missed — stays undefined (older cached responses).
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      await waitFor(() => {
        expect(screen.getByText(/All clear/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/^Missed \(/i)).not.toBeInTheDocument();
    });

    test('does NOT render Missed section when all three missed arrays are empty', async () => {
      const payload = emptyPayload();
      payload.missed = {
        indoorStartsDue: [],
        transplantsDue: [],
        directSeedDue: [],
      };
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      await waitFor(() => {
        expect(screen.getByText(/All clear/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/^Missed \(/i)).not.toBeInTheDocument();
    });

    test('renders Missed section collapsed by default with correct count label', async () => {
      const payload = emptyPayload();
      payload.missed = {
        indoorStartsDue: [makeIndoorRow(101, 'Jalapeno'), makeIndoorRow(102, 'Shishito')],
        transplantsDue: [makeTransplantRow(201)],
        directSeedDue: [makeDirectSeedRow(301)],
      };
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      // Summary label shows the total count across the three buckets.
      await waitFor(() => {
        expect(screen.getByText(/^Missed \(4\)$/)).toBeInTheDocument();
      });

      // Collapsed by default — the <details> element exists but inner rows
      // are not reachable via visible role queries. Inspect the `open`
      // attribute directly.
      const summary = screen.getByText(/^Missed \(4\)$/);
      const details = summary.closest('details') as HTMLDetailsElement;
      expect(details).not.toBeNull();
      expect(details.open).toBe(false);
    });

    test('Missed rows are visible after the user expands the section', async () => {
      const payload = emptyPayload();
      payload.missed = {
        indoorStartsDue: [makeIndoorRow(42, 'Ancho')],
        transplantsDue: [],
        directSeedDue: [],
      };
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      const summary = await screen.findByText(/^Missed \(1\)$/);
      const details = summary.closest('details') as HTMLDetailsElement;

      // Open it programmatically (jsdom supports the open attribute on details).
      act(() => {
        details.open = true;
        details.dispatchEvent(new Event('toggle', { bubbles: true }));
      });

      expect(screen.getByText(/Indoor start due — Pepper \(Ancho\)/i)).toBeInTheDocument();
    });

    test('clicking a Missed row calls onNavigate with identical target to its live counterpart', async () => {
      // Render twice: once with the row live, once with the row in missed.
      // Assert the emitted NeedsAttentionTarget matches exactly.
      const liveTargets: any[] = [];
      const missedTargets: any[] = [];

      // --- Live render ---
      {
        const payload = emptyPayload();
        payload.signals.indoorStartsDue = [makeIndoorRow(42, 'Ancho')];
        installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
        const nav: NeedsAttentionPanelProps = {
          onNavigate: jest.fn((t) => { liveTargets.push(t); }),
        };
        const { unmount } = render(<NeedsAttentionPanel {...nav} />);
        await waitFor(() => {
          expect(screen.getByText(/Indoor start due — Pepper \(Ancho\)/i)).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText(/Indoor start due — Pepper \(Ancho\)/i));
        unmount();
      }

      clearFetchMock();

      // --- Missed render ---
      {
        const payload = emptyPayload();
        payload.missed = {
          indoorStartsDue: [makeIndoorRow(42, 'Ancho')],
          transplantsDue: [],
          directSeedDue: [],
        };
        installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
        const nav: NeedsAttentionPanelProps = {
          onNavigate: jest.fn((t) => { missedTargets.push(t); }),
        };
        render(<NeedsAttentionPanel {...nav} />);
        const summary = await screen.findByText(/^Missed \(1\)$/);
        const details = summary.closest('details') as HTMLDetailsElement;
        act(() => {
          details.open = true;
          details.dispatchEvent(new Event('toggle', { bubbles: true }));
        });
        fireEvent.click(screen.getByText(/Indoor start due — Pepper \(Ancho\)/i));
      }

      expect(liveTargets).toHaveLength(1);
      expect(missedTargets).toHaveLength(1);
      // Deep-link invariant: same kind + same ids regardless of bucket.
      expect(missedTargets[0]).toEqual(liveTargets[0]);
      expect(missedTargets[0]).toEqual({
        kind: 'indoorStart',
        indoorSeedStartId: null,
        plantingEventId: 42,
      });
    });

    test('Missed rows render with gray tone (not blue)', async () => {
      const payload = emptyPayload();
      payload.missed = {
        indoorStartsDue: [makeIndoorRow(42, 'Ancho')],
        transplantsDue: [],
        directSeedDue: [],
      };
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      const summary = await screen.findByText(/^Missed \(1\)$/);
      const details = summary.closest('details') as HTMLDetailsElement;
      act(() => {
        details.open = true;
        details.dispatchEvent(new Event('toggle', { bubbles: true }));
      });

      const title = screen.getByText(/Indoor start due — Pepper \(Ancho\)/i);
      const btn = title.closest('button') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      // toneClasses.gray adds bg-gray-50; toneClasses.blue uses bg-blue-50.
      expect(btn.className).toContain('bg-gray-50');
      expect(btn.className).not.toContain('bg-blue-50');
      // Missed rows also get opacity-60 to signal "archived, not urgent".
      expect(btn.className).toContain('opacity-60');
    });

    test('Missed row hides the Skip 3d chip but keeps Cancel task and Dismiss', async () => {
      // indoorStart rows have a cancellable action (`indoor-*` prefix →
      // planting-event cancel), so the expected chip set for a Missed indoor
      // row is: Cancel task present, Skip 3d absent. (Dismiss is mutually
      // exclusive with Cancel task — only non-cancellable rows show ×.)
      const payload = emptyPayload();
      payload.missed = {
        indoorStartsDue: [makeIndoorRow(42, 'Ancho')],
        transplantsDue: [],
        directSeedDue: [],
      };
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      const summary = await screen.findByText(/^Missed \(1\)$/);
      const details = summary.closest('details') as HTMLDetailsElement;
      act(() => {
        details.open = true;
        details.dispatchEvent(new Event('toggle', { bubbles: true }));
      });

      const title = screen.getByText(/Indoor start due — Pepper \(Ancho\)/i);
      const btn = title.closest('button') as HTMLButtonElement;

      // Skip 3d chip is absent on Missed rows (snoozing an aged-out task is pointless).
      expect(btn.querySelector('[role="button"]')).not.toBeNull(); // cancel OR dismiss present
      const chipLabels = Array.from(btn.querySelectorAll('[role="button"]'))
        .map((el) => el.textContent || '');
      expect(chipLabels.some((t) => /Skip 3d/i.test(t))).toBe(false);
      // Cancel task IS present (indoor-* prefix → cancellable).
      expect(chipLabels.some((t) => /Cancel task/i.test(t))).toBe(true);
    });

    test('live (non-missed) row still shows Skip 3d chip for comparison', async () => {
      // Sanity check: the "Skip 3d hidden on missed" assertion is only
      // meaningful if we confirm the same row SHOWS Skip 3d when live.
      const payload = emptyPayload();
      payload.signals.indoorStartsDue = [makeIndoorRow(42, 'Ancho')];
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      await waitFor(() => {
        expect(screen.getByText(/Indoor start due — Pepper \(Ancho\)/i)).toBeInTheDocument();
      });
      const title = screen.getByText(/Indoor start due — Pepper \(Ancho\)/i);
      const btn = title.closest('button') as HTMLButtonElement;
      const chipLabels = Array.from(btn.querySelectorAll('[role="button"]'))
        .map((el) => el.textContent || '');
      // Live indoor row: Skip 3d AND Cancel task both present.
      expect(chipLabels.some((t) => /Skip 3d/i.test(t))).toBe(true);
      expect(chipLabels.some((t) => /Cancel task/i.test(t))).toBe(true);
    });

    test('"All clear" empty-state hides when Missed is populated but signals are empty', async () => {
      const payload = emptyPayload();
      payload.missed = {
        indoorStartsDue: [makeIndoorRow(42, 'Ancho')],
        transplantsDue: [],
        directSeedDue: [],
      };
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      // Missed header must render, and "All clear" must NOT.
      await waitFor(() => {
        expect(screen.getByText(/^Missed \(1\)$/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/All clear/i)).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Harvest isStale flag (Slice C) — harvests are integrity-sensitive and
  // NEVER drop; isStale=true only demotes the visual tone to gray.
  // ---------------------------------------------------------------------------

  describe('Harvest isStale tone', () => {
    test('row with isStale=true renders with gray tone (not green) but is still visible', async () => {
      const payload = emptyPayload();
      payload.signals.harvestReady = [
        {
          signalKey: 'harvest-7',
          plantingEventId: 7,
          plantName: 'Lettuce',
          variety: 'Buttercrunch',
          bedId: 3,
          bedName: 'Bed Alpha',
          quantity: 12,
          daysPastExpected: 40,
          isStale: true,
        },
      ];
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      const title = await screen.findByText(/Harvest ready — Lettuce/i);
      const btn = title.closest('button') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.className).toContain('bg-gray-50');
      expect(btn.className).not.toContain('bg-green-50');
      // Stale harvest rows are not opacity-dimmed (only Missed rows are).
      expect(btn.className).not.toContain('opacity-60');
      // Still clickable — never hidden.
      expect(btn.disabled).toBe(false);
    });

    test('row with isStale=false renders with normal green tone', async () => {
      const payload = emptyPayload();
      payload.signals.harvestReady = [
        {
          signalKey: 'harvest-7',
          plantingEventId: 7,
          plantName: 'Lettuce',
          variety: 'Buttercrunch',
          bedId: 3,
          bedName: 'Bed Alpha',
          quantity: 12,
          daysPastExpected: 2,
          isStale: false,
        },
      ];
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      const title = await screen.findByText(/Harvest ready — Lettuce/i);
      const btn = title.closest('button') as HTMLButtonElement;
      expect(btn.className).toContain('bg-green-50');
      expect(btn.className).not.toContain('bg-gray-50');
    });

    test('row with isStale undefined (field absent) renders with normal green tone', async () => {
      // Backward compatibility: pre-Slice-A servers don't set isStale at all.
      // The harvest row should render as if fresh (green).
      const payload = emptyPayload();
      payload.signals.harvestReady = [
        {
          signalKey: 'harvest-7',
          plantingEventId: 7,
          plantName: 'Lettuce',
          variety: null,
          bedId: null,
          bedName: null,
          quantity: 1,
          daysPastExpected: 0,
          // isStale intentionally omitted
        },
      ];
      installFetchMock([{ match: '/api/dashboard/today', response: payload }]);
      render(<NeedsAttentionPanel {...makeNav()} />);

      const title = await screen.findByText(/Harvest ready — Lettuce/i);
      const btn = title.closest('button') as HTMLButtonElement;
      expect(btn.className).toContain('bg-green-50');
      expect(btn.className).not.toContain('bg-gray-50');
    });
  });
});
