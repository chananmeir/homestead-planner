/**
 * Slice C tests for IndoorSeedStarts plan-only seedings banner — Slice B.
 *
 * Coverage from plan §4 Slice C:
 *  - Banner renders with correct count + plural copy when GET returns rows.
 *  - Banner is NOT in DOM when GET returns empty.
 *  - Singular copy for N=1.
 *  - Click Start tracking → POST body shape; on 201 with new IndoorSeedStart:
 *      banner row removed AND new card appears in regular grid.
 *  - Filter-mismatch toast: 'Now tracking — visible under Planned'.
 *  - Dismiss removes the row locally + does NOT POST anywhere; reload
 *      re-renders the row (client-only dismiss).
 *
 * Slice B report (verbatim copy strings):
 *   dev/active/production-readiness-audit/calendar-indoor-start-consistency-slice-b-report.md
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

// Same simulation/active-plan stubs the focus test uses.
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

import { installFetchMock, clearFetchMock, FetchRoute } from '../Dashboard/testUtils';
import { ToastProvider } from '../common/Toast';
import IndoorSeedStarts from '../IndoorSeedStarts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function planOnlyRow(overrides: Partial<any> = {}): any {
  return {
    plantingEventId: 100,
    plantId: 'tomato-1',
    plantName: 'Tomato',
    plantIcon: '🍅',
    variety: 'Brandywine',
    transplantDate: '2026-05-10',
    weeksIndoors: 6,
    germinationDays: 7,
    suggestedIndoorStartDate: '2026-03-29',
    expectedGerminationDate: '2026-04-05',
    daysUntilStart: -16,
    timingStatus: 'past',
    canStartIndoors: true,
    spaceRequired: 6,
    planId: null,
    planName: null,
    ...overrides,
  };
}

// Default routes: empty seeds list, plants list, seed inventory, and
// configurable needs-indoor-starts payload.
function makeRoutes(rows: any[]): FetchRoute[] {
  return [
    { match: '/api/indoor-seed-starts', response: [] },
    { match: '/api/plants', response: [{ id: 'tomato-1', name: 'Tomato', icon: '🍅' }] },
    { match: '/api/seeds', response: [] },
    {
      match: '/api/planting-events/needs-indoor-starts',
      response: { events: rows, count: rows.length },
    },
  ];
}

// installFetchMock matches the FIRST matching route, so put the more-specific
// /needs-indoor-starts route in front of the generic /api/indoor-seed-starts
// route. Otherwise '/api/indoor-seed-starts' would match the broader URL too.
function makeOrderedRoutes(rows: any[], extra: FetchRoute[] = []): FetchRoute[] {
  return [
    {
      match: '/api/planting-events/needs-indoor-starts',
      response: { events: rows, count: rows.length },
    },
    ...extra,
    { match: '/api/indoor-seed-starts', response: [] },
    { match: '/api/plants', response: [{ id: 'tomato-1', name: 'Tomato', icon: '🍅' }] },
    { match: '/api/seeds', response: [] },
  ];
}

function renderPage() {
  return render(
    <ToastProvider>
      <IndoorSeedStarts />
    </ToastProvider>
  );
}

describe('IndoorSeedStarts — plan-only seedings banner', () => {
  beforeEach(() => {
    (Element.prototype as any).scrollIntoView = jest.fn();
  });

  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('renders banner and 3 expanded rows when /needs-indoor-starts returns 3 rows', async () => {
    const rows = [
      planOnlyRow({ plantingEventId: 101, variety: 'Brandywine' }),
      planOnlyRow({ plantingEventId: 102, variety: 'Cherokee Purple' }),
      planOnlyRow({ plantingEventId: 103, variety: 'Roma' }),
    ];
    installFetchMock(makeOrderedRoutes(rows));

    renderPage();

    // Wait for the banner to mount after the GET resolves.
    const banner = await screen.findByTestId('plan-only-seedings-banner');
    // Plural copy: "3 planned seedings ... are not yet tracked"
    expect(banner).toHaveTextContent(
      /3\s+planned seedings from your garden plan\s+are\s+not yet tracked/i
    );

    // Collapsed by default — rows hidden until "Show all ▾" click.
    expect(screen.queryByTestId('plan-only-row-101')).not.toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));

    expect(screen.getByTestId('plan-only-row-101')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-102')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-103')).toBeInTheDocument();
  });

  test('filters expanded plan-only rows by planned bed', async () => {
    const rows = [
      planOnlyRow({
        plantingEventId: 601,
        variety: 'Brandywine',
        gardenBedId: 11,
        gardenBedName: 'North Bed',
      }),
      planOnlyRow({
        plantingEventId: 602,
        variety: 'Roma',
        gardenBedId: 22,
        gardenBedName: 'South Bed',
      }),
      planOnlyRow({
        plantingEventId: 603,
        variety: 'Cherokee Purple',
        gardenBedId: 11,
        gardenBedName: 'North Bed',
      }),
    ];
    installFetchMock(makeOrderedRoutes(rows));

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));

    expect(screen.getByTestId('plan-only-row-601')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-602')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-603')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('indoor-start-bed-filter'), {
      target: { value: '22' },
    });

    expect(banner).toHaveTextContent(
      /1\s+planned seeding from your garden plan\s+is\s+not yet tracked/i
    );
    expect(screen.queryByTestId('plan-only-row-601')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-602')).toBeInTheDocument();
    expect(screen.queryByTestId('plan-only-row-603')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-602')).toHaveTextContent(/Planned bed:\s+South Bed/i);

    fireEvent.change(screen.getByTestId('indoor-start-bed-filter'), {
      target: { value: 'all' },
    });

    expect(screen.getByTestId('plan-only-row-601')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-602')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-603')).toBeInTheDocument();
  });

  test('filters tracked seed-start cards by planned bed', async () => {
    installFetchMock(
      makeOrderedRoutes([], [
        {
          match: '/api/indoor-seed-starts',
          response: [
            {
              id: 801,
              plantId: 'tomato-1',
              variety: 'Brandywine',
              startDate: '2026-03-29',
              seedsStarted: 8,
              status: 'planned',
              destinationBedDetails: [{ id: 11, name: 'North Bed' }],
            },
            {
              id: 802,
              plantId: 'tomato-1',
              variety: 'Roma',
              startDate: '2026-03-29',
              seedsStarted: 8,
              status: 'planned',
              destinationBedDetails: [{ id: 22, name: 'South Bed' }],
            },
          ],
        },
      ])
    );

    renderPage();

    await screen.findByTestId('iss-card-801');
    expect(screen.getByTestId('iss-card-802')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('indoor-start-bed-filter'), {
      target: { value: '22' },
    });

    expect(screen.queryByTestId('iss-card-801')).not.toBeInTheDocument();
    expect(screen.getByTestId('iss-card-802')).toBeInTheDocument();
  });

  test('filters planned rows and tracked seed-start cards by start date range', async () => {
    const rows = [
      planOnlyRow({
        plantingEventId: 831,
        variety: 'Early Plan',
        suggestedIndoorStartDate: '2026-04-01',
        gardenBedId: 11,
        gardenBedName: 'North Bed',
      }),
      planOnlyRow({
        plantingEventId: 832,
        variety: 'Late Plan',
        suggestedIndoorStartDate: '2026-04-20',
        gardenBedId: 11,
        gardenBedName: 'North Bed',
      }),
    ];
    installFetchMock(
      makeOrderedRoutes(rows, [
        {
          match: '/api/indoor-seed-starts',
          response: [
            {
              id: 841,
              plantId: 'tomato-1',
              variety: 'Early Card',
              startDate: '2026-04-01T00:00:00',
              seedsStarted: 4,
              status: 'planned',
              destinationBedDetails: [{ id: 11, name: 'North Bed' }],
            },
            {
              id: 842,
              plantId: 'tomato-1',
              variety: 'Late Card',
              startDate: '2026-04-20T00:00:00',
              seedsStarted: 4,
              status: 'planned',
              destinationBedDetails: [{ id: 11, name: 'North Bed' }],
            },
          ],
        },
      ])
    );

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));
    expect(screen.getByTestId('plan-only-row-831')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-832')).toBeInTheDocument();
    expect(await screen.findByTestId('iss-card-841')).toBeInTheDocument();
    expect(screen.getByTestId('iss-card-842')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('indoor-start-date-from'), {
      target: { value: '2026-04-10' },
    });
    fireEvent.change(screen.getByTestId('indoor-start-date-to'), {
      target: { value: '2026-04-30' },
    });

    expect(banner).toHaveTextContent(
      /1\s+planned seeding from your garden plan\s+is\s+not yet tracked/i
    );
    expect(screen.queryByTestId('plan-only-row-831')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-832')).toBeInTheDocument();
    expect(screen.queryByTestId('iss-card-841')).not.toBeInTheDocument();
    expect(screen.getByTestId('iss-card-842')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('indoor-start-clear-date-filter'));

    await waitFor(() => {
      expect(screen.getByTestId('plan-only-row-831')).toBeInTheDocument();
      expect(screen.getByTestId('iss-card-841')).toBeInTheDocument();
    });
  });

  test('shows Not assigned option even when all current planned rows have beds', async () => {
    const rows = [
      planOnlyRow({
        plantingEventId: 611,
        variety: 'Brandywine',
        gardenBedId: 11,
        gardenBedName: 'North Bed',
      }),
    ];
    installFetchMock(makeOrderedRoutes(rows));

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    const bedFilter = screen.getByTestId('indoor-start-bed-filter');
    expect(within(bedFilter).getByRole('option', { name: 'Not assigned' })).toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));
    fireEvent.change(bedFilter, { target: { value: 'unassigned' } });

    expect(screen.queryByTestId('plan-only-row-611')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-only-empty-filter')).toHaveTextContent(
      /Choose another bed or switch back to all planned beds/i
    );
  });

  test('filters expanded plan-only rows to unassigned planned rows', async () => {
    const rows = [
      planOnlyRow({
        plantingEventId: 701,
        variety: 'Roma',
        gardenBedId: 11,
        gardenBedName: 'North Bed',
      }),
      planOnlyRow({
        plantingEventId: 702,
        variety: 'Unassigned Tomato',
        gardenBedId: undefined,
        gardenBedName: undefined,
      }),
    ];
    installFetchMock(makeOrderedRoutes(rows));

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));

    expect(screen.getByTestId('plan-only-row-701')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-702')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('indoor-start-bed-filter'), {
      target: { value: 'unassigned' },
    });

    expect(screen.queryByTestId('plan-only-row-701')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-702')).toBeInTheDocument();
    expect(screen.getByTestId('plan-only-row-702')).toHaveTextContent(/Planned bed:\s+Not assigned/i);
  });

  test('deletes filtered planned events only after typed confirmation', async () => {
    const rows = [
      planOnlyRow({
        plantingEventId: 901,
        plantingEventIds: [901, 902],
        variety: 'Brandywine',
        gardenBedId: 11,
        gardenBedName: 'North Bed',
      }),
      planOnlyRow({
        plantingEventId: 903,
        variety: 'Roma',
        gardenBedId: 22,
        gardenBedName: 'South Bed',
      }),
    ];
    const fetchMock = installFetchMock(
      makeOrderedRoutes(rows, [
        {
          match: '/api/planting-events/bulk-delete',
          response: {
            deleted: 2,
            deletedEventIds: [901, 902],
            deletedIndoorSeedStarts: 0,
            deletedAutoPlanItems: 0,
            planItemsReset: 1,
          },
        },
      ])
    );

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));
    fireEvent.change(screen.getByTestId('indoor-start-bed-filter'), {
      target: { value: '11' },
    });

    fireEvent.click(screen.getByTestId('delete-filtered-planned-items'));
    expect(screen.getByText(/Delete 2 planned calendar events for North Bed/i)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled();

    fireEvent.change(screen.getByTestId('confirm-dialog-confirmation-input'), {
      target: { value: 'delete' },
    });
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(c => {
        const url = typeof c[0] === 'string' ? c[0] : String(c[0]);
        return url.includes('/api/planting-events/bulk-delete');
      });
      expect(deleteCall).toBeTruthy();
    });

    const deleteCall = fetchMock.mock.calls.find(c => {
      const url = typeof c[0] === 'string' ? c[0] : String(c[0]);
      return url.includes('/api/planting-events/bulk-delete');
    })!;
    expect((deleteCall[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse((deleteCall[1] as RequestInit).body as string)).toEqual({
      eventIds: [901, 902],
      confirmation: 'delete',
    });

    await waitFor(() => {
      expect(screen.queryByTestId('plan-only-row-901')).not.toBeInTheDocument();
    });
  });

  test('deletes not assigned planned events and planned seed starts together', async () => {
    const rows = [
      planOnlyRow({
        plantingEventId: 950,
        variety: 'Unassigned Tomato',
        gardenBedId: undefined,
        gardenBedName: undefined,
      }),
    ];
    const fetchMock = installFetchMock(
      makeOrderedRoutes(rows, [
        {
          match: '/api/planned-items/unassigned/bulk-delete',
          response: {
            deletedEventIds: [950],
            deletedSeedStartIds: [777],
            deletedPlantingEvents: 1,
            deletedIndoorSeedStarts: 1,
            deletedPlantedItems: 0,
            deletedPlanItems: 0,
            deletedAutoPlanItems: 0,
            planItemsReset: 0,
          },
        },
        {
          match: '/api/indoor-seed-starts',
          response: [
            {
              id: 777,
              plantId: 'tomato-1',
              variety: 'No Bed Planned',
              startDate: '2026-03-29',
              seedsStarted: 8,
              status: 'planned',
              destinationBedDetails: [],
            },
            {
              id: 778,
              plantId: 'tomato-1',
              variety: 'Already Seeded',
              startDate: '2026-03-29',
              seedsStarted: 8,
              status: 'seeded',
              destinationBedDetails: [],
            },
          ],
        },
      ])
    );

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    await screen.findByTestId('iss-card-777');
    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));
    fireEvent.change(screen.getByTestId('indoor-start-bed-filter'), {
      target: { value: 'unassigned' },
    });

    fireEvent.click(screen.getByTestId('delete-filtered-planned-items'));
    expect(screen.getByText(/Delete 2 not assigned planned items/i)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('confirm-dialog-confirmation-input'), {
      target: { value: 'delete' },
    });
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      const cleanupCall = fetchMock.mock.calls.find(c => {
        const url = typeof c[0] === 'string' ? c[0] : String(c[0]);
        return url.includes('/api/planned-items/unassigned/bulk-delete');
      });
      expect(cleanupCall).toBeTruthy();
    });

    const cleanupCall = fetchMock.mock.calls.find(c => {
      const url = typeof c[0] === 'string' ? c[0] : String(c[0]);
      return url.includes('/api/planned-items/unassigned/bulk-delete');
    })!;
    expect(JSON.parse((cleanupCall[1] as RequestInit).body as string)).toEqual({
      eventIds: [950],
      seedStartIds: [777],
      confirmation: 'delete',
    });

    await waitFor(() => {
      expect(screen.queryByTestId('plan-only-row-950')).not.toBeInTheDocument();
      expect(screen.queryByTestId('iss-card-777')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('iss-card-778')).toBeInTheDocument();
  });

  test('banner is NOT in the DOM when /needs-indoor-starts returns empty events array', async () => {
    installFetchMock(makeOrderedRoutes([]));

    renderPage();

    // Wait for loading spinner to clear — the page has finished loading.
    await waitFor(() => {
      expect(screen.queryByText(/Loading seed starts/i)).not.toBeInTheDocument();
    });

    expect(screen.queryByTestId('plan-only-seedings-banner')).not.toBeInTheDocument();
  });

  test('singular copy for N=1: "1 planned seeding ... is not yet tracked"', async () => {
    installFetchMock(
      makeOrderedRoutes([planOnlyRow({ plantingEventId: 201 })])
    );

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    expect(banner).toHaveTextContent(
      /1\s+planned seeding from your garden plan\s+is\s+not yet tracked/i
    );
    // Specifically, the plural "seedings" should NOT appear in the banner text.
    expect(banner).not.toHaveTextContent(/planned seedings/i);
  });

  test('Start tracking POSTs the correct body, removes banner row, and adds the new card to the grid', async () => {
    const row = planOnlyRow({
      plantingEventId: 301,
      plantId: 'tomato-1',
      variety: 'Brandywine',
      transplantDate: '2026-05-10',
      spaceRequired: 8,
    });

    const newSeedStart = {
      id: 999,
      plantId: 'tomato-1',
      variety: 'Brandywine',
      startDate: '2026-03-29',
      seedsStarted: 8,
      status: 'planned' as const,
      plantingEventId: 301,
    };

    const fetchMock = installFetchMock(
      makeOrderedRoutes([row], [
        {
          match: '/api/indoor-seed-starts/from-planting-event',
          response: { indoorSeedStart: newSeedStart, calculation: {} },
          status: 201,
        },
      ])
    );

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));

    const bannerRow = screen.getByTestId('plan-only-row-301');
    fireEvent.click(within(bannerRow).getByRole('button', { name: /Start tracking/i }));

    // Wait for the POST to fire.
    await waitFor(() => {
      const fromCall = fetchMock.mock.calls.find(c => {
        const url = typeof c[0] === 'string' ? c[0] : String(c[0]);
        return url.includes('/api/indoor-seed-starts/from-planting-event');
      });
      expect(fromCall).toBeTruthy();
    });

    // Inspect the request body.
    const fromCall = fetchMock.mock.calls.find(c => {
      const url = typeof c[0] === 'string' ? c[0] : String(c[0]);
      return url.includes('/api/indoor-seed-starts/from-planting-event');
    })!;
    const init = fromCall[1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        plantingEventId: 301,
        plantId: 'tomato-1',
        variety: 'Brandywine',
        transplantDate: '2026-05-10',
        // desiredQuantity falls back to spaceRequired || 1 in the source.
        desiredQuantity: 8,
        overdueMode: 'reschedule_today',
      })
    );

    // Banner row disappears (dismissed via the dismissed-set on success).
    await waitFor(() => {
      expect(screen.queryByTestId('plan-only-row-301')).not.toBeInTheDocument();
    });

    // New card appears in the regular grid.
    await waitFor(() => {
      expect(screen.getByTestId('iss-card-999')).toBeInTheDocument();
    });
  });

  test('filter-mismatch toast: when filter is non-planned, success toast says "Now tracking — visible under Planned"', async () => {
    const row = planOnlyRow({ plantingEventId: 401 });
    const newSeedStart = {
      id: 1001,
      plantId: 'tomato-1',
      variety: 'Brandywine',
      startDate: '2026-03-29',
      seedsStarted: 6,
      status: 'planned' as const,
      plantingEventId: 401,
    };
    installFetchMock(
      makeOrderedRoutes([row], [
        {
          match: '/api/indoor-seed-starts/from-planting-event',
          response: { indoorSeedStart: newSeedStart, calculation: {} },
          status: 201,
        },
      ])
    );

    renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');

    // Switch the active filter to 'germinating' — this will hide newly-created
    // cards (they're created with status='planned'), so the source emits the
    // "visible under Planned" toast variant.
    fireEvent.click(screen.getByRole('button', { name: 'Germinating' }));

    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));
    fireEvent.click(
      within(screen.getByTestId('plan-only-row-401')).getByRole('button', {
        name: /Start tracking/i,
      })
    );

    // Assert the specific toast copy from slice B.
    await waitFor(() => {
      const toast = screen.getByTestId('toast-success');
      expect(toast).toHaveTextContent(/Now tracking — visible under Planned/);
    });
  });

  test('Dismiss removes the row locally without firing the POST; same props re-render also removes it', async () => {
    const row = planOnlyRow({ plantingEventId: 501 });
    const fetchMock = installFetchMock(makeOrderedRoutes([row]));

    const { rerender } = renderPage();

    const banner = await screen.findByTestId('plan-only-seedings-banner');
    fireEvent.click(within(banner).getByRole('button', { name: /Show all/i }));

    const bannerRow = screen.getByTestId('plan-only-row-501');
    fireEvent.click(within(bannerRow).getByRole('button', { name: /Dismiss/i }));

    // Row is gone from the DOM.
    await waitFor(() => {
      expect(screen.queryByTestId('plan-only-row-501')).not.toBeInTheDocument();
    });

    // No POST fired anywhere — the only fetch calls should be the four GETs
    // from initial loadData (seeds, plants, inventory, needs-indoor-starts).
    const postCalls = fetchMock.mock.calls.filter(c => {
      const init = c[1] as RequestInit | undefined;
      return init?.method === 'POST';
    });
    expect(postCalls).toHaveLength(0);

    // Re-render with the same props — dismiss is client-only, but the
    // dismissedIds Set survives a normal React re-render (it would only reset
    // on a hard reload). We assert the row remains hidden across this rerender.
    rerender(
      <ToastProvider>
        <IndoorSeedStarts />
      </ToastProvider>
    );
    expect(screen.queryByTestId('plan-only-row-501')).not.toBeInTheDocument();
  });
});
