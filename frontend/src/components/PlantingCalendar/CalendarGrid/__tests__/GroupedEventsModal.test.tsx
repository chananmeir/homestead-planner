/**
 * Slice C tests for GroupedEventsModal — calendar/indoor-starts consistency.
 *
 * Per plan §1.1: the grouped modal renders the Tracked / Plan only pills but
 * NO inline Start tracking button (the user proceeds to DayDetailModal for
 * the action). These tests assert pill rendering only.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import GroupedEventsModal from '../GroupedEventsModal';
import type { GroupedDateMarker } from '../utils';
import type { PlantingCalendar } from '../../../../types';

function makeSeedStartEvent(
  overrides: Partial<PlantingCalendar> = {}
): PlantingCalendar {
  return {
    id: 0,
    plantId: 'tomato-1',
    variety: 'Brandywine',
    seedStartDate: new Date('2026-03-15'),
    transplantDate: new Date('2026-05-10'),
    completed: false,
    eventType: 'planting',
    ...overrides,
  } as PlantingCalendar;
}

function makeSeedStartGroup(events: PlantingCalendar[]): GroupedDateMarker {
  return {
    date: new Date('2026-03-15'),
    type: 'seed-start',
    plantId: events[0].plantId!,
    variety: events[0].variety,
    gardenBedId: events[0].gardenBedId,
    events,
    count: events.length,
  };
}

describe('GroupedEventsModal — Plan only / Tracked pills', () => {
  test('renders Tracked pill for tracked seed-start row and Plan only pill for plan-only row', () => {
    const tracked = makeSeedStartEvent({ id: 1, indoorSeedStartStatus: 'planned' });
    const planOnly = makeSeedStartEvent({ id: 2, indoorSeedStartStatus: undefined });
    const marker = makeSeedStartGroup([tracked, planOnly]);

    render(
      <GroupedEventsModal
        isOpen={true}
        marker={marker}
        onClose={() => {}}
        onEditEvent={() => {}}
      />
    );

    // Both pills present.
    expect(screen.getByText('Tracked')).toBeInTheDocument();
    expect(screen.getByText('Plan only')).toBeInTheDocument();

    // No inline Start tracking button in the grouped modal — per plan §1.1
    // the action belongs to DayDetailModal, not here.
    expect(
      screen.queryByRole('button', { name: /Start tracking/i })
    ).not.toBeInTheDocument();
  });
});
