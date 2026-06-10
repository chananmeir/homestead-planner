/**
 * Slice C tests for EventMarker — calendar/indoor-starts consistency.
 *
 * Asserts the dashed outline visual treatment for "plan-only" seed-start
 * markers (PlantingEvent has a seedStartDate but no linked IndoorSeedStart,
 * so indoorSeedStartStatus == null). Tracked seed starts (status set) must
 * NOT receive the dashed outline.
 *
 * Plan/Slice A reference:
 *   dev/active/production-readiness-audit/calendar-indoor-start-consistency-slice-a-report.md
 */
import React from 'react';
import { render } from '@testing-library/react';

import EventMarker from '../EventMarker';
import type { DateMarker } from '../utils';
import type { PlantingCalendar } from '../../../../types';

// Build a minimal seed-start single-marker for the EventMarker component.
// EventMarker receives a `marker: DateMarkerOrGroup` prop; for a plain
// (non-grouped) marker it expects shape { date, type, event }.
function makeSeedStartMarker(
  overrides: Partial<PlantingCalendar> = {}
): DateMarker {
  const event: PlantingCalendar = {
    id: 1001,
    plantId: 'tomato-1',
    variety: 'Brandywine',
    seedStartDate: new Date('2026-03-15'),
    transplantDate: new Date('2026-05-10'),
    expectedHarvestDate: new Date('2026-07-25'),
    completed: false,
    eventType: 'planting',
    ...overrides,
  } as PlantingCalendar;

  return {
    date: new Date('2026-03-15'),
    type: 'seed-start',
    event,
  };
}

describe('EventMarker — Plan only vs Tracked visual treatment', () => {
  test('plan-only seed-start (indoorSeedStartStatus == null) renders dashed amber outline', () => {
    const marker = makeSeedStartMarker({ indoorSeedStartStatus: undefined });
    const { container } = render(<EventMarker marker={marker} />);

    // The outer marker chip is the only element rendered at the root.
    const chip = container.firstChild as HTMLElement;
    expect(chip).toBeTruthy();
    expect(chip.className).toMatch(/border-dashed/);
    expect(chip.className).toMatch(/border-amber-300/);
    // Tooltip should call out the plan-only state.
    expect(chip.getAttribute('title')).toMatch(/\[Plan only\]/);
  });

  test('tracked seed-start (indoorSeedStartStatus="planned") does NOT render dashed outline', () => {
    const marker = makeSeedStartMarker({ indoorSeedStartStatus: 'planned' });
    const { container } = render(<EventMarker marker={marker} />);

    const chip = container.firstChild as HTMLElement;
    expect(chip).toBeTruthy();
    // Dashed outline is reserved for plan-only — must not appear when tracked.
    expect(chip.className).not.toMatch(/border-dashed/);
    // And tooltip must NOT carry the plan-only flag.
    expect(chip.getAttribute('title') || '').not.toMatch(/Plan only/);
  });

  test('tracked seed-start with status="growing" also does NOT render dashed outline', () => {
    // Any non-null status counts as tracked. Verify a downstream lifecycle
    // value (e.g., 'growing') is treated identically to 'planned'.
    const marker = makeSeedStartMarker({ indoorSeedStartStatus: 'growing' });
    const { container } = render(<EventMarker marker={marker} />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).not.toMatch(/border-dashed/);
  });
});

// Build a minimal transplant single-marker (transplant phase completion lives
// on event.completed, which keeps the overdue assertions unambiguous).
function makeTransplantMarker(
  overrides: Partial<PlantingCalendar> = {}
): DateMarker {
  const event: PlantingCalendar = {
    id: 2001,
    plantId: 'tomato-1',
    variety: 'Roma',
    transplantDate: new Date('2026-05-10'),
    expectedHarvestDate: new Date('2026-07-25'),
    completed: false,
    eventType: 'planting',
    ...overrides,
  } as PlantingCalendar;

  return {
    date: new Date('2026-05-10'),
    type: 'transplant',
    event,
  };
}

describe('EventMarker — overdue styling (simulation-aware today)', () => {
  test('past-date incomplete marker renders red overdue ring + tooltip flag', () => {
    const marker = makeTransplantMarker({ completed: false });
    const { container } = render(<EventMarker marker={marker} todayStr="2026-05-20" />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toMatch(/ring-red-400/);
    expect(chip.getAttribute('title')).toMatch(/\[OVERDUE\]/);
  });

  test('past-date COMPLETED marker is not flagged overdue', () => {
    const marker = makeTransplantMarker({ completed: true });
    const { container } = render(<EventMarker marker={marker} todayStr="2026-05-20" />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).not.toMatch(/ring-red-400/);
    expect(chip.getAttribute('title') || '').not.toMatch(/OVERDUE/);
  });

  test('future-date marker is not flagged overdue', () => {
    const marker = makeTransplantMarker({ completed: false });
    const { container } = render(<EventMarker marker={marker} todayStr="2026-05-01" />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).not.toMatch(/ring-red-400/);
  });

  test('without todayStr no overdue styling is applied (back-compat)', () => {
    const marker = makeTransplantMarker({ completed: false });
    const { container } = render(<EventMarker marker={marker} />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).not.toMatch(/ring-red-400/);
  });

  test('weather warning ring takes precedence over the overdue ring', () => {
    const marker = makeTransplantMarker({ completed: false });
    const { container } = render(
      <EventMarker
        marker={marker}
        todayStr="2026-05-20"
        coldWarnings={{ '2001': 'too_cold' }}
      />
    );

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toMatch(/ring-red-500/); // weather ring
    expect(chip.className).not.toMatch(/ring-red-400/); // overdue ring suppressed
  });
});

describe('EventMarker — skipped (soft-cancelled) styling', () => {
  test('skipped marker renders greyed out with strikethrough and [Skipped] tooltip', () => {
    const marker = makeTransplantMarker({ cancelledAt: '2026-05-12T10:00:00' });
    const { container } = render(<EventMarker marker={marker} todayStr="2026-05-20" />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toMatch(/opacity-40/);
    expect(chip.className).toMatch(/grayscale/);
    expect(chip.getAttribute('title')).toMatch(/\[Skipped\]/);
    // Skipped rows are excluded from overdue nagging.
    expect(chip.getAttribute('title') || '').not.toMatch(/OVERDUE/);
  });

  test('active marker (cancelledAt null) renders normally', () => {
    const marker = makeTransplantMarker({ cancelledAt: null });
    const { container } = render(<EventMarker marker={marker} todayStr="2026-05-01" />);

    const chip = container.firstChild as HTMLElement;
    expect(chip.className).not.toMatch(/opacity-40/);
    expect(chip.getAttribute('title') || '').not.toMatch(/Skipped/);
  });
});
