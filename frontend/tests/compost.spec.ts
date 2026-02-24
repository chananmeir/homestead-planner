import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const CP_USER = {
  username: `cp_test_${RUN_ID}`,
  email: `cp_test_${RUN_ID}@test.com`,
  password: 'CpTest1!',
};

/**
 * Compost Tracker — E2E Tests
 *
 * Covers: pile CRUD, ingredient addition with C:N recalculation,
 * status lifecycle, moisture update, mark-as-turned, delete with cascade,
 * UI pile cards and C:N ratio display.
 *
 * Strategy: API-first for data setup + UI verification in Compost tab.
 */
test.describe.serial('Compost Tracker — E2E Tests', () => {
  let ctx: APIRequestContext;

  // Track IDs across tests
  let pile1Id: number;
  let pile2Id: number;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, CP_USER.username, CP_USER.email, CP_USER.password);
    await loginViaAPI(ctx, CP_USER.username, CP_USER.password);
  });

  test.afterAll(async () => {
    // Cleanup: delete all compost piles for this user
    const resp = await ctx.get('/api/compost-piles');
    if (resp.ok()) {
      const piles = await resp.json();
      for (const p of piles) {
        await ctx.delete(`/api/compost-piles/${p.id}`).catch(() => {});
      }
    }
    await ctx.dispose();
  });

  // Helper: navigate to Compost tab
  async function setupCompost(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, CP_USER.username, CP_USER.password);
    await navigateTo(page, TABS.COMPOST);
    // Wait for page to load (Add Compost Pile button visible)
    await expect(page.locator('[data-testid="btn-add-pile"]')).toBeVisible({ timeout: 10000 });
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Pile CRUD via API
  // ════════════════════════════════════════════════════════════════════

  test('CP-01: Create compost pile via API', async () => {
    const resp = await ctx.post('/api/compost-piles', {
      data: {
        name: `Main Pile ${RUN_ID}`,
        location: 'Back Corner',
        size: { width: 4, length: 4, height: 3 },
      },
    });
    expect(resp.ok()).toBeTruthy();
    const pile = await resp.json();
    pile1Id = pile.id;

    expect(pile.name).toBe(`Main Pile ${RUN_ID}`);
    expect(pile.location).toBe('Back Corner');
    expect(pile.size.width).toBe(4);
    expect(pile.size.length).toBe(4);
    expect(pile.size.height).toBe(3);
    expect(pile.status).toBe('building');
    expect(pile.moisture).toBe('ideal');
    expect(pile.carbonNitrogenRatio).toBe(30.0);
    expect(pile.ingredients).toHaveLength(0);
  });

  test('CP-02: Create second pile, GET returns both', async () => {
    const resp = await ctx.post('/api/compost-piles', {
      data: {
        name: `Kitchen Scraps ${RUN_ID}`,
        location: 'Near Shed',
        size: { width: 3, length: 3, height: 3 },
      },
    });
    expect(resp.ok()).toBeTruthy();
    const pile = await resp.json();
    pile2Id = pile.id;

    // GET all piles
    const allResp = await ctx.get('/api/compost-piles');
    expect(allResp.ok()).toBeTruthy();
    const piles = await allResp.json();
    expect(piles.length).toBeGreaterThanOrEqual(2);

    const found = piles.find((p: any) => p.id === pile1Id);
    expect(found).toBeTruthy();
    expect(found.name).toBe(`Main Pile ${RUN_ID}`);
  });

  test('CP-03: Update pile status, moisture, and mark turned via API', async () => {
    // Update status to cooking
    let resp = await ctx.put(`/api/compost-piles/${pile1Id}`, {
      data: { status: 'cooking' },
    });
    expect(resp.ok()).toBeTruthy();
    let pile = await resp.json();
    expect(pile.status).toBe('cooking');

    // Update moisture to wet
    resp = await ctx.put(`/api/compost-piles/${pile1Id}`, {
      data: { moisture: 'wet' },
    });
    expect(resp.ok()).toBeTruthy();
    pile = await resp.json();
    expect(pile.moisture).toBe('wet');

    // Mark as turned
    resp = await ctx.put(`/api/compost-piles/${pile1Id}`, {
      data: { lastTurned: true },
    });
    expect(resp.ok()).toBeTruthy();
    pile = await resp.json();
    expect(pile.lastTurned).toBeTruthy();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Ingredients & C:N Ratio Recalculation
  // ════════════════════════════════════════════════════════════════════

  test('CP-04: Add brown ingredient (dried-leaves), C:N ratio increases', async () => {
    const resp = await ctx.post(`/api/compost-piles/${pile1Id}/ingredients`, {
      data: {
        material: 'dried-leaves',
        amount: 3.0,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const pile = await resp.json();

    expect(pile.ingredients.length).toBe(1);
    expect(pile.ingredients[0].name).toBe('dried-leaves');
    expect(pile.ingredients[0].type).toBe('brown');
    expect(pile.ingredients[0].amount).toBe(3.0);
    expect(pile.ingredients[0].carbonNitrogenRatio).toBe(60);
    // Only brown material → C:N should be 60 (high carbon)
    expect(pile.carbonNitrogenRatio).toBe(60.0);
  });

  test('CP-05: Add green ingredient (grass-clippings), C:N ratio decreases', async () => {
    const resp = await ctx.post(`/api/compost-piles/${pile1Id}/ingredients`, {
      data: {
        material: 'grass-clippings',
        amount: 3.0,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const pile = await resp.json();

    expect(pile.ingredients.length).toBe(2);
    // Adding green material (C:N 20) should bring ratio down from 60
    expect(pile.carbonNitrogenRatio).toBeLessThan(60);
    expect(pile.carbonNitrogenRatio).toBeGreaterThan(20);
  });

  test('CP-06: Add more green (food-scraps), C:N moves toward ideal range', async () => {
    const resp = await ctx.post(`/api/compost-piles/${pile1Id}/ingredients`, {
      data: {
        material: 'food-scraps',
        amount: 3.0,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const pile = await resp.json();

    expect(pile.ingredients.length).toBe(3);
    // Adding another green material (C:N 15) should bring ratio down further
    // toward the ideal range (25-35)
    const ratio = pile.carbonNitrogenRatio;
    expect(ratio).toBeLessThan(60); // Well below pure brown
    expect(ratio).toBeGreaterThan(15); // Above pure green
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Status Lifecycle & Delete
  // ════════════════════════════════════════════════════════════════════

  test('CP-07: Status lifecycle (building → cooking → curing → ready)', async () => {
    // pile2 starts as 'building'
    const getResp = await ctx.get(`/api/compost-piles/${pile2Id}`);
    const initial = await getResp.json();
    expect(initial.status).toBe('building');

    // cooking
    let resp = await ctx.put(`/api/compost-piles/${pile2Id}`, {
      data: { status: 'cooking' },
    });
    expect((await resp.json()).status).toBe('cooking');

    // curing
    resp = await ctx.put(`/api/compost-piles/${pile2Id}`, {
      data: { status: 'curing' },
    });
    expect((await resp.json()).status).toBe('curing');

    // ready
    resp = await ctx.put(`/api/compost-piles/${pile2Id}`, {
      data: { status: 'ready' },
    });
    expect((await resp.json()).status).toBe('ready');
  });

  test('CP-08: Delete pile via API, verify gone with ingredients', async () => {
    const resp = await ctx.delete(`/api/compost-piles/${pile1Id}`);
    expect(resp.status()).toBe(204);

    // Verify it's gone
    const allResp = await ctx.get('/api/compost-piles');
    const piles = await allResp.json();
    const found = piles.find((p: any) => p.id === pile1Id);
    expect(found).toBeUndefined();

    // pile2 should still exist
    const pile2 = piles.find((p: any) => p.id === pile2Id);
    expect(pile2).toBeTruthy();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: UI Verification
  // ════════════════════════════════════════════════════════════════════

  test('CP-09: Compost page shows pile card with C:N ratio', async ({ page }) => {
    // First create a fresh pile with ingredients for UI verification
    const createResp = await ctx.post('/api/compost-piles', {
      data: {
        name: `UI Pile ${RUN_ID}`,
        location: 'Garden Edge',
        size: { width: 3, length: 3, height: 3 },
      },
    });
    const uiPile = await createResp.json();

    // Add an ingredient so C:N changes from default
    await ctx.post(`/api/compost-piles/${uiPile.id}/ingredients`, {
      data: { material: 'straw', amount: 2.0 },
    });

    await setupCompost(page);

    // Pile card should be visible
    const pileCard = page.locator(`[data-testid="compost-pile-${uiPile.id}"]`);
    await expect(pileCard).toBeVisible();

    // Pile name should show
    await expect(pileCard.locator('h3')).toHaveText(`UI Pile ${RUN_ID}`);

    // C:N ratio should be visible (straw C:N = 80, so it should show high ratio)
    const cnRatio = page.locator(`[data-testid="pile-cn-ratio-${uiPile.id}"]`);
    await expect(cnRatio).toBeVisible();
    await expect(cnRatio).toContainText(':1');
  });

  test('CP-10: Status dropdown changes pile status', async ({ page }) => {
    await setupCompost(page);

    // Find pile2's status dropdown (it's 'ready' from CP-07)
    const statusSelect = page.locator(`[data-testid="pile-status-${pile2Id}"]`);
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('ready');

    // Change to 'building'
    await statusSelect.selectOption('building');
    await page.waitForTimeout(500);

    // Verify via API
    const resp = await ctx.get(`/api/compost-piles/${pile2Id}`);
    const pile = await resp.json();
    expect(pile.status).toBe('building');
  });

  test('CP-11: Add Compost Pile button toggles form', async ({ page }) => {
    await setupCompost(page);

    // Click Add Compost Pile button
    await page.locator('[data-testid="btn-add-pile"]').click();

    // Create Pile button should appear
    await expect(page.locator('[data-testid="btn-create-pile"]')).toBeVisible({ timeout: 5000 });

    // Pile Name input should be visible
    await expect(page.locator('input[placeholder*="Main Pile"]')).toBeVisible();

    // Location input should be visible
    await expect(page.locator('input[placeholder*="Back corner"]')).toBeVisible();

    // Click again to cancel
    await page.locator('[data-testid="btn-add-pile"]').click();
    await page.waitForTimeout(300);

    // Form should be hidden
    await expect(page.locator('[data-testid="btn-create-pile"]')).not.toBeVisible();
  });
});
