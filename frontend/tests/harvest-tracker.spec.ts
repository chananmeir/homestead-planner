import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const HT_USER = {
  username: `ht_test_${RUN_ID}`,
  email: `ht_test_${RUN_ID}@test.com`,
  password: 'HtTest1!',
};

/**
 * Harvest Tracker — E2E Tests
 *
 * Covers: harvest CRUD (create, update, delete via API), stats aggregation,
 * quality ratings, UI verification (harvest rows, search, log button/modal).
 *
 * Strategy: API-first for data setup + UI verification in Harvests tab.
 */
test.describe.serial('Harvest Tracker — E2E Tests', () => {
  let ctx: APIRequestContext;

  // Track harvest IDs across tests
  let tomatoHarvestId: number;
  let pepperHarvestId: number;
  let carrotHarvestId: number;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, HT_USER.username, HT_USER.email, HT_USER.password);
    await loginViaAPI(ctx, HT_USER.username, HT_USER.password);
  });

  test.afterAll(async () => {
    // Cleanup: delete all harvests for this user
    const resp = await ctx.get('/api/harvests');
    if (resp.ok()) {
      const harvests = await resp.json();
      for (const h of harvests) {
        await ctx.delete(`/api/harvests/${h.id}`).catch(() => {});
      }
    }
    await ctx.dispose();
  });

  // Helper: navigate to Harvests tab
  async function setupHarvests(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, HT_USER.username, HT_USER.password);
    await navigateTo(page, TABS.HARVESTS);
    // Wait for page to load (Log New Harvest button visible)
    await expect(page.locator('[data-testid="btn-log-harvest"]')).toBeVisible({ timeout: 10000 });
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Harvest CRUD via API
  // ════════════════════════════════════════════════════════════════════

  test('HT-01: Create harvest via API', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: {
        plantId: 'tomato-1',
        harvestDate: '2026-02-20T00:00:00',
        quantity: 5.5,
        unit: 'lbs',
        quality: 'excellent',
        notes: `E2E tomato harvest ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const harvest = await resp.json();
    tomatoHarvestId = harvest.id;

    expect(harvest.plantId).toBe('tomato-1');
    expect(harvest.quantity).toBe(5.5);
    expect(harvest.unit).toBe('lbs');
    expect(harvest.quality).toBe('excellent');
    expect(harvest.notes).toBe(`E2E tomato harvest ${RUN_ID}`);
    expect(harvest.harvestDate).toBeTruthy();
  });

  test('HT-02: Create harvest with different quality and unit', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: {
        plantId: 'pepper-1',
        harvestDate: '2026-02-21T00:00:00',
        quantity: 12,
        unit: 'count',
        quality: 'good',
        notes: `E2E pepper harvest ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const harvest = await resp.json();
    pepperHarvestId = harvest.id;

    expect(harvest.plantId).toBe('pepper-1');
    expect(harvest.quantity).toBe(12);
    expect(harvest.unit).toBe('count');
    expect(harvest.quality).toBe('good');
  });

  test('HT-03: Create third harvest for stats testing', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: {
        plantId: 'carrot-1',
        harvestDate: '2026-02-22T00:00:00',
        quantity: 3,
        unit: 'lbs',
        quality: 'fair',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const harvest = await resp.json();
    carrotHarvestId = harvest.id;

    expect(harvest.plantId).toBe('carrot-1');
    expect(harvest.quality).toBe('fair');
  });

  test('HT-04: GET /api/harvests returns all created harvests', async () => {
    const resp = await ctx.get('/api/harvests');
    expect(resp.ok()).toBeTruthy();
    const harvests = await resp.json();

    expect(harvests.length).toBeGreaterThanOrEqual(3);

    // Verify tomato harvest is present
    const tomato = harvests.find((h: any) => h.id === tomatoHarvestId);
    expect(tomato).toBeTruthy();
    expect(tomato.plantId).toBe('tomato-1');
    expect(tomato.quality).toBe('excellent');
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Update, Delete & Stats
  // ════════════════════════════════════════════════════════════════════

  test('HT-05: Update harvest via API (quantity + quality)', async () => {
    const resp = await ctx.put(`/api/harvests/${tomatoHarvestId}`, {
      data: {
        quantity: 8.0,
        quality: 'good',
        notes: `Updated via E2E ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const result = await resp.json();
    expect(result.message).toBe('Harvest updated successfully');

    // Verify via GET
    const allResp = await ctx.get('/api/harvests');
    const harvests = await allResp.json();
    const updated = harvests.find((h: any) => h.id === tomatoHarvestId);
    expect(updated.quantity).toBe(8.0);
    expect(updated.quality).toBe('good');
    expect(updated.notes).toBe(`Updated via E2E ${RUN_ID}`);
  });

  test('HT-06: GET /api/harvests/stats returns aggregated stats', async () => {
    const resp = await ctx.get('/api/harvests/stats');
    expect(resp.ok()).toBeTruthy();
    const stats = await resp.json();

    // Should have stats for at least our 3 plants
    expect(Object.keys(stats).length).toBeGreaterThanOrEqual(3);

    // Tomato stats (updated to 8.0 lbs)
    expect(stats['tomato-1']).toBeTruthy();
    expect(stats['tomato-1'].total).toBe(8.0);
    expect(stats['tomato-1'].count).toBe(1);

    // Pepper stats
    expect(stats['pepper-1']).toBeTruthy();
    expect(stats['pepper-1'].total).toBe(12);
    expect(stats['pepper-1'].count).toBe(1);

    // Carrot stats
    expect(stats['carrot-1']).toBeTruthy();
    expect(stats['carrot-1'].total).toBe(3);
  });

  test('HT-07: Delete harvest via API', async () => {
    const resp = await ctx.delete(`/api/harvests/${carrotHarvestId}`);
    expect(resp.status()).toBe(204);

    // Verify it's gone
    const allResp = await ctx.get('/api/harvests');
    const harvests = await allResp.json();
    const found = harvests.find((h: any) => h.id === carrotHarvestId);
    expect(found).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: UI Verification
  // ════════════════════════════════════════════════════════════════════

  test('HT-08: Harvests page shows harvest rows', async ({ page }) => {
    await setupHarvests(page);

    // Harvest count stat should show 2 (tomato + pepper remaining)
    const harvestCount = page.locator('[data-testid="harvest-count"]');
    await expect(harvestCount).toBeVisible();
    await expect(harvestCount).toHaveText('2');

    // Harvest rows should be visible
    const tomatoRow = page.locator(`[data-testid="harvest-row-${tomatoHarvestId}"]`);
    await expect(tomatoRow).toBeVisible();

    const pepperRow = page.locator(`[data-testid="harvest-row-${pepperHarvestId}"]`);
    await expect(pepperRow).toBeVisible();
  });

  test('HT-09: Search filters harvest rows', async ({ page }) => {
    await setupHarvests(page);

    // Search for tomato — should filter results
    const searchBar = page.locator('input[placeholder*="Search"]');
    await searchBar.fill('Tomato');
    await page.waitForTimeout(300); // debounce

    // Tomato row should be visible
    const tomatoRow = page.locator(`[data-testid="harvest-row-${tomatoHarvestId}"]`);
    await expect(tomatoRow).toBeVisible();

    // Pepper row should NOT be visible
    const pepperRow = page.locator(`[data-testid="harvest-row-${pepperHarvestId}"]`);
    await expect(pepperRow).not.toBeVisible();

    // Clear search — both should reappear
    await searchBar.clear();
    await page.waitForTimeout(300);
    await expect(tomatoRow).toBeVisible();
    await expect(pepperRow).toBeVisible();
  });

  test('HT-10: Log New Harvest button opens modal', async ({ page }) => {
    await setupHarvests(page);

    // Click "Log New Harvest" button
    await page.locator('[data-testid="btn-log-harvest"]').click();

    // Modal should open with title "Log New Harvest"
    await expect(page.locator('text=Log New Harvest').first()).toBeVisible({ timeout: 5000 });

    // Plant select should be visible
    await expect(page.locator('text=Plant').first()).toBeVisible();

    // Close it
    await page.keyboard.press('Escape');
  });
});
