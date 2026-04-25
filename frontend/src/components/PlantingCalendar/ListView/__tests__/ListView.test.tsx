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
    const tracked = makeSeedStartEvent({ id: 1, indoorSeedStartStatus: 'planned' });
    const planOnly = makeSeedStartEvent({ id: 2, indoorSeedStartStatus: undefined });

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
