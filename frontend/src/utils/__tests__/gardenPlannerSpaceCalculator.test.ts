/**
 * Space Calculation Test Suite (Frontend)
 *
 * Tests that the frontend calculateSpaceRequirement() function returns expected
 * values for all 5 planning methods: SFG, MIGardener, Intensive, Row, Permaculture.
 *
 * NOTE: Backend and frontend use DIFFERENT formulas for non-SFG methods.
 * - Backend: ceil(spacing/gridSize) integer grid cells
 * - Frontend: continuous square footage (spacing_product / 144)
 * This divergence is intentional/legacy. Tests document each side independently.
 *
 * Run with: cd frontend && CI=true npx react-scripts test --testPathPattern="gardenPlannerSpaceCalculator" --watchAll=false
 */

import { calculateSpaceRequirement } from '../gardenPlannerSpaceCalculator';
import { MIGARDENER_SPACING_OVERRIDES } from '../migardenerSpacing';
import { INTENSIVE_SPACING_OVERRIDES } from '../intensiveSpacing';
import { SFG_PLANTS_PER_CELL, getSFGCellsRequired } from '../sfgSpacing';
import { Plant } from '../../types';

/**
 * Create a minimal Plant object with sensible defaults.
 * Only spacing-relevant fields need to be parameterized.
 */
function mockPlant(overrides: { id: string; spacing: number; rowSpacing: number }): Plant {
  return {
    name: 'Test Plant',
    category: 'vegetable',
    daysToMaturity: 60,
    frostTolerance: 'tender',
    winterHardy: false,
    companionPlants: [],
    incompatiblePlants: [],
    waterNeeds: 'medium',
    sunRequirement: 'full',
    soilPH: { min: 6.0, max: 7.0 },
    plantingDepth: 0.5,
    germinationTemp: { min: 60, max: 85 },
    transplantWeeksBefore: 0,
    ...overrides,
  };
}

// ============================================================================
// SFG Method Tests
// ============================================================================

describe('SFG method', () => {
  test('tomato-1 → 1.0 (1 per square)', () => {
    const plant = mockPlant({ id: 'tomato-1', spacing: 24, rowSpacing: 36 });
    expect(calculateSpaceRequirement(plant, 12, 'square-foot')).toBe(1.0);
  });

  test('lettuce-1 → 0.25 (4 per square)', () => {
    const plant = mockPlant({ id: 'lettuce-1', spacing: 6, rowSpacing: 12 });
    expect(calculateSpaceRequirement(plant, 12, 'square-foot')).toBe(0.25);
  });

  test('carrot-1 → 0.0625 (16 per square)', () => {
    const plant = mockPlant({ id: 'carrot-1', spacing: 2, rowSpacing: 12 });
    expect(calculateSpaceRequirement(plant, 12, 'square-foot')).toBe(0.0625);
  });

  test('watermelon-1 → 2.0 (0.5 per square)', () => {
    const plant = mockPlant({ id: 'watermelon-1', spacing: 17, rowSpacing: 72 });
    expect(calculateSpaceRequirement(plant, 12, 'square-foot')).toBe(2.0);
  });

  test('pea-1 → 0.125 (8 per square)', () => {
    const plant = mockPlant({ id: 'pea-1', spacing: 4, rowSpacing: 60 });
    expect(calculateSpaceRequirement(plant, 12, 'square-foot')).toBe(0.125);
  });

  test('arugula-1 → 1/9 (9 per square)', () => {
    const plant = mockPlant({ id: 'arugula-1', spacing: 3, rowSpacing: 6 });
    const result = calculateSpaceRequirement(plant, 12, 'square-foot');
    expect(result).toBeCloseTo(1.0 / 9.0, 4);
  });

  test('unknown plant → 1.0 (default)', () => {
    const plant = mockPlant({ id: 'unknown-plant-999', spacing: 12, rowSpacing: 24 });
    expect(calculateSpaceRequirement(plant, 12, 'square-foot')).toBe(1.0);
  });
});

// ============================================================================
// MIGardener Method Tests
// ============================================================================

