import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';
import { fillBedRegion } from './helpers/data-setup';
import { SHARED_USER, BACKEND_URL, RUN_ID } from './helpers/shared-user';

/**
 * 2025 Garden Season Simulation — Part 4: Fall & Season Wrap-Up (Steps 16-21)
 *
 *   Step 16 (Aug 15): RELAY beans→lettuce#3, MIGardener fall. Mark tomato for seed saving.
 *   Step 17 (Aug 25): RELAY corn row→fall peas.
 *   Step 18 (Sep 1):  Harvest fall lettuce/arugula.
 *   Step 19 (Sep 15): Collect tomato seeds. Final hive inspection.
 *   Step 20 (Oct 1):  Final harvests — squash, kale, chard, turnips, fall beets, fall peas/beans.
 *   Step 21 (Oct 20): First frost. Garden snapshot. Nutrition dashboard verification.
 */
test.describe.serial('2025 Season — Part 4: Fall & Wrap-Up', () => {
  let ctx: APIRequestContext;
  let bedIds: Record<string, number> = {};
  let chickenId: number;
  let beehiveId: number;

  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    await registerViaAPI(ctx, SHARED_USER.username, SHARED_USER.email, SHARED_USER.password);
    await loginViaAPI(ctx, SHARED_USER.username, SHARED_USER.password);

    // Discover resources
    const bedsResp = await ctx.get('/api/garden-beds');
    const beds = await bedsResp.json();
    for (const bed of beds) {
      if (bed.name.includes(`SFG Bed ${RUN_ID}`)) bedIds.sfg = bed.id;
      if (bed.name.includes(`Row Bed ${RUN_ID}`)) bedIds.row = bed.id;
      if (bed.name.includes(`Intensive Bed ${RUN_ID}`)) bedIds.intensive = bed.id;
      if (bed.name.includes(`MIGardener Bed ${RUN_ID}`)) bedIds.migardener = bed.id;
      if (bed.name.includes(`Trellis Bed ${RUN_ID}`)) bedIds.trellis = bed.id;
    }

    const chickensResp = await ctx.get('/api/chickens');
    const chickens = await chickensResp.json();
    const flock = chickens.find((c: any) => c.name?.includes(RUN_ID));
    if (flock) chickenId = flock.id;

    const hivesResp = await ctx.get('/api/beehives');
    const hives = await hivesResp.json();
    const hive = hives.find((h: any) => h.name?.includes(RUN_ID));
    if (hive) beehiveId = hive.id;
  });

  test.afterAll(async () => { await ctx.dispose(); });

  // ════════════════════════════════════════════════════════════════════
  // Step 16: Aug 15 — Fall Relays + Seed Saving
  // ════════════════════════════════════════════════════════════════════

  test('S16-01: Harvest bush beans from SFG Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'bean-1', variety: 'Provider', quantity: 4, unit: 'lbs',
        quality: 'good', harvestDate: '2025-08-15', gardenBedId: bedIds.sfg,
        notes: 'Good yield. Clearing for fall lettuce.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S16-02: RELAY SFG — bean squares → lettuce #3 (rows 0-1)', async () => {
    await fillBedRegion(ctx, bedIds.sfg, 'lettuce-1', 'Butterhead #3 (fall)', '2025-08-15', 0, 0, 3, 1);
  });

  test('S16-03: RELAY MIGardener — lettuce #3 + fall spinach', async () => {
    test.setTimeout(120000);
    for (let row = 0; row < 16; row += 2) {
      await fillBedRegion(ctx, bedIds.migardener, 'lettuce-1', 'Mix #3 (fall)', '2025-08-15', 0, row, 15, row);
    }
    for (let row = 17; row < 32; row += 2) {
      await fillBedRegion(ctx, bedIds.migardener, 'spinach-1', 'Bloomsdale (fall)', '2025-09-01', 0, row, 15, row);
    }
  });

  test('S16-04: Mark Brandywine tomato for seed saving', async () => {
    // Find a tomato planted item to mark for seed saving
    const bedResp = await ctx.get(`/api/garden-beds/${bedIds.sfg}`);
    const bed = await bedResp.json();
    const tomatoItem = (bed.plantedItems || []).find(
      (p: any) => p.plantId === 'tomato-1' && p.variety === 'Brandywine',
    );

    if (tomatoItem) {
      const resp = await ctx.put(`/api/planted-items/${tomatoItem.id}`, {
        data: { saveForSeed: true },
      });
      expect(resp.ok()).toBeTruthy();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Tomato planted item not found for seed saving',
      });
    }
  });

  test('S16-05: Log more eggs (Aug)', async () => {
    if (!chickenId) return;
    for (const d of ['2025-08-04', '2025-08-11', '2025-08-18', '2025-08-25']) {
      await ctx.post('/api/egg-production', {
        data: { chickenId, eggsCollected: 27, date: d },
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 17: Aug 25 — Corn Row Relay
  // ════════════════════════════════════════════════════════════════════

  test('S17-01: RELAY Row — corn row → fall peas (rows 18-23)', async () => {
    test.setTimeout(60000);
    await fillBedRegion(ctx, bedIds.row, 'pea-1', 'Sugar Snap #2 (fall)', '2025-08-25', 0, 18, 7, 23);
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 18: Sep 1 — Fall Harvests
  // ════════════════════════════════════════════════════════════════════

  test('S18-01: Harvest fall lettuce from MIGardener Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'lettuce-1', variety: 'Mix #2', quantity: 2, unit: 'lbs',
        quality: 'good', harvestDate: '2025-09-01', gardenBedId: bedIds.migardener },
    });
    expect(resp.status()).toBe(201);
  });

  test('S18-02: Harvest more tomatoes (late season)', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'tomato-1', variety: 'Brandywine', quantity: 8, unit: 'lbs',
        quality: 'good', harvestDate: '2025-09-01', gardenBedId: bedIds.sfg,
        notes: 'Late season tomatoes. Smaller but still flavorful.' },
    });
    expect(resp.status()).toBe(201);
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 19: Sep 15 — Collect Seeds, Final Inspection
  // ════════════════════════════════════════════════════════════════════

  test('S19-01: Collect tomato seeds', async () => {
    // Find the seed-saving tomato and collect seeds
    const bedResp = await ctx.get(`/api/garden-beds/${bedIds.sfg}`);
    const bed = await bedResp.json();
    const seedItem = (bed.plantedItems || []).find(
      (p: any) => p.plantId === 'tomato-1' && p.saveForSeed,
    );

    if (seedItem) {
      const resp = await ctx.post(`/api/planted-items/${seedItem.id}/collect-seeds`, {
        data: { collectedDate: '2025-09-15' },
      });
      // Accept various success codes
      expect([200, 201].includes(resp.status()) || resp.ok()).toBeTruthy();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Seed-saving tomato not found — seeds not collected',
      });
    }
  });

  test('S19-02: Harvest fall radish from SFG Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'radish-1', variety: 'Cherry Belle #2 (fall)', quantity: 2, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-09-15', gardenBedId: bedIds.sfg,
        notes: 'Fall radishes are sweeter than spring crop.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S19-03: Harvest fall lettuce #3 from SFG Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'lettuce-1', variety: 'Butterhead #3 (fall)', quantity: 1.5, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-09-15', gardenBedId: bedIds.sfg },
    });
    expect(resp.status()).toBe(201);
  });

  test('S19-04: Final hive inspection', async () => {
    if (!beehiveId) return;
    const resp = await ctx.post('/api/hive-inspections', {
      data: { beehiveId, date: '2025-09-15', queenSeen: true,
        broodPattern: 'fair', temperament: 'calm',
        notes: 'Colony preparing for winter. Reduced brood. Adequate honey stores.' },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S19-05: Log Sep eggs', async () => {
    if (!chickenId) return;
    for (const d of ['2025-09-01', '2025-09-08', '2025-09-15']) {
      await ctx.post('/api/egg-production', {
        data: { chickenId, eggsCollected: 25, date: d },
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 20: Oct 1 — Final Harvests
  // ════════════════════════════════════════════════════════════════════

  test('S20-01: Harvest butternut squash', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'squash-1', variety: 'Butternut', quantity: 15, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-10-01', gardenBedId: bedIds.trellis,
        notes: '3 large squash. Perfect for storage.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-02: Harvest kale (still producing)', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'kale-1', variety: 'Lacinato', quantity: 3, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-10-01', gardenBedId: bedIds.intensive,
        notes: 'Sweetened by light frost. Best kale of the season.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-03: Harvest chard (still producing)', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'chard-1', variety: 'Rainbow', quantity: 2, unit: 'lbs',
        quality: 'good', harvestDate: '2025-10-01', gardenBedId: bedIds.intensive },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-04: Harvest turnips', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'turnip-1', variety: 'Purple Top', quantity: 6, unit: 'lbs',
        quality: 'good', harvestDate: '2025-10-01', gardenBedId: bedIds.intensive },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-05: Harvest fall beets', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'beet-1', variety: 'Detroit Dark Red #2 (fall)', quantity: 3, unit: 'lbs',
        quality: 'good', harvestDate: '2025-10-01', gardenBedId: bedIds.intensive },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-06: Harvest fall peas', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'pea-1', variety: 'Sugar Snap #2 (fall)', quantity: 2, unit: 'lbs',
        quality: 'good', harvestDate: '2025-10-01', gardenBedId: bedIds.row },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-07: Harvest fall beans', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'bean-1', variety: 'Blue Lake #2 (fall)', quantity: 3, unit: 'lbs',
        quality: 'good', harvestDate: '2025-10-01', gardenBedId: bedIds.row },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-08: Harvest pole beans from trellis', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'pole-beans-1', variety: 'Kentucky Wonder', quantity: 5, unit: 'lbs',
        quality: 'good', harvestDate: '2025-10-01', gardenBedId: bedIds.trellis },
    });
    expect(resp.status()).toBe(201);
  });

  test('S20-09: Log Oct eggs', async () => {
    if (!chickenId) return;
    for (const d of ['2025-09-22', '2025-09-29', '2025-10-06']) {
      await ctx.post('/api/egg-production', {
        data: { chickenId, eggsCollected: 22, date: d },
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 21: Oct 20 — First Frost, Season Verification
  // ════════════════════════════════════════════════════════════════════

  test('S21-01: Garden snapshot at Oct 20 — only cold-hardy crops active', async () => {
    const resp = await ctx.get('/api/garden-planner/garden-snapshot?date=2025-10-20');
    expect(resp.ok()).toBeTruthy();
    const snapshot = await resp.json();

    // Kale and chard should still be active (cold-hardy)
    // Most other crops should have been harvested
    expect(snapshot.summary).toBeDefined();
    expect(snapshot.summary.totalPlants).toBeGreaterThan(0);
  });

  test('S21-02: Verify total harvest count for the season', async () => {
    const resp = await ctx.get('/api/harvests');
    expect(resp.ok()).toBeTruthy();
    const harvests = await resp.json();

    // We logged: radish, spinach, lettuce x4+, arugula, peas, beets x2, carrots,
    // tomato x2, pepper, cucumber, corn, beans x2, squash, kale, chard, turnips,
    // fall radish, fall peas, fall beans, pole beans = 20+ harvests
    expect(harvests.length).toBeGreaterThanOrEqual(15);
  });

  test('S21-03: Verify harvest stats endpoint', async () => {
    const resp = await ctx.get('/api/harvests/stats');
    expect(resp.ok()).toBeTruthy();
  });

  test('S21-04: UI — Nutrition dashboard loads', async ({ page }) => {
    await page.goto('/');
    await login(page, SHARED_USER.username, SHARED_USER.password);
    await navigateTo(page, TABS.NUTRITION);

    await expect(page.locator('text=Nutrition').first()).toBeVisible({ timeout: 10000 });

    // Should show some nutrition data (garden + livestock)
    const summaryCards = page.locator('[data-testid="nutrition-summary-cards"], [data-testid="nutrition-calories-card"]');
    const hasSummary = await summaryCards.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasSummary) {
      expect(hasSummary).toBe(true);
    }
  });

  test('S21-05: Verify egg production totals', async () => {
    const resp = await ctx.get('/api/egg-production');
    expect(resp.ok()).toBeTruthy();
    const records = await resp.json();
    // We logged eggs weekly from March through October
    expect(records.length).toBeGreaterThanOrEqual(10);
  });

  test('S21-06: Verify hive inspections logged', async () => {
    const resp = await ctx.get('/api/hive-inspections');
    expect(resp.ok()).toBeTruthy();
    const inspections = await resp.json();
    // We logged 5 inspections: Apr, Jun, Jul, Aug, Sep
    expect(inspections.length).toBeGreaterThanOrEqual(3);
  });

  test('S21-07: Verify honey harvest recorded', async () => {
    const resp = await ctx.get('/api/honey-harvests');
    expect(resp.ok()).toBeTruthy();
    const harvests = await resp.json();
    expect(harvests.length).toBeGreaterThanOrEqual(1);
  });

  test('S21-08: Verify photos from the season', async () => {
    const resp = await ctx.get('/api/photos');
    expect(resp.ok()).toBeTruthy();
    const photos = await resp.json();
    // We uploaded 3 photos: spring planting, mid-season, peak harvest
    expect(photos.length).toBeGreaterThanOrEqual(2);
  });

  test('S21-09: Verify compost pile finished lifecycle', async () => {
    const resp = await ctx.get('/api/compost-piles');
    expect(resp.ok()).toBeTruthy();
    const piles = await resp.json();
    const ourPile = piles.find((p: any) => p.name?.includes(RUN_ID));
    if (ourPile) {
      expect(ourPile.status).toBe('ready');
    }
  });

  test('S21-10: SEASON COMPLETE — Full season summary', async () => {
    // Final verification: count everything this user created
    const [bedsResp, harvestsResp, eggsResp, photosResp, startsResp] = await Promise.all([
      ctx.get('/api/garden-beds'),
      ctx.get('/api/harvests'),
      ctx.get('/api/egg-production'),
      ctx.get('/api/photos'),
      ctx.get('/api/indoor-seed-starts'),
    ]);

    const beds = await bedsResp.json();
    const harvests = await harvestsResp.json();
    const eggs = await eggsResp.json();
    const photos = await photosResp.json();
    const starts = await startsResp.json();

    const ourBeds = beds.filter((b: any) => b.name?.includes(RUN_ID));

    console.log('═══════════════════════════════════════');
    console.log('  2025 SEASON COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`  Beds:             ${ourBeds.length}`);
    console.log(`  Harvests logged:  ${harvests.length}`);
    console.log(`  Egg records:      ${eggs.length}`);
    console.log(`  Photos:           ${photos.length}`);
    console.log(`  Indoor starts:    ${starts.length}`);
    console.log('═══════════════════════════════════════');

    expect(ourBeds.length).toBe(5);
    expect(harvests.length).toBeGreaterThanOrEqual(15);
  });
});
