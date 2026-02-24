import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const SI_USER = {
  username: `si_test_${RUN_ID}`,
  email: `si_test_${RUN_ID}@test.com`,
  password: 'SiTest1!',
};

/**
 * Seed Inventory — E2E Tests
 *
 * Covers: seed CRUD (create custom, edit, delete via API), agronomic overrides
 * (NULL vs 0), list/search/filter verification in UI, sort, seed catalog browse,
 * and catalog-to-personal clone.
 *
 * Strategy: API-first for data setup + UI verification in My Seeds tab.
 */
test.describe.serial('Seed Inventory — E2E Tests', () => {
  let ctx: APIRequestContext;

  // Track seed IDs across tests
  let tomatoSeedId: number;
  let pepperSeedId: number;
  let carrotSeedId: number;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, SI_USER.username, SI_USER.email, SI_USER.password);
    await loginViaAPI(ctx, SI_USER.username, SI_USER.password);
  });

  test.afterAll(async () => {
    // Cleanup: delete all seeds for this user
    const resp = await ctx.get('/api/my-seeds');
    if (resp.ok()) {
      const seeds = await resp.json();
      for (const seed of seeds) {
        await ctx.delete(`/api/seeds/${seed.id}`).catch(() => {});
      }
    }
    await ctx.dispose();
  });

  // Helper: navigate to My Seeds tab
  async function setupMySeeds(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, SI_USER.username, SI_USER.password);
    await navigateTo(page, TABS.MY_SEEDS);
    // Wait for page to load (Add New Seed button visible)
    await expect(page.locator('[data-testid="btn-add-seed"]')).toBeVisible({ timeout: 10000 });
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Seed CRUD via API
  // ════════════════════════════════════════════════════════════════════

  test('SI-01: Create custom seed via API', async () => {
    const resp = await ctx.post('/api/seeds', {
      data: {
        plantId: 'tomato-1',
        variety: `E2E Cherokee ${RUN_ID}`,
        brand: 'Test Brand',
        quantity: 3,
        germinationRate: 85,
        location: 'Basement shelf',
        notes: 'E2E test tomato seed',
        daysToMaturity: 75,
        plantSpacing: 24,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const seed = await resp.json();
    tomatoSeedId = seed.id;

    expect(seed.plantId).toBe('tomato-1');
    expect(seed.variety).toBe(`E2E Cherokee ${RUN_ID}`);
    expect(seed.brand).toBe('Test Brand');
    expect(seed.quantity).toBe(3);
    expect(seed.germinationRate).toBe(85);
    expect(seed.location).toBe('Basement shelf');
    expect(seed.notes).toBe('E2E test tomato seed');
    expect(seed.daysToMaturity).toBe(75);
    expect(seed.plantSpacing).toBe(24);
    expect(seed.isGlobal).toBe(false);
  });

  test('SI-02: Create second seed with different category via API', async () => {
    const resp = await ctx.post('/api/seeds', {
      data: {
        plantId: 'pepper-1',
        variety: `E2E Jalapeno ${RUN_ID}`,
        quantity: 5,
        germinationRate: 90,
        daysToMaturity: 65,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const seed = await resp.json();
    pepperSeedId = seed.id;

    expect(seed.plantId).toBe('pepper-1');
    expect(seed.variety).toBe(`E2E Jalapeno ${RUN_ID}`);
    expect(seed.quantity).toBe(5);
  });

  test('SI-03: Create seed with agronomic override of 0 (NULL vs 0)', async () => {
    // daysToMaturity=0 is a valid explicit value (not NULL)
    const resp = await ctx.post('/api/seeds', {
      data: {
        plantId: 'carrot-1',
        variety: `E2E Nantes ${RUN_ID}`,
        quantity: 2,
        daysToMaturity: 0,
        plantSpacing: 0,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const seed = await resp.json();
    carrotSeedId = seed.id;

    // Verify 0 is preserved, not null
    expect(seed.daysToMaturity).toBe(0);
    expect(seed.plantSpacing).toBe(0);
    // Other agronomic fields should be absent (to_dict omits null fields)
    expect(seed.rowSpacing).toBeUndefined();
    expect(seed.plantingDepth).toBeUndefined();
  });

  test('SI-04: GET /api/my-seeds returns all created seeds', async () => {
    const resp = await ctx.get('/api/my-seeds');
    expect(resp.ok()).toBeTruthy();
    const seeds = await resp.json();

    // Should have at least our 3 seeds
    expect(seeds.length).toBeGreaterThanOrEqual(3);

    // Verify tomato seed is present
    const tomato = seeds.find((s: any) => s.id === tomatoSeedId);
    expect(tomato).toBeTruthy();
    expect(tomato.plantId).toBe('tomato-1');
    expect(tomato.variety).toBe(`E2E Cherokee ${RUN_ID}`);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Update & Delete via API
  // ════════════════════════════════════════════════════════════════════

  test('SI-05: Update seed via API (quantity + notes)', async () => {
    const resp = await ctx.put(`/api/seeds/${tomatoSeedId}`, {
      data: {
        quantity: 10,
        notes: 'Updated via E2E test',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const updated = await resp.json();

    expect(updated.quantity).toBe(10);
    expect(updated.notes).toBe('Updated via E2E test');
    // Existing fields should be preserved
    expect(updated.germinationRate).toBe(85);
    expect(updated.daysToMaturity).toBe(75);
  });

  test('SI-06: Update seed with agronomic overrides via API', async () => {
    const resp = await ctx.put(`/api/seeds/${pepperSeedId}`, {
      data: {
        daysToMaturity: 70,
        rowSpacing: 18,
        heatTolerance: 'high',
        coldTolerance: 'low',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const updated = await resp.json();

    expect(updated.daysToMaturity).toBe(70);
    expect(updated.rowSpacing).toBe(18);
    expect(updated.heatTolerance).toBe('high');
    expect(updated.coldTolerance).toBe('low');
  });

  test('SI-07: Delete seed via API', async () => {
    const resp = await ctx.delete(`/api/seeds/${carrotSeedId}`);
    expect(resp.status()).toBe(204);

    // Verify it's gone from the list
    const allResp = await ctx.get('/api/my-seeds');
    const seeds = await allResp.json();
    const found = seeds.find((s: any) => s.id === carrotSeedId);
    expect(found).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: UI Verification
  // ════════════════════════════════════════════════════════════════════

  test('SI-08: My Seeds page shows seed cards', async ({ page }) => {
    await setupMySeeds(page);

    // Seed count stat should show 2 (tomato + pepper remaining)
    const seedCount = page.locator('[data-testid="seed-count"]');
    await expect(seedCount).toBeVisible();
    await expect(seedCount).toHaveText('2');

    // Seed cards should be visible
    const tomatoCard = page.locator(`[data-testid="seed-card-${tomatoSeedId}"]`);
    await expect(tomatoCard).toBeVisible();
    await expect(tomatoCard).toContainText(`E2E Cherokee ${RUN_ID}`);

    const pepperCard = page.locator(`[data-testid="seed-card-${pepperSeedId}"]`);
    await expect(pepperCard).toBeVisible();
    await expect(pepperCard).toContainText(`E2E Jalapeno ${RUN_ID}`);
  });

  test('SI-09: Search filters seed cards', async ({ page }) => {
    await setupMySeeds(page);

    // Search for "Cherokee" — should show only tomato
    const searchBar = page.locator('input[placeholder*="Search"]');
    await searchBar.fill(`Cherokee ${RUN_ID}`);
    await page.waitForTimeout(300); // debounce

    // Tomato card should be visible
    const tomatoCard = page.locator(`[data-testid="seed-card-${tomatoSeedId}"]`);
    await expect(tomatoCard).toBeVisible();

    // Pepper card should NOT be visible
    const pepperCard = page.locator(`[data-testid="seed-card-${pepperSeedId}"]`);
    await expect(pepperCard).not.toBeVisible();

    // Clear search — both should reappear
    await searchBar.clear();
    await page.waitForTimeout(300);
    await expect(tomatoCard).toBeVisible();
    await expect(pepperCard).toBeVisible();
  });

  test('SI-10: Add New Seed button opens modal', async ({ page }) => {
    await setupMySeeds(page);

    // Click "Add New Seed" button
    await page.locator('[data-testid="btn-add-seed"]').click();

    // Modal should open with title "Add New Seed"
    await expect(page.locator('text=Add New Seed').first()).toBeVisible({ timeout: 5000 });

    // Plant select should be visible
    await expect(page.locator('text=Plant').first()).toBeVisible();

    // Close it
    await page.keyboard.press('Escape');
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: Seed Catalog
  // ════════════════════════════════════════════════════════════════════

  test('SI-11: GET /api/seed-catalog returns paginated catalog', async () => {
    const resp = await ctx.get('/api/seed-catalog?limit=10');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    // Catalog response has seeds array and pagination
    expect(data).toHaveProperty('seeds');
    expect(data).toHaveProperty('pagination');
    expect(Array.isArray(data.seeds)).toBe(true);
    expect(data.pagination).toHaveProperty('page');
    expect(data.pagination).toHaveProperty('total');
    expect(data.pagination).toHaveProperty('limit');
  });

  test('SI-12: Clone catalog seed to personal inventory', async () => {
    // First, get a catalog seed to clone
    const catalogResp = await ctx.get('/api/seed-catalog?limit=1');
    expect(catalogResp.ok()).toBeTruthy();
    const catalogData = await catalogResp.json();

    // Skip test if no catalog seeds exist
    if (catalogData.seeds.length === 0) {
      test.skip();
      return;
    }

    const catalogSeed = catalogData.seeds[0];

    // Clone it to personal inventory
    const cloneResp = await ctx.post('/api/my-seeds/from-catalog', {
      data: {
        catalogSeedId: catalogSeed.id,
        quantity: 2,
        location: 'E2E cloned seed location',
      },
    });
    expect(cloneResp.ok()).toBeTruthy();
    const cloned = await cloneResp.json();

    expect(cloned.plantId).toBe(catalogSeed.plantId);
    expect(cloned.variety).toBe(catalogSeed.variety);
    expect(cloned.quantity).toBe(2);
    expect(cloned.location).toBe('E2E cloned seed location');
    expect(cloned.isGlobal).toBe(false);
    expect(cloned.catalogSeedId).toBe(catalogSeed.id);

    // Cleanup: delete cloned seed
    await ctx.delete(`/api/seeds/${cloned.id}`);
  });
});
