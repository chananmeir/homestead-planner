import { PlantedItem } from '../../../types';
import {
  getPlantedItemDisplayStatus,
  isPlantedItemActiveOnDate,
  distributePlantsAcrossCells,
} from '../utils/designerHelpers';

describe('distributePlantsAcrossCells', () => {
  const cells = [
    { x: 0, y: 6 }, // A7
    { x: 1, y: 6 }, // B7
    { x: 2, y: 6 }, // C7
  ];

  test('wide-spacing crop (capacity 1) lays out 1 plant per cell — never stacks', () => {
    const { positions, notFitted } = distributePlantsAcrossCells(cells, 3, 1);
    expect(positions).toEqual([
      { x: 0, y: 6, quantity: 1 },
      { x: 1, y: 6, quantity: 1 },
      { x: 2, y: 6, quantity: 1 },
    ]);
    expect(notFitted).toBe(0);
  });

  test('reproduces the pepper bug fix: 5 plants, capacity 1, only 2 cells offered -> 1 each + 3 not fitted (no 3/2 stacking)', () => {
    const twoCells = [{ x: 0, y: 6 }, { x: 2, y: 6 }];
    const { positions, notFitted } = distributePlantsAcrossCells(twoCells, 5, 1);
    expect(positions).toEqual([
      { x: 0, y: 6, quantity: 1 },
      { x: 2, y: 6, quantity: 1 },
    ]);
    expect(notFitted).toBe(3); // stop at bed edge — surplus surfaced, not stacked
  });

  test('dense crop (capacity 4) fills each cell to capacity before moving on', () => {
    const { positions, notFitted } = distributePlantsAcrossCells(cells, 10, 4);
    expect(positions).toEqual([
      { x: 0, y: 6, quantity: 4 },
      { x: 1, y: 6, quantity: 4 },
      { x: 2, y: 6, quantity: 2 },
    ]);
    expect(notFitted).toBe(0);
  });

  test('exact fit leaves no surplus and uses no extra cells', () => {
    const { positions, notFitted } = distributePlantsAcrossCells(cells, 2, 1);
    expect(positions).toEqual([
      { x: 0, y: 6, quantity: 1 },
      { x: 1, y: 6, quantity: 1 },
    ]);
    expect(notFitted).toBe(0);
  });

  test('zero quantity yields no positions', () => {
    const { positions, notFitted } = distributePlantsAcrossCells(cells, 0, 1);
    expect(positions).toEqual([]);
    expect(notFitted).toBe(0);
  });

  test('capacity is floored to at least 1 to avoid divide-by-zero stalls', () => {
    const { positions, notFitted } = distributePlantsAcrossCells(cells, 2, 0);
    expect(positions).toEqual([
      { x: 0, y: 6, quantity: 1 },
      { x: 1, y: 6, quantity: 1 },
    ]);
    expect(notFitted).toBe(0);
  });
});

const baseItem: PlantedItem = {
  id: 1,
  plantId: 'lettuce-1',
  plantedDate: new Date('2026-05-01T00:00:00'),
  harvestDate: new Date('2026-05-06T00:00:00'),
  position: { x: 0, y: 0 },
  quantity: 1,
  status: 'growing',
};

describe('isPlantedItemActiveOnDate', () => {
  test('keeps an unharvested plant visible after its expected harvest date', () => {
    expect(
      isPlantedItemActiveOnDate(baseItem, new Date('2026-05-07T00:00:00'))
    ).toBe(true);
  });

  test('hides a future-dated planned plant before its planting date', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, plantedDate: new Date('2026-05-10T00:00:00'), status: 'planned' },
        new Date('2026-05-07T00:00:00')
      )
    ).toBe(false);
  });

  test('hides a harvested plant after its actual harvest date', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, status: 'harvested' },
        new Date('2026-05-07T00:00:00')
      )
    ).toBe(false);
  });

  test('keeps a harvested plant visible on the actual harvest date', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, status: 'harvested' },
        new Date('2026-05-06T00:00:00')
      )
    ).toBe(true);
  });

  test('hides a cancelled item even when planted_date is in the past', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, cancelledAt: '2026-05-04T12:00:00Z' },
        new Date('2026-05-05T00:00:00')
      )
    ).toBe(false);
  });

  test('hides a cancelled item on future view dates', () => {
    expect(
      isPlantedItemActiveOnDate(
        {
          ...baseItem,
          plantedDate: new Date('2026-07-01T00:00:00'),
          harvestDate: undefined,
          status: 'planned',
          cancelledAt: '2026-07-01T12:00:00Z',
        },
        new Date('2026-07-12T00:00:00')
      )
    ).toBe(false);
  });

  test('shows an uncancelled (cancelledAt=null) item normally', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, cancelledAt: null },
        new Date('2026-05-05T00:00:00')
      )
    ).toBe(true);
  });
});

describe('getPlantedItemDisplayStatus', () => {
  test('shows future placed items as scheduled', () => {
    expect(
      getPlantedItemDisplayStatus(
        { ...baseItem, plantedDate: new Date('2026-05-10T00:00:00'), status: 'planned' },
        new Date('2026-05-07T00:00:00')
      )
    ).toEqual({ label: 'Scheduled', tone: 'scheduled' });
  });

  test('shows active placed planned items as growing', () => {
    expect(
      getPlantedItemDisplayStatus(
        { ...baseItem, plantedDate: new Date('2026-05-01T00:00:00'), status: 'planned' },
        new Date('2026-05-07T00:00:00')
      )
    ).toEqual({ label: 'Growing', tone: 'growing' });
  });

  test('keeps explicit in-bed lifecycle labels', () => {
    expect(getPlantedItemDisplayStatus({ ...baseItem, status: 'seeded' }).label).toBe('Seeded');
    expect(getPlantedItemDisplayStatus({ ...baseItem, status: 'transplanted' }).label).toBe('Transplanted');
    expect(getPlantedItemDisplayStatus({ ...baseItem, status: 'saving-seed' }).label).toBe('Saving seed');
  });
});
