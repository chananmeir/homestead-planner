/**
 * Slice C tests for DayDetailModal — calendar/indoor-starts consistency.
 *
 * Coverage:
 *  - Two seed-start rows on the same day, one tracked + one plan-only:
 *      assert pills + Start tracking button visibility.
 *  - Click Start tracking → POST body shape + onEventUpdated invoked.
 *  - 4xx response → error toast surfaces, row stays in modal,
 *      onEventUpdated NOT invoked.
 *
 * Plan/Slice A reference:
 *   dev/active/production-readiness-audit/calendar-indoor-start-consistency-slice-a-report.md
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import DayDetailModal from '../DayDetailModal';
import { ToastProvider } from '../../../common/Toast';
import { installFetchMock, clearFetchMock } from '../../../Dashboard/testUtils';
import type { PlantingCalendar } from '../../../../types';

const DAY = new Date('2026-03-15T12:00:00');

function makeSeedStartEvent(
  overrides: Partial<PlantingCalendar> = {}
): PlantingCalendar {
  return {
    id: 0,
    plantId: 'tomato-1',
    variety: 'Brandywine',
    seedStartDate: DAY,
    transplantDate: new Date('2026-05-10T00:00:00Z'),
    quantity: 6,
    completed: false,
    eventType: 'planting',
    ...overrides,
  } as PlantingCalendar;
}

function renderModal(props: {
  events: PlantingCalendar[];
  onEventUpdated?: () => void;
}) {
  return render(
    <ToastProvider>
      <DayDetailModal
        isOpen={true}
        date={DAY}
        events={props.events}
        onClose={() => {}}
        onEventClick={() => {}}
        onAddEvent={() => {}}
        onEventUpdated={props.onEventUpdated}
      />
    </ToastProvider>
  );
}

describe('DayDetailModal — Plan only vs Tracked seed-start rows', () => {
  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('renders Tracked pill (no button) for tracked row and Plan only pill + Start tracking button for plan-only row', () => {
    // Use distinct beds so the two events do NOT share the (date, type, plantId,
    // variety, bedId) grouping key — each event must remain a separate row in
    // order for both the Tracked pill and the Plan only pill + button to render
    // at the row level. Group keys for "different bed" stay distinct, mirroring
    // the ListView fix in commit 47a0e4a.
    const trackedEvent = makeSeedStartEvent({
      id: 1,
      gardenBedId: 1,
      indoorSeedStartStatus: 'planned',
    });
    const planOnlyEvent = makeSeedStartEvent({
      id: 2,
      gardenBedId: 2,
      indoorSeedStartStatus: undefined,
    });

    renderModal({ events: [trackedEvent, planOnlyEvent] });

    // Both pills render somewhere in the document.
    const trackedPill = screen.getByText('Tracked');
    const planOnlyPill = screen.getByText('Plan only');
    expect(trackedPill).toBeInTheDocument();
    expect(planOnlyPill).toBeInTheDocument();

    // Exactly one Start tracking button — for the plan-only row.
    const buttons = screen.getAllByRole('button', { name: /Start tracking/i });
    expect(buttons).toHaveLength(1);
  });

  test('clicking Start tracking POSTs the expected body and calls onEventUpdated on success', async () => {
    const planOnlyEvent = makeSeedStartEvent({
      id: 99,
      indoorSeedStartStatus: undefined,
      plantId: 'tomato-1',
      variety: 'Brandywine',
      transplantDate: new Date('2026-05-10T00:00:00Z'),
      quantity: 6,
    });

    const fetchMock = installFetchMock([
      {
        match: '/api/indoor-seed-starts/from-planting-event',
        response: { indoorSeedStart: { id: 500, status: 'planned' } },
        status: 201,
      },
    ]);

    const onEventUpdated = jest.fn();
    renderModal({ events: [planOnlyEvent], onEventUpdated });

    fireEvent.click(screen.getByRole('button', { name: /Start tracking/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Find the call to /api/indoor-seed-starts/from-planting-event.
    const matchingCall = fetchMock.mock.calls.find(call => {
      const url = typeof call[0] === 'string' ? call[0] : String(call[0]);
      return url.includes('/api/indoor-seed-starts/from-planting-event');
    });
    expect(matchingCall).toBeTruthy();

    // Inspect the request body. apiPost stringifies the body via JSON.
    const init = matchingCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        plantingEventId: 99,
        plantId: 'tomato-1',
        variety: 'Brandywine',
        desiredQuantity: 6,
        overdueMode: 'reschedule_today',
      })
    );
    // transplantDate is sent as the Date's ISO string after JSON.stringify;
    // assert it's present and references 2026-05-10.
    expect(body.transplantDate).toMatch(/^2026-05-10/);

    await waitFor(() => {
      expect(onEventUpdated).toHaveBeenCalledTimes(1);
    });
  });

  test('on 4xx error surfaces an error toast, leaves row in modal, does NOT call onEventUpdated', async () => {
    const planOnlyEvent = makeSeedStartEvent({
      id: 77,
      indoorSeedStartStatus: undefined,
    });

    installFetchMock([
      {
        match: '/api/indoor-seed-starts/from-planting-event',
        response: { error: 'Plant has already been started indoors' },
        status: 400,
      },
    ]);

    const onEventUpdated = jest.fn();
    renderModal({ events: [planOnlyEvent], onEventUpdated });

    // Sanity: row is present.
    expect(screen.getByText('Plan only')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start tracking/i }));

    // Error toast surfaces (with backend message).
    await waitFor(() => {
      const toast = screen.getByTestId('toast-error');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent(/Plant has already been started indoors/);
    });

    // Row stays in DOM and onEventUpdated was NOT called.
    expect(screen.getByText('Plan only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start tracking/i })).toBeInTheDocument();
    expect(onEventUpdated).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Row-splitting grouping tests — third application of the composite key
// (date + markerType + plantId + variety + bedId) already used by ListView and
// CalendarGrid. Reference investigation:
//   dev/active/production-readiness-audit/calendar-day-detail-row-splitting-investigation.md
// ---------------------------------------------------------------------------
describe('DayDetailModal — same-day same-bed same-plant rows collapse to one grouped row', () => {
  afterEach(() => {
    clearFetchMock();
    jest.restoreAllMocks();
  });

  test('4 same-key direct-seed events render as 1 grouped row with "(4)" badge and no per-event Trash button', () => {
    // 4 direct-seed bean events on the same date + bed + variety: should collapse to ONE row.
    const events: PlantingCalendar[] = Array.from({ length: 4 }).map((_, i) => ({
      id: 100 + i,
      plantId: 'beans-1',
      variety: 'Provider',
      gardenBedId: 7,
      directSeedDate: DAY,
      quantity: 6,
      completed: false,
      eventType: 'planting',
    }) as PlantingCalendar);

    renderModal({ events });

    // Group count badge "(4)" appears next to the plant name.
    expect(screen.getByText('(4)')).toBeInTheDocument();

    // Phase header summary shows 1 grouped item, not 4.
    // The phase bucket header "Direct Seed (1)" has the "(1)" rendered as separate
    // text node from the section label.
    expect(screen.getByText('Direct Seed')).toBeInTheDocument();

    // No per-event Trash button on grouped rows (singleton-only). The trash
    // button has title="Delete event" — assert no buttons with that title exist.
    const trashButtons = screen.queryAllByTitle('Delete event');
    expect(trashButtons).toHaveLength(0);

    // Total quantity summary aggregates across the group: 4 * 6 = 24 plants.
    expect(screen.getByText('24 plants')).toBeInTheDocument();
  });

  test('singleton (count === 1) row preserves the per-event Trash button and existing UX', () => {
    const event = makeSeedStartEvent({
      id: 200,
      gardenBedId: 5,
      indoorSeedStartStatus: undefined,
    });

    const { container } = renderModal({ events: [event] });

    // No row-level "(N)" badge for singletons. The row-level badge is rendered
    // with class "text-sm font-semibold text-gray-700 ml-1" — distinct from
    // the phase header's gray "(1)" count of items in the section.
    const rowBadges = container.querySelectorAll('span.font-semibold.text-gray-700.ml-1');
    expect(rowBadges.length).toBe(0);

    // No data-grouped-count attribute on singletons (only set when count > 1).
    expect(container.querySelector('[data-grouped-count]')).toBeNull();

    // Trash button is still present for singletons.
    const trashButtons = screen.getAllByTitle('Delete event');
    expect(trashButtons.length).toBeGreaterThan(0);

    // Existing per-event UX: Plan only pill + Start tracking button still render.
    expect(screen.getByText('Plan only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start tracking/i })).toBeInTheDocument();
  });

  test('clicking a grouped row opens GroupedEventsModal (count + plant name visible in header)', async () => {
    // 3 same-key direct-seed events. Click the grouped row -> GroupedEventsModal
    // mounts with the marker.count rendered in its header ("3 plantings").
    const events: PlantingCalendar[] = Array.from({ length: 3 }).map((_, i) => ({
      id: 300 + i,
      plantId: 'radish-1',
      variety: 'Cherry Belle',
      gardenBedId: 9,
      directSeedDate: DAY,
      quantity: 12,
      completed: false,
      eventType: 'planting',
    }) as PlantingCalendar);

    const { container } = renderModal({ events });

    // The grouped row carries data-grouped-count={count} (mirrors ListView).
    const groupedRow = container.querySelector('[data-grouped-count="3"]');
    expect(groupedRow).not.toBeNull();

    // Click the grouped row -> GroupedEventsModal opens.
    fireEvent.click(groupedRow as HTMLElement);

    // GroupedEventsModal header includes "3 plantings" summary.
    await waitFor(() => {
      expect(screen.getByText(/3 plantings/i)).toBeInTheDocument();
    });
  });
});
