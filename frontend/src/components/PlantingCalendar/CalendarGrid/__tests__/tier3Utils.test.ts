/**
 * Tests for the Tier-3 calendar helpers in CalendarGrid/utils.ts:
 *  - buildSuccessionIndex (series ordering, badge positions, stable colors)
 *  - getMarkerAttention (dashboard-parity harvest-ready / missed mapping)
 *  - buildWeatherFlags (frost / freeze / rain day-strip thresholds)
 */
import {
  buildSuccessionIndex,
  successionColorIdx,
  SUCCESSION_PALETTE,
  getMarkerAttention,
  buildWeatherFlags,
  CalendarAttention,
  DateMarker,
} from '../utils';
import type { PlantingCalendar } from '../../../../types';

const makeEvent = (overrides: Partial<PlantingCalendar> = {}): PlantingCalendar =>
  ({
    id: 1,
    plantId: 'lettuce-1',
    completed: false,
    eventType: 'planting',
    ...overrides,
  } as PlantingCalendar);

describe('buildSuccessionIndex', () => {
  test('indexes a series 1..N ordered by primary planting date', () => {
    const groupId = 'group-abc';
    const events = [
      // Deliberately out of order: third planting listed first.
      makeEvent({ id: 3, successionGroupId: groupId, directSeedDate: new Date('2026-06-08') }),
      makeEvent({ id: 1, successionGroupId: groupId, directSeedDate: new Date('2026-05-11') }),
      makeEvent({ id: 2, successionGroupId: groupId, directSeedDate: new Date('2026-05-25') }),
    ];
    const index = buildSuccessionIndex(events);

    expect(index.get(1)).toMatchObject({ index: 1, total: 3 });
    expect(index.get(2)).toMatchObject({ index: 2, total: 3 });
    expect(index.get(3)).toMatchObject({ index: 3, total: 3 });
    // Whole series shares one palette slot.
    const colors = new Set([1, 2, 3].map(id => index.get(id)!.colorIdx));
    expect(colors.size).toBe(1);
  });

  test('events without a group, and single-event groups, get no badge', () => {
    const events = [
      makeEvent({ id: 1, directSeedDate: new Date('2026-05-11') }),
      makeEvent({ id: 2, successionGroupId: 'lonely', directSeedDate: new Date('2026-05-12') }),
    ];
    const index = buildSuccessionIndex(events);
    expect(index.size).toBe(0);
  });

  test('transplant events order by transplant date when no direct-seed date', () => {
    const groupId = 'group-tp';
    const events = [
      makeEvent({ id: 11, successionGroupId: groupId, transplantDate: new Date('2026-06-01') }),
      makeEvent({ id: 10, successionGroupId: groupId, transplantDate: new Date('2026-05-15') }),
    ];
    const index = buildSuccessionIndex(events);
    expect(index.get(10)!.index).toBe(1);
    expect(index.get(11)!.index).toBe(2);
  });

  test('successionColorIdx is stable and within the palette', () => {
    const a = successionColorIdx('group-abc');
    expect(successionColorIdx('group-abc')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(SUCCESSION_PALETTE.length);
  });
});

describe('getMarkerAttention', () => {
  const attention: CalendarAttention = {
    harvestReady: new Set([7]),
    missed: { transplant: new Set([8]) },
  };

  const marker = (type: DateMarker['type'], id: number): DateMarker => ({
    date: new Date('2026-06-01'),
    type,
    event: makeEvent({ id }),
  });

  test('harvest marker of a harvest-ready event → harvest-ready', () => {
    expect(getMarkerAttention(marker('harvest', 7), attention)).toBe('harvest-ready');
  });

  test('harvest-ready only applies to the harvest marker, not other phases', () => {
    expect(getMarkerAttention(marker('transplant', 7), attention)).toBeUndefined();
  });

  test('transplant marker of a missed event → missed', () => {
    expect(getMarkerAttention(marker('transplant', 8), attention)).toBe('missed');
  });

  test('unlisted events and missing attention map → undefined', () => {
    expect(getMarkerAttention(marker('harvest', 99), attention)).toBeUndefined();
    expect(getMarkerAttention(marker('harvest', 7), undefined)).toBeUndefined();
  });
});

describe('buildWeatherFlags', () => {
  test('frost at ≤32, hard freeze at ≤28', () => {
    expect(buildWeatherFlags({ lowTemp: 31, precipitation: 0 })).toMatchObject({ frost: true, freeze: false });
    expect(buildWeatherFlags({ lowTemp: 27, precipitation: 0 })).toMatchObject({ frost: true, freeze: true });
  });

  test('rain at ≥0.5 inches', () => {
    expect(buildWeatherFlags({ lowTemp: 50, precipitation: 0.8 })).toMatchObject({ rain: true, frost: false });
  });

  test('benign day → null (no strip icons)', () => {
    expect(buildWeatherFlags({ lowTemp: 55, precipitation: 0.1 })).toBeNull();
    expect(buildWeatherFlags({})).toBeNull();
  });
});