describe('MIGardener method', () => {
  // Row-based plants: rowSpacing × plantSpacing / 144

  test('tomato-1 → 3.0 (override [24,18], 24×18/144)', () => {
    const plant = mockPlant({ id: 'tomato-1', spacing: 24, rowSpacing: 36 });
    expect(calculateSpaceRequirement(plant, 12, 'migardener')).toBe(3.0);
  });

  test('pepper-1 → 2.625 (override [21,18], 21×18/144)', () => {
    const plant = mockPlant({ id: 'pepper-1', spacing: 18, rowSpacing: 24 });
    expect(calculateSpaceRequirement(plant, 12, 'migardener')).toBe(2.625);
  });

  test('watermelon-1 → 30.0 (override [72,60], 72×60/144)', () => {
    const plant = mockPlant({ id: 'watermelon-1', spacing: 17, rowSpacing: 72 });
    expect(calculateSpaceRequirement(plant, 12, 'migardener')).toBe(30.0);
  });

  test('carrot-1 → 1/12 (override [6,2], 6×2/144)', () => {
    const plant = mockPlant({ id: 'carrot-1', spacing: 2, rowSpacing: 12 });
    const result = calculateSpaceRequirement(plant, 12, 'migardener');
    expect(result).toBeCloseTo(12 / 144, 4); // 0.08333
  });

  // Broadcast plants: plantSpacing² / 144

  test('spinach-1 → 0.1111 (override [null,4], 4²/144)', () => {
    const plant = mockPlant({ id: 'spinach-1', spacing: 4, rowSpacing: 12 });
    const result = calculateSpaceRequirement(plant, 12, 'migardener');
    expect(result).toBeCloseTo(16 / 144, 4); // 0.1111
  });

  test('kale-1 → 0.4444 (override [null,8], 8²/144)', () => {
    const plant = mockPlant({ id: 'kale-1', spacing: 12, rowSpacing: 18 });
    const result = calculateSpaceRequirement(plant, 12, 'migardener');
    expect(result).toBeCloseTo(64 / 144, 4); // 0.4444
  });

  // Seed-density plants: same formula applies (rowSpacing × plantSpacing / 144)

  test('lettuce-1 → 1/36 (override [4,1], 4×1/144)', () => {
    const plant = mockPlant({ id: 'lettuce-1', spacing: 6, rowSpacing: 12 });
    const result = calculateSpaceRequirement(plant, 12, 'migardener');
    expect(result).toBeCloseTo(1 / 36, 4); // 0.02778
  });

  test('arugula-1 → 1/36 (override [4,1], 4×1/144)', () => {
    const plant = mockPlant({ id: 'arugula-1', spacing: 3, rowSpacing: 6 });
    const result = calculateSpaceRequirement(plant, 12, 'migardener');
    expect(result).toBeCloseTo(1 / 36, 4); // 0.02778
  });
});

// ============================================================================
// Intensive Method Tests
// ============================================================================

describe('Intensive method', () => {
  // Frontend formula: onCenter² / 144

  test('tomato-1 → 2.25 (override=18, 18²/144)', () => {
    const plant = mockPlant({ id: 'tomato-1', spacing: 24, rowSpacing: 36 });
    expect(calculateSpaceRequirement(plant, 12, 'intensive')).toBe(2.25);
  });

  test('pepper-1 → 1.0 (override=12, 12²/144)', () => {
    const plant = mockPlant({ id: 'pepper-1', spacing: 18, rowSpacing: 24 });
    expect(calculateSpaceRequirement(plant, 12, 'intensive')).toBe(1.0);
  });

  test('carrot-1 → 0.0625 (override=3, 3²/144)', () => {
    const plant = mockPlant({ id: 'carrot-1', spacing: 2, rowSpacing: 12 });
    expect(calculateSpaceRequirement(plant, 12, 'intensive')).toBe(0.0625);
  });

  test('lettuce-1 → 0.4444 (override=8, 8²/144)', () => {
    const plant = mockPlant({ id: 'lettuce-1', spacing: 6, rowSpacing: 12 });
    const result = calculateSpaceRequirement(plant, 12, 'intensive');
    expect(result).toBeCloseTo(64 / 144, 4);
  });

  test('squash-1 → 4.0 (override=24, 24²/144)', () => {
    const plant = mockPlant({ id: 'squash-1', spacing: 16, rowSpacing: 56 });
    expect(calculateSpaceRequirement(plant, 12, 'intensive')).toBe(4.0);
  });

  test('unknown plant uses standard spacing as fallback', () => {
    // No override → uses plant.spacing directly: 12²/144 = 1.0
    const plant = mockPlant({ id: 'unknown-plant-999', spacing: 12, rowSpacing: 24 });
    expect(calculateSpaceRequirement(plant, 12, 'intensive')).toBe(1.0);
  });
});

