import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI } from './helpers/auth';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const SC_USER = {
  username: `sc_test_${RUN_ID}`,
  email: `sc_test_${RUN_ID}@test.com`,
  password: 'ScTest1!',
};

/**
 * Space Calculation Verification — E2E Tests
 *
 * Covers: /api/spacing-calculator endpoint across all 4 planning methods
 * (SFG, MIGardener, Row, Intensive), verifying spacing values, totalPlants
 * consistency, and known expected outputs for representative plants.
 *
 * Strategy: API-first — POST to /api/spacing-calculator with known plant IDs
 * and bed dimensions, assert response matches expected spacing data from
 * garden_methods.py lookup tables. SFG tests also verify cells-per-plant
 * values match the frontend SFG_PLANTS_PER_CELL lookup table.
 *
 * Note: The /api/spacing-calculator endpoint uses garden_methods.py spacing
 * tables (separate from services/space_calculator.py). Frontend-backend
 * parity for the calculation SERVICE is covered by 114 backend + 55 frontend
 * unit tests in test_space_calculation_sync.py and
 * gardenPlannerSpaceCalculator.test.ts respectively.
 */
test.describe.serial('Space Calculation Verification — E2E Tests', () => {
  let ctx: APIRequestContext;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, SC_USER.username, SC_USER.email, SC_USER.password);
    await loginViaAPI(ctx, SC_USER.username, SC_USER.password);
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Square Foot Gardening Method
  // ════════════════════════════════════════════════════════════════════

  test('SC-01: SFG tomato — 1 per square, cellsPerPlant = 1.0', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'tomato-1', bedWidth: 4, bedLength: 4, method: 'square-foot' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.method).toBe('square-foot');
    expect(data.perSquare).toBe(1);
    expect(data.totalSquares).toBe(16); // 4×4
    expect(data.totalPlants).toBe(16); // 1 per square × 16 squares
    expect(data.gridSize).toBe(12);

    // Parity check: 1/perSquare = cellsPerPlant (frontend SFG lookup)
    expect(1 / data.perSquare).toBeCloseTo(1.0, 4);
  });

  test('SC-02: SFG lettuce — 4 per square, cellsPerPlant = 0.25', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'lettuce-1', bedWidth: 4, bedLength: 4, method: 'square-foot' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.perSquare).toBe(4);
    expect(data.totalPlants).toBe(64); // 4 per square × 16 squares

    // Parity: 1/4 = 0.25 cellsPerPlant
    expect(1 / data.perSquare).toBeCloseTo(0.25, 4);
  });

  test('SC-03: SFG carrot — 16 per square, cellsPerPlant = 0.0625', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'carrot-1', bedWidth: 4, bedLength: 4, method: 'square-foot' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.perSquare).toBe(16);
    expect(data.totalPlants).toBe(256); // 16 per square × 16 squares

    // Parity: 1/16 = 0.0625 cellsPerPlant
    expect(1 / data.perSquare).toBeCloseTo(0.0625, 4);
  });

  test('SC-04: SFG watermelon — 0.5 per square, cellsPerPlant = 2.0', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'watermelon-1', bedWidth: 4, bedLength: 8, method: 'square-foot' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.perSquare).toBe(0.5);
    expect(data.totalSquares).toBe(32); // 4×8
    expect(data.totalPlants).toBe(16); // 0.5 per square × 32 squares

    // Parity: 1/0.5 = 2.0 cellsPerPlant (needs 2 squares)
    expect(1 / data.perSquare).toBeCloseTo(2.0, 4);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: MIGardener Method
  // ════════════════════════════════════════════════════════════════════

  test('SC-05: MIGardener tomato — row and plant spacing values', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'tomato-1', bedWidth: 4, bedLength: 8, method: 'migardener' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.method).toBe('migardener');
    // Verify spacing values are reasonable for tomato
    expect(data.rowSpacing).toBeGreaterThanOrEqual(18);
    expect(data.rowSpacing).toBeLessThanOrEqual(36);
    expect(data.plantSpacing).toBeGreaterThanOrEqual(12);
    expect(data.plantSpacing).toBeLessThanOrEqual(24);

    // Consistency: numRows × plantsPerRow = totalPlants
    expect(data.numRows * data.plantsPerRow).toBe(data.totalPlants);
    expect(data.totalPlants).toBeGreaterThan(0);
  });

  test('SC-06: MIGardener pepper — row and plant spacing values', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'pepper-1', bedWidth: 4, bedLength: 8, method: 'migardener' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.method).toBe('migardener');
    expect(data.rowSpacing).toBeGreaterThanOrEqual(14);
    expect(data.rowSpacing).toBeLessThanOrEqual(24);
    expect(data.plantSpacing).toBeGreaterThanOrEqual(12);
    expect(data.plantSpacing).toBeLessThanOrEqual(18);

    // Consistency
    expect(data.numRows * data.plantsPerRow).toBe(data.totalPlants);
    expect(data.totalPlants).toBeGreaterThan(0);

    // plantsPerSqFt present and positive
    expect(data.plantsPerSqFt).toBeGreaterThan(0);
  });

  test('SC-07: MIGardener carrot — dense sowing spacing', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'carrot-1', bedWidth: 4, bedLength: 8, method: 'migardener' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.method).toBe('migardener');
    // Carrots are ultra-dense in MIGardener: 6" rows, 2" apart
    expect(data.rowSpacing).toBeLessThanOrEqual(8);
    expect(data.plantSpacing).toBeLessThanOrEqual(4);

    // Very high density — many more plants than SFG
    expect(data.totalPlants).toBeGreaterThan(100);

    // Consistency
    expect(data.numRows * data.plantsPerRow).toBe(data.totalPlants);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Row & Intensive Methods
  // ════════════════════════════════════════════════════════════════════

  test('SC-08: Row tomato — standard row spacing (36" rows, 24" apart)', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'tomato-1', bedWidth: 4, bedLength: 8, method: 'row' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.method).toBe('row');
    expect(data.rowSpacing).toBe(36); // 36" between rows
    expect(data.plantSpacing).toBe(24); // 24" between plants

    // 4ft wide = 48" → 48/36 = 1 row (int division)
    expect(data.numRows).toBe(1);
    // 8ft long = 96" → 96/24 = 4 plants per row
    expect(data.plantsPerRow).toBe(4);

    // Consistency
    expect(data.numRows * data.plantsPerRow).toBe(data.totalPlants);
  });

  test('SC-09: Intensive tomato — hexagonal packing with on-center spacing', async () => {
    const resp = await ctx.post('/api/spacing-calculator', {
      data: { plantId: 'tomato-1', bedWidth: 4, bedLength: 4, method: 'intensive' },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.method).toBe('intensive');
    expect(data.spacing).toBe(18); // 18" on-center for tomato
    expect(data.pattern).toBe('hexagonal');

    // totalPlants should be reasonable for 4×4 bed with 18" spacing
    expect(data.totalPlants).toBeGreaterThan(0);
    expect(data.totalPlants).toBeLessThanOrEqual(20);
  });

  test('SC-10: Cross-method comparison — same plant, different densities', async () => {
    // Same plant (lettuce), same bed (4×8), different methods → different yields
    const [sfgResp, rowResp, migResp, intResp] = await Promise.all([
      ctx.post('/api/spacing-calculator', {
        data: { plantId: 'lettuce-1', bedWidth: 4, bedLength: 8, method: 'square-foot' },
      }),
      ctx.post('/api/spacing-calculator', {
        data: { plantId: 'lettuce-1', bedWidth: 4, bedLength: 8, method: 'row' },
      }),
      ctx.post('/api/spacing-calculator', {
        data: { plantId: 'lettuce-1', bedWidth: 4, bedLength: 8, method: 'migardener' },
      }),
      ctx.post('/api/spacing-calculator', {
        data: { plantId: 'lettuce-1', bedWidth: 4, bedLength: 8, method: 'intensive' },
      }),
    ]);

    expect(sfgResp.ok()).toBeTruthy();
    expect(rowResp.ok()).toBeTruthy();
    expect(migResp.ok()).toBeTruthy();
    expect(intResp.ok()).toBeTruthy();

    const sfg = await sfgResp.json();
    const row = await rowResp.json();
    const mig = await migResp.json();
    const int_ = await intResp.json();

    // All return positive plant counts
    expect(sfg.totalPlants).toBeGreaterThan(0);
    expect(row.totalPlants).toBeGreaterThan(0);
    expect(mig.totalPlants).toBeGreaterThan(0);
    expect(int_.totalPlants).toBeGreaterThan(0);

    // SFG: 4 per square × 32 squares = 128
    expect(sfg.totalPlants).toBe(128);

    // MIGardener should yield MORE than traditional row
    // (MIGardener uses tighter spacing for lettuce)
    expect(mig.totalPlants).toBeGreaterThanOrEqual(row.totalPlants);

    // Methods should each report their correct method name
    expect(sfg.method).toBe('square-foot');
    expect(row.method).toBe('row');
    expect(mig.method).toBe('migardener');
    expect(int_.method).toBe('intensive');
  });
});
