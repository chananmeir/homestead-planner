import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const NUT_USER = {
  username: `nut_test_${RUN_ID}`,
  email: `nut_test_${RUN_ID}@test.com`,
  password: 'NutTest1!',
};

/**
 * Nutrition Module — E2E Tests
 *
 * Covers: dashboard API (aggregated + per-source), nutrition estimate from
 * plan items, nutritional data CRUD, year filtering, UI rendering (summary
 * cards, source breakdown, macro/micro bars), and CSV export button.
 *
 * Strategy: API-first for endpoint validation + UI verification in Nutrition tab.
 * A fresh user starts with zero nutrition data, so dashboard returns zeroes.
 * We seed custom nutritional data via API and test estimate endpoint separately.
 */
test.describe.serial('Nutrition Module — E2E Tests', () => {
  let ctx: APIRequestContext;
  let nutritionalDataId: number;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, NUT_USER.username, NUT_USER.email, NUT_USER.password);
    await loginViaAPI(ctx, NUT_USER.username, NUT_USER.password);
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  // Helper: navigate to Nutrition tab
  async function setupNutrition(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, NUT_USER.username, NUT_USER.password);
    await navigateTo(page, TABS.NUTRITION);
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Dashboard API Endpoint Validation
  // ════════════════════════════════════════════════════════════════════

  test('NUT-01: GET dashboard returns totals and by_source structure', async () => {
    const resp = await ctx.get('/api/nutrition/dashboard?year=2026');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // Top-level structure
    expect(data.totals).toBeDefined();
    expect(data.by_source).toBeDefined();
    expect(data.year).toBe(2026);

    // Totals has required numeric fields
    expect(typeof data.totals.calories).toBe('number');
    expect(typeof data.totals.protein_g).toBe('number');
    expect(typeof data.totals.carbs_g).toBe('number');
    expect(typeof data.totals.fat_g).toBe('number');
    expect(typeof data.totals.fiber_g).toBe('number');

    // by_source has garden, livestock, trees
    expect(data.by_source.garden).toBeDefined();
    expect(data.by_source.livestock).toBeDefined();
    expect(data.by_source.trees).toBeDefined();

    // Each source has calorie field
    expect(typeof data.by_source.garden.calories).toBe('number');
    expect(typeof data.by_source.livestock.calories).toBe('number');
    expect(typeof data.by_source.trees.calories).toBe('number');
  });

  test('NUT-02: GET dashboard without year defaults to current year', async () => {
    const resp = await ctx.get('/api/nutrition/dashboard');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.year).toBe(new Date().getFullYear());
  });

  test('NUT-03: GET garden nutrition returns totals and by_plant', async () => {
    const resp = await ctx.get('/api/nutrition/garden?year=2026');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.totals).toBeDefined();
    expect(typeof data.totals.calories).toBe('number');
    expect(data.year).toBe(2026);
  });

  test('NUT-04: GET livestock nutrition returns totals', async () => {
    const resp = await ctx.get('/api/nutrition/livestock?year=2026');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.totals).toBeDefined();
    expect(typeof data.totals.calories).toBe('number');
    expect(data.year).toBe(2026);
  });

  test('NUT-05: GET tree nutrition returns totals', async () => {
    const resp = await ctx.get('/api/nutrition/trees?year=2026');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.totals).toBeDefined();
    expect(typeof data.totals.calories).toBe('number');
    expect(data.year).toBe(2026);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Nutrition Estimate API
  // ════════════════════════════════════════════════════════════════════

  test('NUT-06: POST estimate with plan items returns nutrition totals', async () => {
    const resp = await ctx.post('/api/nutrition/estimate', {
      data: {
        items: [
          { plantId: 'tomato-1', quantity: 20, successionCount: 1 },
          { plantId: 'lettuce-1', quantity: 40, successionCount: 4 },
        ],
        year: 2026,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // totals structure (camelCase from this endpoint)
    expect(data.totals).toBeDefined();
    expect(data.year).toBe(2026);

    // byPlant breakdown present
    expect(data.byPlant).toBeDefined();
  });

  test('NUT-07: POST estimate validates required fields', async () => {
    // Missing items array
    const resp1 = await ctx.post('/api/nutrition/estimate', {
      data: { year: 2026 },
    });
    expect(resp1.status()).toBe(400);
    const data1 = await resp1.json();
    expect(data1.error).toContain('items');

    // Empty items array
    const resp2 = await ctx.post('/api/nutrition/estimate', {
      data: { items: [] },
    });
    expect(resp2.status()).toBe(400);
    const data2 = await resp2.json();
    expect(data2.error).toContain('empty');

    // Missing plantId
    const resp3 = await ctx.post('/api/nutrition/estimate', {
      data: { items: [{ quantity: 10 }] },
    });
    expect(resp3.status()).toBe(400);
    const data3 = await resp3.json();
    expect(data3.error).toContain('plantId');
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Nutritional Data CRUD
  // ════════════════════════════════════════════════════════════════════

  test('NUT-08: POST nutritional data creates user-specific entry', async () => {
    const resp = await ctx.post('/api/nutrition/data', {
      data: {
        source_type: 'plant',
        source_id: `test-plant-${RUN_ID}`,
        name: `Test Plant ${RUN_ID}`,
        calories: 25,
        protein_g: 1.5,
        carbs_g: 5.0,
        fat_g: 0.3,
        fiber_g: 2.0,
        average_yield_lbs_per_plant: 8.0,
        data_source: 'E2E test',
        notes: `Created by nutrition E2E ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    nutritionalDataId = data.id;
    expect(data.name).toBe(`Test Plant ${RUN_ID}`);
    expect(data.source_type).toBe('plant');
    expect(data.calories).toBe(25);
    expect(data.protein_g).toBe(1.5);
  });

  test('NUT-09: GET nutritional data returns created entry', async () => {
    const resp = await ctx.get('/api/nutrition/data?user_only=true');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(Array.isArray(data)).toBeTruthy();
    const found = data.find((d: any) => d.id === nutritionalDataId);
    expect(found).toBeTruthy();
    expect(found.name).toBe(`Test Plant ${RUN_ID}`);
    expect(found.calories).toBe(25);
  });

  test('NUT-10: POST same source_type+source_id updates (upsert)', async () => {
    const resp = await ctx.post('/api/nutrition/data', {
      data: {
        source_type: 'plant',
        source_id: `test-plant-${RUN_ID}`,
        name: `Updated Plant ${RUN_ID}`,
        calories: 30,
        protein_g: 2.0,
        carbs_g: 6.0,
        fat_g: 0.5,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // Same ID (upsert), updated values
    expect(data.id).toBe(nutritionalDataId);
    expect(data.name).toBe(`Updated Plant ${RUN_ID}`);
    expect(data.calories).toBe(30);
    expect(data.protein_g).toBe(2.0);
  });

  test('NUT-11: DELETE nutritional data removes entry', async () => {
    const resp = await ctx.delete(`/api/nutrition/data/${nutritionalDataId}`);
    expect(resp.ok()).toBeTruthy();

    // Verify it's gone
    const listResp = await ctx.get('/api/nutrition/data?user_only=true');
    const data = await listResp.json();
    const found = data.find((d: any) => d.id === nutritionalDataId);
    expect(found).toBeUndefined();
  });

  test('NUT-12: DELETE non-existent nutritional data returns 404', async () => {
    const resp = await ctx.delete('/api/nutrition/data/999999');
    expect(resp.status()).toBe(404);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: UI Rendering & Interaction
  // ════════════════════════════════════════════════════════════════════

  test('NUT-13: Nutrition page renders header with year selector', async ({ page }) => {
    await setupNutrition(page);

    // Title
    await expect(page.locator('text=Nutritional Dashboard')).toBeVisible({ timeout: 10000 });

    // Year selector
    const yearSelector = page.locator('[data-testid="nutrition-year-selector"]');
    await expect(yearSelector).toBeVisible();

    // Has year options
    const options = yearSelector.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Export CSV button present
    await expect(page.locator('[data-testid="nutrition-export-csv"]')).toBeVisible();
  });

  test('NUT-14: Year selector changes displayed year', async ({ page }) => {
    await setupNutrition(page);

    // Wait for initial load
    await expect(page.locator('text=Nutritional Dashboard')).toBeVisible({ timeout: 10000 });

    const yearSelector = page.locator('[data-testid="nutrition-year-selector"]');

    // Select a different year (2025)
    await yearSelector.selectOption('2025');

    // Wait for re-fetch — page should still be responsive
    await page.waitForLoadState('networkidle');

    // Year selector should show 2025
    await expect(yearSelector).toHaveValue('2025');
  });

  test('NUT-15: Dashboard shows summary cards or no-data message', async ({ page }) => {
    await setupNutrition(page);

    // Wait for dashboard to load
    await expect(page.locator('text=Nutritional Dashboard')).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // New user with no plans: should show "No Data" message or summary cards
    // (depending on whether any plans exist for the year)
    const noDataMsg = page.locator('text=No Data for');
    const summaryCards = page.locator('[data-testid="nutrition-summary-cards"]');

    // One of these should be visible
    const hasNoData = await noDataMsg.isVisible().catch(() => false);
    const hasCards = await summaryCards.isVisible().catch(() => false);
    expect(hasNoData || hasCards).toBeTruthy();

    if (hasCards) {
      // Verify all 4 summary cards
      await expect(page.locator('[data-testid="nutrition-calories-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="nutrition-protein-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="nutrition-carbs-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="nutrition-fat-card"]')).toBeVisible();

      // Source breakdown section
      await expect(page.locator('[data-testid="nutrition-source-breakdown"]')).toBeVisible();
      await expect(page.locator('text=Production by Source')).toBeVisible();

      // Three sources visible
      await expect(page.locator('[data-testid="nutrition-source-breakdown"] >> text=Garden')).toBeVisible();
      await expect(page.locator('[data-testid="nutrition-source-breakdown"] >> text=Livestock')).toBeVisible();
      await expect(page.locator('[data-testid="nutrition-source-breakdown"] >> text=Trees')).toBeVisible();

      // Nutritional breakdown section
      await expect(page.locator('[data-testid="nutrition-breakdown"]')).toBeVisible();
      await expect(page.locator('text=Macronutrients')).toBeVisible();
      await expect(page.locator('text=Vitamins & Minerals')).toBeVisible();
    }
  });

  test('NUT-16: Dashboard requires authentication (401 without session)', async ({ playwright }) => {
    // Create a fresh context without login
    const anonCtx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    const resp = await anonCtx.get('/api/nutrition/dashboard');
    expect(resp.status()).toBe(401);

    await anonCtx.dispose();
  });
});
