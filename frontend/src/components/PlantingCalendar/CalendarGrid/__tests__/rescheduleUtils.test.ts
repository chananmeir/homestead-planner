/**
 * Tests for the drag-to-reschedule helpers added to CalendarGrid/utils.ts.
 *
 * getDateFieldForMarkerType maps a marker's type to the PlantingEvent date
 * field that dragging/rescheduling it must update; isMarkerSkipped detects
 * soft-cancelled markers (single + grouped).
 */
import {
  getDateFieldForMarkerType,
  isMarkerSkipped,
  getMarkerEvents,
  DateMarker,
  GroupedDateMarker,
} from '../utils';
import type { PlantingCalendar } from '../../../../types';

const makeEvent = (overrides: Partial<PlantingCalendar> = {}): PlantingCalendar =>
  ({
    id: 1,
    plantId: 'tomato-1',
    completed: false,
    eventType: 'planting',
    ...overrides,
  } as PlantingCalendar);

const makeMarker = (overrides: Partial<DateMarker> = {}): DateMarker => ({
  date: new Date('2026-05-10'),
  type: 'transplant',
  event: makeEvent(),
  ...overrides,
});

describe('getDateFieldForMarkerType', () => {
  test.each([
    ['seed-start', 'seedStartDate'],
    ['transplant', 'transplantDate'],
    ['direct-seed', 'directSeedDate'],
    ['harvest', 'expectedHarvestDate'],
    // Maintenance events store their event date in expectedHarvestDate.
    ['mulch-application', 'expectedHarvestDate'],
    ['maple-tapping', 'expectedHarvestDate'],
    ['fertilizing', 'expectedHarvestDate'],
    ['irrigation', 'expectedHarvestDate'],
    ['custom-event', 'expectedHarvestDate'],
  ] as const)('%s markers reschedule %s', (markerType, expectedField) => {
    expect(getDateFieldForMarkerType(markerType)).toBe(expectedField);
  });
});

describe('isMarkerSkipped / getMarkerEvents', () => {
  test('single active marker is not skipped', () => {
    const marker = makeMarker();
    expect(isMarkerSkipped(marker)).toBe(false);
    expect(getMarkerEvents(marker)).toHaveLength(1);
  });

  test('single cancelled marker is skipped', () => {
    const marker = makeMarker({ event: makeEvent({ cancelledAt: '2026-05-12T10:00:00' }) });
    expect(isMarkerSkipped(marker)).toBe(true);
  });

  test('grouped marker is skipped only when EVERY event is cancelled', () => {
    const base: Omit<GroupedDateMarker, 'events' | 'count'> = {
      date: new Date('2026-05-10'),
      type: 'transplant',
      plantId: 'tomato-1',
      variety: 'Roma',
      gardenBedId: 1,
    };

    const mixed: GroupedDateMarker = {
      ...base,
      events: [makeEvent({ id: 1, cancelledAt: '2026-05-12T10:00:00' }), makeEvent({ id: 2 })],
      count: 2,
    };
    expect(isMarkerSkipped(mixed)).toBe(false);
    expect(getMarkerEvents(mixed)).toHaveLength(2);

    const allCancelled: GroupedDateMarker = {
      ...base,
      events: [
        makeEvent({ id: 1, cancelledAt: '2026-05-12T10:00:00' }),
        makeEvent({ id: 2, cancelledAt: '2026-05-12T10:05:00' }),
      ],
      count: 2,
    };
    expect(isMarkerSkipped(allCancelled)).toBe(true);
  });
});
