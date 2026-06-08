import { calculateHarvestDate } from '../designerHelpers';
import { PlantedItem, Plant } from '../../../../types';

/**
 * Regression tests for calculateHarvestDate DTM resolution.
 *
 * Two behaviors guarded here:
 *  - A days-to-maturity of 0 is a legitimate value and must NOT be dropped by a falsy
 *    check (the old `!plant?.daysToMaturity` bug).
 *  - The server-resolved (learning-aware) DTM takes precedence so the badge reflects
 *    what the maturity model knows.
 */

const baseItem = (overrides: Partial<PlantedItem> = {}): PlantedItem => ({
  id: 1,
  plantId: 'beet-1',
  plantedDate: new Date('2026-04-01'),
  position: { x: 0, y: 0 },
  quantity: 1,
  status: 'growing',
  ...overrides,
}) as PlantedItem;

const plantWithDtm = (dtm: number | undefined): Plant =>
  ({ id: 'beet-1', name: 'Beet', daysToMaturity: dtm } as Plant);

describe('calculateHarvestDate DTM resolution', () => {
  test('DTM of 0 from plant is respected (not treated as falsy/null)', () => {
    const result = calculateHarvestDate(baseItem(), plantWithDtm(0));
    expect(result).not.toBeNull();
    // base date + 0 days = base date
    expect(result!.toDateString()).toBe(new Date('2026-04-01').toDateString());
  });

  test('resolvedDaysToMaturity is preferred over stored harvestDate', () => {
    const item = baseItem({
      harvestDate: new Date('2026-05-01'),  // stored (e.g. plant-default)
      resolvedDaysToMaturity: 70,           // learning-aware: 2026-04-01 + 70 = 2026-06-10
    });
    const result = calculateHarvestDate(item, plantWithDtm(55));
    expect(result!.toDateString()).toBe(new Date('2026-06-10').toDateString());
  });

  test('resolvedDaysToMaturity of 0 is respected', () => {
    const item = baseItem({ resolvedDaysToMaturity: 0 });
    const result = calculateHarvestDate(item, plantWithDtm(55));
    expect(result).not.toBeNull();
    expect(result!.toDateString()).toBe(new Date('2026-04-01').toDateString());
  });

  test('falls back to stored harvestDate when no resolved value', () => {
    const item = baseItem({ harvestDate: new Date('2026-05-15') });
    const result = calculateHarvestDate(item, plantWithDtm(55));
    expect(result!.toDateString()).toBe(new Date('2026-05-15').toDateString());
  });

  test('returns null when plant has no DTM and nothing resolved/stored', () => {
    const result = calculateHarvestDate(baseItem(), plantWithDtm(undefined));
    expect(result).toBeNull();
  });
});
