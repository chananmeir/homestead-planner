import { PlantedItem } from '../../../types';
import {
  canClearHarvestedPlantedItem,
  canMarkPlantedItemFailed,
  getBulkFailureGroupsForPlantedItem,
  getBulkHarvestedClearGroupsForPlantedItem,
  getPlantedItemDisplayStatus,
  getTotalPlantedQuantity,
  isPlantedItemActiveOnDate,
  distributePlantsAcrossCells,
  distributePlantsEvenlyAcrossCells,
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

describe('distributePlantsEvenlyAcrossCells', () => {
  const rowCells = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ];

  test('spreads a custom carrot row evenly instead of filling the first cell', () => {
    const { positions, notFitted } = distributePlantsEvenlyAcrossCells(rowCells, 48, 16);

    expect(positions).toEqual([
      { x: 0, y: 1, quantity: 12 },
      { x: 1, y: 1, quantity: 12 },
      { x: 2, y: 1, quantity: 12 },
      { x: 3, y: 1, quantity: 12 },
    ]);
    expect(notFitted).toBe(0);
  });

  test('puts remainder plants in the earliest cells', () => {
    const { positions, notFitted } = distributePlantsEvenlyAcrossCells(rowCells, 50, 16);

    expect(positions).toEqual([
      { x: 0, y: 1, quantity: 13 },
      { x: 1, y: 1, quantity: 13 },
      { x: 2, y: 1, quantity: 12 },
      { x: 3, y: 1, quantity: 12 },
    ]);
    expect(notFitted).toBe(0);
  });

  test('caps each row cell at SFG capacity and reports surplus', () => {
    const { positions, notFitted } = distributePlantsEvenlyAcrossCells(rowCells, 70, 16);

    expect(positions).toEqual([
      { x: 0, y: 1, quantity: 16 },
      { x: 1, y: 1, quantity: 16 },
      { x: 2, y: 1, quantity: 16 },
      { x: 3, y: 1, quantity: 16 },
    ]);
    expect(notFitted).toBe(6);
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

describe('getTotalPlantedQuantity', () => {
  test('sums individual plant quantities instead of placement records', () => {
    expect(
      getTotalPlantedQuantity([
        { ...baseItem, id: 10, quantity: 8 },
        { ...baseItem, id: 11, quantity: 4 },
      ])
    ).toBe(12);
  });

  test('ignores negative legacy quantities in plant-count UI totals', () => {
    expect(
      getTotalPlantedQuantity([
        { ...baseItem, id: 12, quantity: -2 },
        { ...baseItem, id: 13, quantity: 3 },
      ])
    ).toBe(3);
  });
});

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

  test('hides a soft-cleared final-harvest item', () => {
    expect(
      isPlantedItemActiveOnDate(
        { ...baseItem, clearedAt: '2026-05-04T12:00:00Z' },
        new Date('2026-05-05T00:00:00')
      )
    ).toBe(false);
  });
});

describe('canMarkPlantedItemFailed', () => {
  test('allows already-due planned plants to be recorded as a failed/no-yield outcome', () => {
    expect(
      canMarkPlantedItemFailed(
        { ...baseItem, status: 'planned', plantedDate: new Date('2026-05-01T00:00:00') },
        new Date('2026-05-07T00:00:00')
      )
    ).toBe(true);
  });

  test('does not offer failure for future planned plants', () => {
    expect(
      canMarkPlantedItemFailed(
        { ...baseItem, status: 'planned', plantedDate: new Date('2026-05-10T00:00:00') },
        new Date('2026-05-07T00:00:00')
      )
    ).toBe(false);
  });

  test('keeps the failure action for active non-planned plants', () => {
    expect(canMarkPlantedItemFailed({ ...baseItem, status: 'growing' }, new Date('2026-05-07T00:00:00'))).toBe(true);
  });

  test('blocks terminal or unavailable lifecycle states', () => {
    expect(canMarkPlantedItemFailed({ ...baseItem, status: 'harvested' }, new Date('2026-05-07T00:00:00'))).toBe(false);
    expect(canMarkPlantedItemFailed({ ...baseItem, status: 'failed' }, new Date('2026-05-07T00:00:00'))).toBe(false);
    expect(canMarkPlantedItemFailed({ ...baseItem, outcome: 'failed' }, new Date('2026-05-07T00:00:00'))).toBe(false);
    expect(canMarkPlantedItemFailed({ ...baseItem, cancelledAt: '2026-05-02T12:00:00Z' }, new Date('2026-05-07T00:00:00'))).toBe(false);
    expect(canMarkPlantedItemFailed({ ...baseItem, clearedAt: '2026-05-02T12:00:00Z' }, new Date('2026-05-07T00:00:00'))).toBe(false);
    expect(canMarkPlantedItemFailed({ ...baseItem, saveForSeed: true }, new Date('2026-05-07T00:00:00'))).toBe(false);
    expect(canMarkPlantedItemFailed({ ...baseItem, seedsCollected: true }, new Date('2026-05-07T00:00:00'))).toBe(false);
  });
});

describe('getBulkFailureGroupsForPlantedItem', () => {
  test('groups eligible same-row and all matching same-date variety items', () => {
    const source: PlantedItem = {
      ...baseItem,
      id: 10,
      plantId: 'carrot-1',
      variety: 'Royal Chantenay',
      plantedDate: new Date('2026-05-01T00:00:00'),
      harvestDate: undefined,
      status: 'planned',
      position: { x: 0, y: 1 },
    };
    const sameRow: PlantedItem = { ...source, id: 11, position: { x: 1, y: 1 } };
    const otherRow: PlantedItem = { ...source, id: 12, position: { x: 0, y: 2 } };
    const differentVariety: PlantedItem = { ...source, id: 13, variety: 'Nantes', position: { x: 2, y: 1 } };
    const differentDate: PlantedItem = { ...source, id: 14, plantedDate: new Date('2026-05-08T00:00:00'), position: { x: 3, y: 1 } };
    const alreadyFailed: PlantedItem = { ...source, id: 15, outcome: 'didnt_establish', position: { x: 4, y: 1 } };

    const { rowItems, allMatchingItems } = getBulkFailureGroupsForPlantedItem(
      [differentDate, otherRow, alreadyFailed, sameRow, source, differentVariety],
      source,
      new Date('2026-05-07T00:00:00')
    );

    expect(rowItems.map(item => item.id)).toEqual([10, 11]);
    expect(allMatchingItems.map(item => item.id)).toEqual([10, 11, 12]);
  });

  test('returns empty groups when the selected item is not eligible for failure', () => {
    const futureSource: PlantedItem = {
      ...baseItem,
      id: 20,
      status: 'planned',
      plantedDate: new Date('2026-05-10T00:00:00'),
    };

    expect(
      getBulkFailureGroupsForPlantedItem([futureSource], futureSource, new Date('2026-05-07T00:00:00'))
    ).toEqual({ rowItems: [], allMatchingItems: [] });
  });
});

describe('getBulkHarvestedClearGroupsForPlantedItem', () => {
  test('allows only harvested, not-cleared, non-terminal items to be clear-only closed', () => {
    expect(canClearHarvestedPlantedItem({ ...baseItem, status: 'harvested' })).toBe(true);
    expect(canClearHarvestedPlantedItem({ ...baseItem, status: 'growing' })).toBe(false);
    expect(canClearHarvestedPlantedItem({ ...baseItem, status: 'harvested', clearedAt: '2026-05-08T00:00:00Z' })).toBe(false);
    expect(canClearHarvestedPlantedItem({ ...baseItem, status: 'harvested', outcome: 'failed' })).toBe(false);
    expect(canClearHarvestedPlantedItem({ ...baseItem, status: 'harvested', cancelledAt: '2026-05-02T12:00:00Z' })).toBe(false);
  });

  test('groups harvested clear candidates by same row and all matching same-date variety items', () => {
    const source: PlantedItem = {
      ...baseItem,
      id: 30,
      plantId: 'collard-1',
      variety: 'Vates',
      plantedDate: new Date('2026-04-01T00:00:00'),
      status: 'harvested',
      position: { x: 0, y: 2 },
    };
    const sameRow: PlantedItem = { ...source, id: 31, position: { x: 2, y: 2 } };
    const otherRow: PlantedItem = { ...source, id: 32, position: { x: 0, y: 3 } };
    const growing: PlantedItem = { ...source, id: 33, status: 'growing', position: { x: 3, y: 2 } };
    const cleared: PlantedItem = { ...source, id: 34, clearedAt: '2026-05-04T12:00:00Z', position: { x: 4, y: 2 } };
    const differentDate: PlantedItem = { ...source, id: 35, plantedDate: new Date('2026-04-08T00:00:00'), position: { x: 5, y: 2 } };
    const differentVariety: PlantedItem = { ...source, id: 36, variety: 'Georgia', position: { x: 6, y: 2 } };

    const { rowItems, allMatchingItems } = getBulkHarvestedClearGroupsForPlantedItem(
      [differentVariety, differentDate, cleared, growing, otherRow, sameRow, source],
      source
    );

    expect(rowItems.map(item => item.id)).toEqual([30, 31]);
    expect(allMatchingItems.map(item => item.id)).toEqual([30, 31, 32]);
  });

  test('returns empty groups when the selected item is not a harvested clear candidate', () => {
    const growing: PlantedItem = { ...baseItem, id: 40, status: 'growing' };

    expect(
      getBulkHarvestedClearGroupsForPlantedItem([growing], growing)
    ).toEqual({ rowItems: [], allMatchingItems: [] });
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

  test('shows soft-cleared items as harvested when they are rendered historically', () => {
    expect(getPlantedItemDisplayStatus({ ...baseItem, clearedAt: '2026-05-04T12:00:00Z' })).toEqual({
      label: 'Harvested',
      tone: 'harvested',
    });
  });
});
