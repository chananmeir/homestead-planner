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
    const trackedEvent = makeSeedStartEvent({
      id: 1,
      indoorSeedStartStatus: 'planned',
    });
    const planOnlyEvent = makeSeedStartEvent({
      id: 2,
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