// ============================================================================
// Row Method Tests
// ============================================================================

describe('Row method', () => {
  // Frontend formula: rowSpacing × spacing / 144

  test('tomato-1 → 6.0 (24×36/144)', () => {
    const plant = mockPlant({ id: 'tomato-1', spacing: 24, rowSpacing: 36 });
    expect(calculateSpaceRequirement(plant, 12, 'row')).toBe(6.0);
  });

  test('pepper-1 → 3.0 (18×24/144)', () => {
    const plant = mockPlant({ id: 'pepper-1', spacing: 18, rowSpacing: 24 });
    expect(calculateSpaceRequirement(plant, 12, 'row')).toBe(3.0);
  });

  test('lettuce-1 → 0.5 (6×12/144)', () => {
    const plant = mockPlant({ id: 'lettuce-1', spacing: 6, rowSpacing: 12 });
    expect(calculateSpaceRequirement(plant, 12, 'row')).toBe(0.5);
  });

  test('watermelon-1 → 8.5 (17×72/144)', () => {
    const plant = mockPlant({ id: 'watermelon-1', spacing: 17, rowSpacing: 72 });
    expect(calculateSpaceRequirement(plant, 12, 'row')).toBe(8.5);
  });

  test('carrot-1 → 0.1667 (2×12/144)', () => {
    const plant = mockPlant({ id: 'carrot-1', spacing: 2, rowSpacing: 12 });
    const result = calculateSpaceRequirement(plant, 12, 'row');
    expect(result).toBeCloseTo(24 / 144, 4); // 0.16667
  });
});

// ============================================================================
// Permaculture Method Tests
// ============================================================================

describe('Permaculture method', () => {
  // Frontend formula: spacing² / 144

  test('tomato-1 → 4.0 (24²/144)', () => {
    const plant = mockPlant({ id: 'tomato-1', spacing: 24, rowSpacing: 36 });
    expect(calculateSpaceRequirement(plant, 12, 'permaculture')).toBe(4.0);
  });

  test('pepper-1 → 2.25 (18²/144)', () => {
    const plant = mockPlant({ id: 'pepper-1', spacing: 18, rowSpacing: 24 });
    expect(calculateSpaceRequirement(plant, 12, 'permaculture')).toBe(2.25);
  });

  test('lettuce-1 → 0.25 (6²/144)', () => {
    const plant = mockPlant({ id: 'lettuce-1', spacing: 6, rowSpacing: 12 });
    expect(calculateSpaceRequirement(plant, 12, 'permaculture')).toBe(0.25);
  });
});

// ============================================================================
// Lookup Table Sync Tests
// ============================================================================

describe('Lookup table sync', () => {
  test('MIGardener override count is 54', () => {
    const count = Object.keys(MIGARDENER_SPACING_OVERRIDES).length;
    expect(count).toBe(54);
  });

  test('Intensive override count is 27', () => {
    const count = Object.keys(INTENSIVE_SPACING_OVERRIDES).length;
    expect(count).toBe(27);
  });

  test('SFG table contains expected plants', () => {
    expect(SFG_PLANTS_PER_CELL['tomato-1']).toBe(1);
    expect(SFG_PLANTS_PER_CELL['lettuce-1']).toBe(4);
    expect(SFG_PLANTS_PER_CELL['carrot-1']).toBe(16);
    expect(SFG_PLANTS_PER_CELL['watermelon-1']).toBe(0.5);
    expect(SFG_PLANTS_PER_CELL['pea-1']).toBe(8);
    expect(SFG_PLANTS_PER_CELL['arugula-1']).toBe(9);
  });

  test('SFG getSFGCellsRequired matches direct table lookup', () => {
    // Verify the function and table agree
    expect(getSFGCellsRequired('tomato-1')).toBe(1 / SFG_PLANTS_PER_CELL['tomato-1']);
    expect(getSFGCellsRequired('carrot-1')).toBe(1 / SFG_PLANTS_PER_CELL['carrot-1']);
    expect(getSFGCellsRequired('watermelon-1')).toBe(1 / SFG_PLANTS_PER_CELL['watermelon-1']);
  });
});
