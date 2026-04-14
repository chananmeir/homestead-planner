import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, navigateToSubTab, TABS } from './helpers/navigation';
import { selectBedByName, createValidPNG, fillBedRegion, progressAndTransplant, findSeedStart } from './helpers/data-setup';
import { SHARED_USER, BACKEND_URL, RUN_ID } from './helpers/shared-user';

/**
 * 2025 Garden Season Simulation — Part 2: Spring (Steps 5-10)
 *
 *   Step 5  (Apr 1):  Direct sow spring crops, install beehive, export plan, first photo
 *   Step 6  (Apr 15): Transplant kale, hive inspection, turn compost, first eggs
 *   Step 7  (May 1):  Last frost — transplant tomatoes + peppers
 *   Step 8  (May 10): Harvest radishes, RELAY → bush beans
 *   Step 9  (May 15): Transplant basil/cucumber/squash, sow corn/beans/pole beans
 *   Step 10 (May 30): Harvest spinach, RELAY → beans #2
 */
test.describe.serial('2025 Season — Part 2: Spring', () => {
  let ctx: APIRequestContext;

  // We need to discover bed IDs and plan ID from the setup phase
  let bedIds: Record<string, number> = {};
  let planId: number;
  let chickenId: number;
  let compostPileId: number;

  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    await registerViaAPI(ctx, SHARED_USER.username, SHARED_USER.email, SHARED_USER.password);
    await loginViaAPI(ctx, SHARED_USER.username, SHARED_USER.password);

    // Discover resources created in Part 1
    const bedsResp = await ctx.get('/api/garden-beds');
    const beds = await bedsResp.json();
    for (const bed of beds) {
      if (bed.name.includes(`SFG Bed ${RUN_ID}`)) bedIds.sfg = bed.id;
      if (bed.name.includes(`Row Bed ${RUN_ID}`)) bedIds.row = bed.id;
      if (bed.name.includes(`Intensive Bed ${RUN_ID}`)) bedIds.intensive = bed.id;
      if (bed.name.includes(`MIGardener Bed ${RUN_ID}`)) bedIds.migardener = bed.id;
      if (bed.name.includes(`Trellis Bed ${RUN_ID}`)) bedIds.trellis = bed.id;
    }

    const plansResp = await ctx.get('/api/garden-plans');
    const plans = await plansResp.json();
    const ourPlan = plans.find((p: any) => p.name?.includes(`2025 Season Plan ${RUN_ID}`));
    if (ourPlan) planId = ourPlan.id;

    const chickensResp = await ctx.get('/api/chickens');
    const chickens = await chickensResp.json();
    const ourFlock = chickens.find((c: any) => c.name?.includes(`Flock ${RUN_ID}`));
    if (ourFlock) chickenId = ourFlock.id;

    const compostResp = await ctx.get('/api/compost-piles');
    const piles = await compostResp.json();
    const ourPile = piles.find((p: any) => p.name?.includes(`Spring Pile ${RUN_ID}`));
    if (ourPile) compostPileId = ourPile.id;
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 5: Apr 1 — Direct Sow, Beehive, Export, Photo
  // ════════════════════════════════════════════════════════════════════

  test('S5-01: Verify setup data exists from Part 1', async () => {
    expect(bedIds.sfg).toBeDefined();
    expect(bedIds.row).toBeDefined();
    expect(bedIds.intensive).toBeDefined();
    expect(bedIds.migardener).toBeDefined();
    expect(bedIds.trellis).toBeDefined();
    expect(planId).toBeDefined();
    // Chicken and compost are optional for spring tests to proceed
    if (!chickenId) {
      test.info().annotations.push({ type: 'note', description: 'Chicken not found — egg tests will skip' });
    }
    if (!compostPileId) {
      test.info().annotations.push({ type: 'note', description: 'Compost pile not found — compost tests will skip' });
    }
  });

  test('S5-02: Export garden plan to calendar', async () => {
    const resp = await ctx.post(`/api/garden-plans/${planId}/export-to-calendar`);
    // Accept 200 (success) or 409 (already exported — idempotent re-export)
    expect([200, 201, 409].includes(resp.status())).toBeTruthy();

    // Verify planting events exist (either just created or from prior export)
    const eventsResp = await ctx.get('/api/planting-events');
    const events = await eventsResp.json();
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('S5-03: Place spring crops in SFG Bed — fill all 32 squares', async () => {
    test.setTimeout(60000);
    // SFG Bed: 4 cols x 8 rows = 32 cells
    // Rows 0-1: Radish (8 cells)
    await fillBedRegion(ctx, bedIds.sfg, 'radish-1', 'Cherry Belle', '2025-04-01', 0, 0, 3, 1);
    // Rows 2-3: Lettuce (8 cells)
    await fillBedRegion(ctx, bedIds.sfg, 'lettuce-1', 'Butterhead', '2025-04-01', 0, 2, 3, 3);
    // Rows 4-5: Spinach (8 cells)
    await fillBedRegion(ctx, bedIds.sfg, 'spinach-1', 'Bloomsdale', '2025-04-01', 0, 4, 3, 5);
    // Rows 6-7: Carrots (8 cells)
    await fillBedRegion(ctx, bedIds.sfg, 'carrot-1', 'Nantes', '2025-04-01', 0, 6, 3, 7);
  });

  test('S5-04: Place spring crops in Row Bed — peas, onions fill rows', async () => {
    test.setTimeout(120000);
    // Row Bed: 8 cols x 24 rows = 192 cells
    // Rows 0-5: Peas (48 cells)
    await fillBedRegion(ctx, bedIds.row, 'pea-1', 'Sugar Snap', '2025-04-01', 0, 0, 7, 5);
    // Rows 6-11: Onions (48 cells, we want ~36 so fill rows 6-10 + half of 11)
    await fillBedRegion(ctx, bedIds.row, 'onion-1', 'Yellow Sweet', '2025-04-01', 0, 6, 7, 10);
  });

  test('S5-05: Place spring crops in Intensive Bed — beets fill half', async () => {
    test.setTimeout(120000);
    // Intensive Bed: 8 cols x 16 rows = 128 cells
    // Rows 0-7: Beets (64 cells — fill bottom half, top half reserved for kale+chard transplants)
    await fillBedRegion(ctx, bedIds.intensive, 'beet-1', 'Detroit Dark Red', '2025-04-01', 0, 0, 7, 7);
  });

  test('S5-06: Place spring crops in MIGardener Bed — broadcast lettuce + arugula', async () => {
    test.setTimeout(120000);
    // MIGardener Bed: 16 cols x 32 rows = 512 cells
    // Broadcast sowing — fill top half with lettuce, bottom half with arugula
    // Use every other cell to simulate broadcast density (not every cell)
    // Rows 0-15: Lettuce Mix (fill every other cell = ~128 plants)
    for (let row = 0; row < 16; row += 2) {
      await fillBedRegion(ctx, bedIds.migardener, 'lettuce-1', 'Mix', '2025-04-01', 0, row, 15, row);
    }
    // Rows 16-31: Arugula (fill every other cell = ~128 plants)
    for (let row = 16; row < 32; row += 2) {
      await fillBedRegion(ctx, bedIds.migardener, 'arugula-1', 'Standard', '2025-04-01', 0, row, 15, row);
    }
  });

  test('S5-07: Place spring lettuce in Trellis Bed ground — fill 4 rows', async () => {
    test.setTimeout(60000);
    // Trellis Bed: 4 cols x 8 rows = 32 cells
    // Rows 0-3: Spring lettuce (16 cells, ground level)
    await fillBedRegion(ctx, bedIds.trellis, 'lettuce-1', 'Romaine', '2025-04-01', 0, 0, 3, 3);
  });

  test('S5-08: Install beehive', async () => {
    const resp = await ctx.post('/api/beehives', {
      data: {
        name: `Main Hive ${RUN_ID}`,
        hiveType: 'langstroth',
        location: 'Orchard area',
        dateEstablished: '2025-04-01',
      },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S5-09: Upload first garden photo', async () => {
    const resp = await ctx.post('/api/photos', {
      multipart: {
        file: {
          name: 'spring_planting.png',
          mimeType: 'image/png',
          buffer: createValidPNG(),
        },
        caption: `Spring planting day - Apr 1, 2025 ${RUN_ID}`,
        category: 'garden',
      },
    });
    expect(resp.status()).toBe(201);
  });

  test('S5-10: UI — Garden Designer shows planted items in SFG Bed', async ({ page }) => {
    await page.goto('/');
    await login(page, SHARED_USER.username, SHARED_USER.password);
    await navigateTo(page, TABS.GARDEN_DESIGNER);

    await selectBedByName(page, `SFG Bed ${RUN_ID}`);

    // Bed should have planted items visible
    await page.waitForTimeout(2000);
    // Verify via API
    const resp = await ctx.get(`/api/garden-beds/${bedIds.sfg}`);
    const bed = await resp.json();
    expect(bed.plantedItems.length).toBeGreaterThanOrEqual(4);
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 6: Apr 15 — Transplant Kale, Hive Inspection, Compost, Eggs
  // ════════════════════════════════════════════════════════════════════

  test('S6-01a: Progress kale indoor start → transplant into Intensive Bed', async () => {
    const startId = await findSeedStart(ctx, 'kale-1', 'Lacinato');
    if (startId) {
      await progressAndTransplant(ctx, startId, bedIds.intensive, '2025-04-15', 0, 8);
    }
  });

  test('S6-01: Place kale transplants in Intensive Bed — fill rows 8-11', async () => {
    test.setTimeout(60000);
    await fillBedRegion(ctx, bedIds.intensive, 'kale-1', 'Lacinato', '2025-04-15', 0, 8, 7, 11);
  });

  test('S6-02: Place chard in Intensive Bed — fill rows 12-15', async () => {
    test.setTimeout(60000);
    await fillBedRegion(ctx, bedIds.intensive, 'chard-1', 'Rainbow', '2025-04-15', 0, 12, 7, 15);
  });

  test('S6-03: First hive inspection', async () => {
    const hivesResp = await ctx.get('/api/beehives');
    const hives = await hivesResp.json();
    const ourHive = hives.find((h: any) => h.name?.includes(RUN_ID));

    if (ourHive) {
      const resp = await ctx.post('/api/hive-inspections', {
        data: {
          beehiveId: ourHive.id,
          date: '2025-04-15',
          queenSeen: true,
          broodPattern: 'good',
          temperament: 'calm',
          notes: 'Colony building up nicely after winter',
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S6-04: Turn compost', async () => {
    const resp = await ctx.put(`/api/compost-piles/${compostPileId}`, {
      data: { lastTurned: true },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S6-05: Log first egg production (weekly since March)', async () => {
    // Log 4 weeks of eggs (March 1 through March 29)
    for (let week = 0; week < 4; week++) {
      const day = 1 + week * 7;
      const dateStr = `2025-03-${day.toString().padStart(2, '0')}`;
      const resp = await ctx.post('/api/egg-production', {
        data: {
          chickenId,
          eggsCollected: 28 + Math.floor(Math.random() * 7), // 4-5 eggs/day x 7 days
          date: dateStr,
          notes: `Week ${week + 1} production`,
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 7: May 1 — Last Frost, Transplant Tomatoes + Peppers
  // ════════════════════════════════════════════════════════════════════

  test('S7-00: Progress tomato + pepper indoor starts → transplant', async () => {
    const tomatoStart = await findSeedStart(ctx, 'tomato-1', 'Brandywine');
    if (tomatoStart) {
      await progressAndTransplant(ctx, tomatoStart, bedIds.sfg, '2025-05-01', 0, 0);
    }
    const pepperStart = await findSeedStart(ctx, 'pepper-1', 'Bell');
    if (pepperStart) {
      await progressAndTransplant(ctx, pepperStart, bedIds.sfg, '2025-05-01', 0, 1);
    }
  });

  test('S7-01: Place tomato transplants in SFG Bed (4 plants, 1 per square)', async () => {
    for (const pos of [{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}]) {
      const resp = await ctx.post('/api/planted-items', {
        data: { plantId: 'tomato-1', variety: 'Brandywine',
          gardenBedId: bedIds.sfg, plantedDate: '2025-05-01', quantity: 1,
          position: pos },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S7-02: Place pepper transplants in SFG Bed (4 plants, 1 per square)', async () => {
    for (const pos of [{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:3,y:1}]) {
      const resp = await ctx.post('/api/planted-items', {
        data: { plantId: 'pepper-1', variety: 'Bell',
          gardenBedId: bedIds.sfg, plantedDate: '2025-05-01', quantity: 1,
          position: pos },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 8: May 10 — Harvest Radishes, RELAY → Bush Beans
  // ════════════════════════════════════════════════════════════════════

  test('S8-01: Harvest radishes (25 days after planting)', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: {
        plantId: 'radish-1',
        variety: 'Cherry Belle',
        quantity: 3,
        unit: 'lbs',
        quality: 'excellent',
        harvestDate: '2025-05-10',
        gardenBedId: bedIds.sfg,
        notes: 'First harvest of the season! 25 days from seed.',
      },
    });
    expect(resp.status()).toBe(201);
  });

  test('S8-02: RELAY — Plant bush beans in radish squares (rows 0-1)', async () => {
    // Radishes were in rows 0-1. Now beans fill those same 8 cells.
    await fillBedRegion(ctx, bedIds.sfg, 'bean-1', 'Provider', '2025-05-10', 0, 0, 3, 1);
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 9: May 15 — Transplant warm season crops
  // ════════════════════════════════════════════════════════════════════

  test('S9-00: Progress basil, cucumber, squash indoor starts → transplant', async () => {
    const basilStart = await findSeedStart(ctx, 'basil-1', 'Genovese');
    if (basilStart) {
      await progressAndTransplant(ctx, basilStart, bedIds.sfg, '2025-05-15', 0, 4);
    }
    const cucumberStart = await findSeedStart(ctx, 'cucumber-1', 'Marketmore');
    if (cucumberStart) {
      await progressAndTransplant(ctx, cucumberStart, bedIds.trellis, '2025-05-15', 0, 4);
    }
    const squashStart = await findSeedStart(ctx, 'squash-1', 'Butternut');
    if (squashStart) {
      await progressAndTransplant(ctx, squashStart, bedIds.trellis, '2025-05-15', 2, 4);
    }
  });

  test('S9-01: Place basil transplants in SFG Bed (rows 4-5)', async () => {
    await fillBedRegion(ctx, bedIds.sfg, 'basil-1', 'Genovese', '2025-05-15', 0, 4, 3, 5);
  });

  test('S9-02: Direct sow beans + corn in Row Bed — fill remaining rows', async () => {
    test.setTimeout(120000);
    // Rows 11-17: Green beans (56 cells)
    await fillBedRegion(ctx, bedIds.row, 'bean-1', 'Blue Lake', '2025-05-15', 0, 11, 7, 17);
    // Rows 18-23: Corn (48 cells)
    await fillBedRegion(ctx, bedIds.row, 'corn-1', 'Golden Bantam', '2025-05-15', 0, 18, 7, 23);
  });

  test('S9-03: Place cucumbers + pole beans on trellis rows', async () => {
    // Trellis Bed rows 4-5: Cucumbers (8 cells)
    await fillBedRegion(ctx, bedIds.trellis, 'cucumber-1', 'Marketmore', '2025-05-15', 0, 4, 3, 5);
    // Rows 6-7: Pole beans (8 cells)
    await fillBedRegion(ctx, bedIds.trellis, 'pole-beans-1', 'Kentucky Wonder', '2025-05-15', 0, 6, 3, 7);
  });

  test('S9-04: Place squash in Trellis Bed ground (rows 4-5 overlap ok)', async () => {
    // Squash in 2 cells alongside cucumbers
    for (const pos of [{x:2,y:4},{x:3,y:4}]) {
      await ctx.post('/api/planted-items', {
        data: { plantId: 'squash-1', variety: 'Butternut',
          gardenBedId: bedIds.trellis, plantedDate: '2025-05-15', quantity: 1,
          position: pos },
      });
    }
  });

  test('S9-05: Place cilantro in MIGardener Bed', async () => {
    test.setTimeout(60000);
    // Cilantro in middle rows (every other row for broadcast effect)
    for (let row = 1; row < 16; row += 2) {
      await fillBedRegion(ctx, bedIds.migardener, 'cilantro-1', 'Standard', '2025-04-15', 0, row, 15, row);
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 10: May 30 — Harvest Spinach, RELAY → Beans #2
  // ════════════════════════════════════════════════════════════════════

  test('S10-01: Harvest spinach', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: {
        plantId: 'spinach-1',
        variety: 'Bloomsdale',
        quantity: 2,
        unit: 'lbs',
        quality: 'excellent',
        harvestDate: '2025-05-30',
        gardenBedId: bedIds.sfg,
        notes: 'Great spring spinach crop. Bolting starting in warm weather.',
      },
    });
    expect(resp.status()).toBe(201);
  });

  test('S10-02: RELAY — Plant beans #2 in spinach squares (rows 4-5)', async () => {
    await fillBedRegion(ctx, bedIds.sfg, 'bean-1', 'Provider #2', '2025-05-30', 0, 4, 3, 5);
  });

  test('S10-03: Log more egg production (April-May)', async () => {
    for (const dateStr of ['2025-04-07', '2025-04-14', '2025-04-21', '2025-04-28', '2025-05-05', '2025-05-12', '2025-05-19', '2025-05-26']) {
      const resp = await ctx.post('/api/egg-production', {
        data: {
          chickenId,
          eggsCollected: 30 + Math.floor(Math.random() * 5),
          date: dateStr,
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S10-04: Verify all beds have planted items (no empty beds)', async () => {
    for (const [name, id] of Object.entries(bedIds)) {
      const resp = await ctx.get(`/api/garden-beds/${id}`);
      expect(resp.ok()).toBeTruthy();
      const bed = await resp.json();
      expect(bed.plantedItems.length).toBeGreaterThan(0);
    }
  });

  test('S10-05: UI — Harvest tracker shows records', async ({ page }) => {
    await page.goto('/');
    await login(page, SHARED_USER.username, SHARED_USER.password);
    await navigateTo(page, TABS.HARVESTS);

    await page.waitForLoadState('networkidle');
    // Verify harvest page loads and has content
    await expect(page.locator('text=Harvest').first()).toBeVisible({ timeout: 10000 });

    // Verify harvests exist via API
    const resp = await ctx.get('/api/harvests');
    const harvests = await resp.json();
    expect(harvests.length).toBeGreaterThanOrEqual(2); // radish + spinach
  });

  test('S10-06: Garden snapshot at May 30 shows all active plants', async () => {
    const resp = await ctx.get('/api/garden-planner/garden-snapshot?date=2025-05-30');
    expect(resp.ok()).toBeTruthy();
    const snapshot = await resp.json();

    expect(snapshot.summary.totalPlants).toBeGreaterThan(0);
    expect(snapshot.summary.bedsWithPlants).toBeGreaterThanOrEqual(5);
  });
});
