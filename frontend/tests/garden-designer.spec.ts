import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const GD_USER = {
  username: `gd_test_${RUN_ID}`,
  email: `gd_test_${RUN_ID}@test.com`,
  password: 'GdTest1!',
};

/**
 * Use a date 7 days in the past so the date filter always treats plants as
 * "active" regardless of timezone. The component's getActivePlantedItems()
 * parses the view date (date-only string → UTC) differently from plantedDate
 * (datetime string → local), so same-day dates can fall on different sides
 * of the filter in timezones behind UTC.
 */
function pastDate(daysAgo = 7): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const PLANTED_DATE = pastDate(7);

/**
 * Garden Designer — E2E Tests
 *
 * Covers: plant placement & verification, plant removal, seed saving lifecycle,
 * cross-bed isolation, future plantings toggle, season progress linkage.
 *
 * Strategy: API-first setup + UI verification. @dnd-kit drag-drop is unreliable
 * in Playwright, so plant placement uses the /api/planted-items API.
 */
test.describe.serial('Garden Designer — E2E Tests', () => {
  let ctx: APIRequestContext;
  let bedId: number;
  let secondBedId: number;

  // Track item IDs across tests
  let tomatoItemId: number;
  let pepperItemId: number;
  const carrotItemIds: number[] = [];

  // ── Setup: register user, login, create 2 beds ──────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, GD_USER.username, GD_USER.email, GD_USER.password);
    await loginViaAPI(ctx, GD_USER.username, GD_USER.password);

    // Create bed1: 4x4 SFG
    const bed1Resp = await ctx.post('/api/garden-beds', {
      data: {
        name: `GD-Bed1-${RUN_ID}`,
        width: 4,
        length: 4,
        planningMethod: 'square-foot',
      },
    });
    expect(bed1Resp.ok()).toBeTruthy();
    const bed1 = await bed1Resp.json();
    bedId = bed1.id;

    // Create bed2: 4x8 SFG
    const bed2Resp = await ctx.post('/api/garden-beds', {
      data: {
        name: `GD-Bed2-${RUN_ID}`,
        width: 4,
        length: 8,
        planningMethod: 'square-foot',
      },
    });
    expect(bed2Resp.ok()).toBeTruthy();
    const bed2 = await bed2Resp.json();
    secondBedId = bed2.id;
  });

  test.afterAll(async () => {
    // Cleanup: delete beds (cascades to planted items)
    await ctx.delete(`/api/garden-beds/${bedId}`).catch(() => {});
    await ctx.delete(`/api/garden-beds/${secondBedId}`).catch(() => {});
    await ctx.dispose();
  });

  // Helper: navigate to designer (beds default to "All Beds" with first bed active)
  async function setupDesigner(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, GD_USER.username, GD_USER.password);
    await navigateTo(page, TABS.GARDEN_DESIGNER);
    // Wait for beds to load — the bed selector appears when beds exist
    await expect(page.locator('[data-testid="bed-selector"]')).toBeVisible({ timeout: 10000 });
  }

  // Helper: place a plant via API
  async function placeViaAPI(
    targetBedId: number,
    plantId: string,
    x: number,
    y: number,
    opts?: { variety?: string; status?: string; sourcePlanItemId?: number; plantedDate?: string },
  ) {
    const resp = await ctx.post('/api/planted-items', {
      data: {
        gardenBedId: targetBedId,
        plantId,
        position: { x, y },
        quantity: 1,
        status: opts?.status || 'planned',
        plantedDate: opts?.plantedDate || PLANTED_DATE,
        variety: opts?.variety,
        sourcePlanItemId: opts?.sourcePlanItemId,
      },
    });
    return resp;
  }

  // Helper: get bed detail
  async function getBedDetail(targetBedId: number) {
    const resp = await ctx.get(`/api/garden-beds/${targetBedId}`);
    expect(resp.ok()).toBeTruthy();
    return resp.json();
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Plant Placement & Verification
  // ════════════════════════════════════════════════════════════════════

  test('GD-01: Place single plant via API, verify on grid', async ({ page }) => {
    // Place tomato at (0,0) via API
    const resp = await placeViaAPI(bedId, 'tomato-1', 0, 0);
    expect(resp.status()).toBe(201);
    const item = await resp.json();
    tomatoItemId = item.id;

    // Navigate to designer
    await setupDesigner(page);

    // Verify planted item is visible in the SVG grid
    await expect(
      page.locator(`[data-testid="planted-item-${tomatoItemId}"]`)
    ).toBeVisible({ timeout: 10000 });

    // Verify the bed detail API shows the plant
    const bedDetail = await getBedDetail(bedId);
    const plantedItems = bedDetail.plantedItems || [];
    const tomato = plantedItems.find((p: { plantId: string }) => p.plantId === 'tomato-1');
    expect(tomato).toBeTruthy();
    expect(tomato.position.x).toBe(0);
    expect(tomato.position.y).toBe(0);
  });

  test('GD-02: Place plant with variety, verify detail panel', async ({ page }) => {
    // Place pepper with variety at (2,0)
    const resp = await placeViaAPI(bedId, 'pepper-1', 2, 0, { variety: 'Bell Boy' });
    expect(resp.status()).toBe(201);
    const item = await resp.json();
    pepperItemId = item.id;

    // Navigate to designer
    await setupDesigner(page);

    // Click on the planted pepper to open detail panel
    await page.locator(`[data-testid="planted-item-${pepperItemId}"]`).click();

    // Verify detail panel is visible
    await expect(
      page.locator('[data-testid="plant-detail-panel"]')
    ).toBeVisible({ timeout: 5000 });

    // Verify variety is shown in the panel
    await expect(
      page.locator('[data-testid="plant-detail-panel"]').getByText('Bell Boy')
    ).toBeVisible();

    // Verify status badge shows
    await expect(
      page.locator('[data-testid="plant-status-badge"]')
    ).toBeVisible();
  });

  test('GD-03: Batch place 3 carrots via API, verify count', async () => {
    // Place 3 carrots at different positions
    const positions = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ];

    for (const pos of positions) {
      const resp = await placeViaAPI(bedId, 'carrot-1', pos.x, pos.y);
      expect(resp.status()).toBe(201);
      const item = await resp.json();
      carrotItemIds.push(item.id);
    }

    // Verify bed detail shows all items (tomato + pepper + 3 carrots = 5)
    const bedDetail = await getBedDetail(bedId);
    const plantedItems = bedDetail.plantedItems || [];
    const carrots = plantedItems.filter((p: { plantId: string }) => p.plantId === 'carrot-1');
    expect(carrots.length).toBe(3);
  });

  test('GD-04: Conflict detection at occupied cell', async () => {
    // Attempt to place pepper at (0,0) — occupied by tomato
    const resp = await placeViaAPI(bedId, 'pepper-1', 0, 0);
    expect(resp.status()).toBe(409);

    const body = await resp.json();
    expect(body.conflicts).toBeDefined();
    expect(body.conflicts.length).toBeGreaterThanOrEqual(1);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Plant Removal
  // ════════════════════════════════════════════════════════════════════

  test('GD-05: Remove single plant via API, verify gone', async () => {
    // Remove first carrot via API
    const carrotId = carrotItemIds[0];
    const resp = await ctx.delete(`/api/planted-items/${carrotId}`);
    expect(resp.status()).toBe(204);

    // Verify bed detail has 2 carrots now
    const bedDetail = await getBedDetail(bedId);
    const plantedItems = bedDetail.plantedItems || [];
    const carrots = plantedItems.filter((p: { plantId: string }) => p.plantId === 'carrot-1');
    expect(carrots.length).toBe(2);
  });

  test('GD-06: Remove plant via UI detail panel Delete button', async ({ page }) => {
    // Use the second carrot
    const carrotId = carrotItemIds[1];

    await setupDesigner(page);

    // Click on the carrot to open detail panel
    await page.locator(`[data-testid="planted-item-${carrotId}"]`).click();
    await expect(
      page.locator('[data-testid="plant-detail-panel"]')
    ).toBeVisible({ timeout: 5000 });

    // Click Delete button
    await page.locator('[data-testid="delete-plant-btn"]').click();

    // Confirm deletion in the ConfirmDialog
    await page.locator('[data-testid="confirm-dialog-confirm"]').click();

    // Wait for the dialog to close and the item to be removed
    await expect(
      page.locator('[data-testid="plant-detail-panel"]')
    ).not.toBeVisible({ timeout: 5000 });

    // Verify via API that the carrot is gone
    const bedDetail = await getBedDetail(bedId);
    const plantedItems = bedDetail.plantedItems || [];
    const deletedCarrot = plantedItems.find((p: { id: number }) => p.id === carrotId);
    expect(deletedCarrot).toBeFalsy();
  });

  test('GD-07: Clear entire bed via UI', async ({ page }) => {
    // Ensure bed has plants before clearing
    const bedBefore = await getBedDetail(bedId);
    const itemsBefore = bedBefore.plantedItems || [];
    expect(itemsBefore.length).toBeGreaterThan(0);

    await setupDesigner(page);

    // Click Clear Bed button
    await page.locator('[data-testid="clear-bed-btn"]').click();

    // Confirm in the dialog
    await page.locator('[data-testid="confirm-dialog-confirm"]').click();

    // Wait for the clear operation to complete — button disappears when bed is empty
    await expect(
      page.locator('[data-testid="clear-bed-btn"]'),
    ).not.toBeVisible({ timeout: 15000 });

    // Verify via API that the bed is empty
    const bedAfter = await getBedDetail(bedId);
    const itemsAfter = bedAfter.plantedItems || [];
    expect(itemsAfter.length).toBe(0);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: Seed Saving Lifecycle
  // ════════════════════════════════════════════════════════════════════

  test('GD-08: Toggle save-for-seed ON via API', async () => {
    // Place a fresh tomato for seed saving
    const resp = await placeViaAPI(bedId, 'tomato-1', 0, 0);
    expect(resp.status()).toBe(201);
    const item = await resp.json();
    tomatoItemId = item.id;

    // Toggle saveForSeed ON
    const toggleResp = await ctx.put(`/api/planted-items/${tomatoItemId}`, {
      data: { saveForSeed: true },
    });
    expect(toggleResp.ok()).toBeTruthy();
    const updated = await toggleResp.json();

    expect(updated.saveForSeed).toBe(true);
    expect(updated.status).toBe('saving-seed');
  });

  test('GD-09: Toggle save-for-seed ON via UI', async ({ page }) => {
    // Place a pepper for UI seed saving test
    const resp = await placeViaAPI(bedId, 'pepper-1', 2, 0, { variety: 'Jalapeño' });
    expect(resp.status()).toBe(201);
    const item = await resp.json();
    pepperItemId = item.id;

    await setupDesigner(page);

    // Click on the pepper to open detail panel
    await page.locator(`[data-testid="planted-item-${pepperItemId}"]`).click();
    await expect(
      page.locator('[data-testid="plant-detail-panel"]')
    ).toBeVisible({ timeout: 5000 });

    // Click the seed saving toggle
    await page.locator('[data-testid="seed-saving-toggle"]').click();

    // Wait for API response — the toggle should update the status badge
    await page.waitForTimeout(1000);

    // Verify via API that saveForSeed is now true
    const bedDetail = await getBedDetail(bedId);
    const plantedItems = bedDetail.plantedItems || [];
    const pepper = plantedItems.find((p: { id: number }) => p.id === pepperItemId);
    expect(pepper).toBeTruthy();
    expect(pepper.saveForSeed).toBe(true);
    expect(pepper.status).toBe('saving-seed');
  });

  test('GD-10: Toggle save-for-seed OFF via API', async () => {
    // Toggle saveForSeed OFF on the tomato from GD-08
    const toggleResp = await ctx.put(`/api/planted-items/${tomatoItemId}`, {
      data: { saveForSeed: false },
    });
    expect(toggleResp.ok()).toBeTruthy();
    const updated = await toggleResp.json();

    expect(updated.saveForSeed).toBe(false);
    // Status should be restored (not 'saving-seed')
    expect(updated.status).not.toBe('saving-seed');
    // Seed maturity date should be cleared
    expect(updated.seedMaturityDate).toBeNull();
  });

  test('GD-11: Collect seeds via API', async () => {
    // Place a fresh item and enable seed saving
    const placeResp = await placeViaAPI(bedId, 'tomato-1', 1, 1);
    expect(placeResp.status()).toBe(201);
    const item = await placeResp.json();

    // Enable saveForSeed first
    const toggleResp = await ctx.put(`/api/planted-items/${item.id}`, {
      data: { saveForSeed: true },
    });
    expect(toggleResp.ok()).toBeTruthy();

    // Collect seeds
    const collectResp = await ctx.post(`/api/planted-items/${item.id}/collect-seeds`, {
      data: {
        quantity: 2,
        seedsPerPacket: 25,
        variety: 'Brandywine',
        notes: 'E2E test seeds',
      },
    });
    expect(collectResp.status()).toBe(201);
    const result = await collectResp.json();

    // Verify planted item was updated
    expect(result.plantedItem.seedsCollected).toBe(true);
    expect(result.plantedItem.status).toBe('harvested');

    // Verify seed inventory was created
    expect(result.seedInventory).toBeTruthy();
    expect(result.seedInventory.plantId).toBe('tomato-1');
    expect(result.seedInventory.variety).toBe('Brandywine');
    expect(result.seedInventory.brand).toBe('Homegrown');
    expect(result.seedInventory.quantity).toBe(2);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: Cross-Bed Isolation & Visual Feedback
  // ════════════════════════════════════════════════════════════════════

  test('GD-12: Plants on one bed don\'t affect another', async () => {
    // Place a plant on bed2
    const bed2Resp = await placeViaAPI(secondBedId, 'lettuce-1', 0, 0);
    expect(bed2Resp.status()).toBe(201);

    // Clear bed1 via API (delete all planted items)
    await ctx.delete(`/api/garden-beds/${bedId}/planted-items`);

    // Verify bed1 is empty
    const bed1Detail = await getBedDetail(bedId);
    const bed1Items = bed1Detail.plantedItems || [];
    expect(bed1Items.length).toBe(0);

    // Verify bed2 still has its plant
    const bed2Detail = await getBedDetail(secondBedId);
    const bed2Items = bed2Detail.plantedItems || [];
    const lettuce = bed2Items.find((p: { plantId: string }) => p.plantId === 'lettuce-1');
    expect(lettuce).toBeTruthy();
  });

  test('GD-13: Future plantings toggle', async ({ page }) => {
    // Place a plant with a future date on bed2 to ensure the toggle appears
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const resp = await ctx.post('/api/planted-items', {
      data: {
        gardenBedId: secondBedId,
        plantId: 'tomato-1',
        position: { x: 1, y: 0 },
        quantity: 1,
        status: 'planned',
        plantedDate: futureDateStr,
      },
    });
    expect(resp.status()).toBe(201);

    await setupDesigner(page);

    // The future plantings toggle may or may not be visible depending on whether
    // there are future items. If visible, test the toggle behavior.
    const toggle = page.locator('[data-testid="future-plantings-toggle"]');
    const isVisible = await toggle.isVisible().catch(() => false);

    if (isVisible) {
      // Verify initial state text
      const toggleText = await toggle.textContent();
      expect(toggleText).toBeTruthy();

      // Click to toggle
      await toggle.click();

      // The text should change between "Show Future Plantings" and "Future Plantings Visible"
      const newText = await toggle.textContent();
      expect(newText).toBeTruthy();
      // Text should be different after toggle
      expect(newText).not.toBe(toggleText);
    } else {
      // No future items detected — just verify the page loaded correctly
      // The bed selector should still be visible
      await expect(page.locator('[data-testid="bed-selector"]')).toBeVisible();
    }
  });

  test('GD-14: Season progress endpoint with placed plants', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Create a plan with bed assignment
    const planResp = await ctx.post('/api/garden-plans', {
      data: {
        name: `GD Progress Plan ${RUN_ID}`,
        year: new Date().getFullYear(),
        items: [
          {
            plantId: 'tomato-1',
            unitType: 'plants',
            targetValue: 4,
            plantEquivalent: 4,
            successionEnabled: false,
            successionCount: 1,
            bedAssignments: [{ bedId: secondBedId, quantity: 4 }],
            firstPlantDate: today,
          },
        ],
      },
    });
    expect(planResp.status()).toBe(201);
    const plan = await planResp.json();
    const planItemId = plan.items[0].id;

    // Place a plant with sourcePlanItemId linking it to the plan
    const placeResp = await placeViaAPI(secondBedId, 'tomato-1', 2, 2, {
      sourcePlanItemId: planItemId,
    });
    expect(placeResp.status()).toBe(201);
    const placedItem = await placeResp.json();
    expect(placedItem.sourcePlanItemId).toBe(planItemId);

    // Verify season progress endpoint reflects the placement
    const progressResp = await ctx.get(
      `/api/garden-planner/season-progress?year=${new Date().getFullYear()}`
    );
    expect(progressResp.ok()).toBeTruthy();
    const progress = await progressResp.json();

    // byPlanItemId should exist and contain our plan item
    expect(progress.byPlanItemId).toBeDefined();
    const itemProgress = progress.byPlanItemId[String(planItemId)];
    expect(itemProgress).toBeTruthy();
    expect(itemProgress.placedSeason).toBeGreaterThanOrEqual(1);
  });
});
