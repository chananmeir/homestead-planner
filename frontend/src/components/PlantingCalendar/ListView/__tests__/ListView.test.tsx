/**
 * Slice C tests for ListView — calendar/indoor-starts consistency.
 *
 * Per plan §1.1: ListView renders the Tracked / Plan only pills next to the
 * plant name on rows where seedStartDate is set. NO inline action button
 * (action lives in DayDetailModal).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import ListView from '../index';
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

describe('ListView — Plan only / Tracked pills', () => {
  test('renders Tracked pill for tracked seed-start row and Plan only pill for plan-only row', () => {
    // Use distinct beds so the two events do not share the (date, type, plantId,
    // variety, bedId) grouping key introduced by Option A — each event must
    // remain a separate card in order for both pills to render at the card level.
    const tracked = makeSeedStartEvent({ id: 1, gardenBedId: 1, indoorSeedStartStatus: 'planned' });
    const planOnly = makeSeedStartEvent({ id: 2, gardenBedId: 2, indoorSeedStartStatus: undefined });

    render(
      <ListView
        plantingEvents={[tracked, planOnly]}
        setPlantingEvents={() => {}}
        lastFrostDate={new Date('2026-04-15')}
        firstFrostDate={new Date('2026-10-15')}
      />
    );

    expect(screen.getByText('Tracked')).toBeInTheDocument();
    expect(screen.getByText('Plan only')).toBeInTheDocument();

    // ListView never renders an inline Start tracking button.
    expect(
      screen.queryByRole('button', { name: /Start tracking/i })
    ).not.toBeInTheDocument();
  });
});

describe('ListView — Option A grouping (same date+type+plant+variety+bed collapses to one card)', () => {
  test('collapses N events sharing the group key into a single card with "(N)" badge', () => {
    // 4 direct-seed radishes on the same date + bed + variety: should render as ONE card.
    const events: PlantingCalendar[] = Array.from({ length: 4 }).map((_, i) => ({
      id: 100 + i,
      plantId: 'radish-1',
      variety: 'Cherry Belle',
      gardenBedId: 7,
      directSeedDate: new Date('2026-04-20'),
      completed: false,
      eventType: 'planting',
    }) as PlantingCalendar);

    render(
      <ListView
        plantingEvents={events}
        setPlantingEvents={() => {}}
        lastFrostDate={new Date('2026-04-15')}
        firstFrostDate={new Date('2026-10-15')}
      />
    );

    // Exactly one rendered list-card for the group of 4.
    const cards = screen.getAllByTestId('planting-event-item');
    expect(cards.length).toBe(1);

    // Group count badge is rendered next to the plant name.
    expect(screen.getByText('(4)')).toBeInTheDocument();

    // Card should advertise the click-to-manage affordance for grouped cards.
    expect(screen.getByText(/Click to manage/i)).toBeInTheDocument();
  });

  test('singleton group (count === 1) renders the legacy per-event card unchanged', () => {
    const events: PlantingCalendar[] = [{
      id: 200,
      plantId: 'tomato-1',
      variety: 'Brandywine',
      gardenBedId: 5,
      seedStartDate: new Date('2026-03-15'),
      transplantDate: new Date('2026-05-10'),
      completed: false,
      eventType: 'planting',
    } as PlantingCalendar];

    render(
      <ListView
        plantingEvents={events}
        setPlantingEvents={() => {}}
        lastFrostDate={new Date('2026-04-15')}
        firstFrostDate={new Date('2026-10-15')}
      />
    );

    // Singleton: no "(N)" badge, no "Click to manage" affordance, Remove button still visible.
    expect(screen.queryByText(/Click to manage/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Remove/i }).length).toBeGreaterThan(0);
  });
});
