/**
 * Tests for autoPlacePlants — row-display stacking bug, cell-selection half.
 *
 * The June 2026 fix has two halves: distributePlantsAcrossCells (capacity
 * capping, tested in designerHelpers.test.ts) and the SFG-aware placement
 * stride tested here. In square-foot beds the SFG lookup table is
 * authoritative: a pepper (18" spacing but 1/sq in the table) fills
 * CONSECUTIVE cells (A7,B7,C7) instead of skipping every other cell, while
 * non-SFG methods keep the real-spacing stride per the locked decision in
 * dev/active/seed-planning-ui-improvements/row-display-investigation.md.
 */
import { autoPlacePlants } from '../utils/autoPlacement';
import type { Plant, PlantedItem } from '../../../types';

const pepper = {
  id: 'pepper-1',
  name: 'Pepper',
  category: 'vegetable',
  spacing: 18, // wider than a 12" SFG cell — the bug's trigger
} as Plant;

const melon = {
  id: 'melon-1',
  name: 'Melon',
  category: 'vegetable',
  spacing: 24, // SFG table: 0.5 per square → 1 plant per 2 squares
} as Plant;

const lettuce = {
  id: 'lettuce-1',
  name: 'Lettuce',
  category: 'vegetable',
  spacing: 6, // dense (≤ grid size)
} as Plant;

const baseRequest = {
  startPosition: { x: 0, y: 0 },
  bedDimensions: { gridWidth: 8, gridHeight: 4 },
  gridSize: 12,
  existingPlants: [] as PlantedItem[],
};

describe('autoPlacePlants — SFG stride override (row stacking bug)', () => {
  test('pepper row in a square-foot bed fills CONSECUTIVE cells (A7,B7,C7 — the bug repro)', () => {
    const result = autoPlacePlants({
      ...baseRequest,
      plant: pepper,
      quantity: 3,
      planningMethod: 'square-foot',
      plantingStyle: 'row',
      maxRows: 1,
    });

    // Before the fix: stride ceil(18/12)=2 rejected the middle cell → [0,2] only.
    expect(result.positions).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  test('pepper row in a ROW-method bed keeps the real-spacing stride (every other cell)', () => {
    const result = autoPlacePlants({
      ...baseRequest,
      plant: pepper,
      quantity: 3,
      planningMethod: 'row',
      plantingStyle: 'row',
      maxRows: 1,
    });

    // Locked decision: non-SFG methods respect real spacing — 18" on a 12"
    // grid steps every other cell.
    expect(result.positions).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  test('melon (0.5/sq in the SFG table) still claims two squares of separation', () => {
    const result = autoPlacePlants({
      ...baseRequest,
      plant: melon,
      quantity: 3,
      planningMethod: 'square-foot',
      plantingStyle: 'row',
      maxRows: 1,
    });

    expect(result.positions).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  test('SFG pepper can be placed directly beside an EXISTING pepper', () => {
    const existing = [
      { id: 1, plantId: 'pepper-1', position: { x: 0, y: 0 }, quantity: 1 } as PlantedItem,
    ];
    const result = autoPlacePlants({
      ...baseRequest,
      existingPlants: existing,
      startPosition: { x: 1, y: 0 },
      plant: pepper,
      quantity: 1,
      planningMethod: 'square-foot',
      plantingStyle: 'row',
      maxRows: 1,
    });

    // Old code demanded Chebyshev ≥ 2 from existing plants → (1,0) rejected.
    expect(result.positions).toEqual([{ x: 1, y: 0 }]);
  });

  test('dense lettuce is unaffected: consecutive cells in any method', () => {
    const result = autoPlacePlants({
      ...baseRequest,
      plant: lettuce,
      quantity: 4,
      planningMethod: 'square-foot',
      plantingStyle: 'row',
      maxRows: 1,
    });

    expect(result.positions).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  test('stops at the bed edge and reports the shortfall (no stacking)', () => {
    const result = autoPlacePlants({
      ...baseRequest,
      plant: pepper,
      quantity: 10, // only 8 cells in one row
      planningMethod: 'square-foot',
      plantingStyle: 'row',
      maxRows: 1,
    });

    expect(result.placed).toBe(8);
    expect(result.failed).toBe(2);
    // Every position unique — never two plants in one cell.
    const keys = new Set(result.positions.map(p => `${p.x},${p.y}`));
    expect(keys.size).toBe(8);
  });
});
