import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';
import { createValidPNG, fillBedRegion } from './helpers/data-setup';
import { SHARED_USER, BACKEND_URL, RUN_ID } from './helpers/shared-user';

/**
 * 2025 Garden Season Simulation — Part 3: Summer (Steps 11-15)
 *
 *   Step 11 (Jun 1):  Harvest lettuce/peas/arugula, hive inspection, photo
 *   Step 12 (Jun 15): RELAY lettuce→lettuce#2, arugula→arugula#2, lettuce→beans. Turn compost.
 *   Step 13 (Jul 1):  Harvest beets/peas done. RELAY peas→fall beans, beets→turnips. Honey harvest.
 *   Step 14 (Jul 15): Compost ready. Harvest carrots. RELAY carrots→fall radish.
 *   Step 15 (Aug 1):  Major harvest. RELAY beet area→fall beets#2. Hive inspection.
 */
test.describe.serial('2025 Season — Part 3: Summer', () => {
  let ctx: APIRequestContext;
  let bedIds: Record<string, number> = {};
  let chickenId: number;
  let beehiveId: number;
  let compostPileId: number;

  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    await registerViaAPI(ctx, SHARED_USER.username, SHARED_USER.email, SHARED_USER.password);
    await loginViaAPI(ctx, SHARED_USER.username, SHARED_USER.password);

    // Discover resources from prior parts
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

    const pilesResp = await ctx.get('/api/compost-piles');
    const piles = await pilesResp.json();
    const pile = piles.find((p: any) => p.name?.includes(RUN_ID));
    if (pile) compostPileId = pile.id;
  });

  test.afterAll(async () => { await ctx.dispose(); });

  // ════════════════════════════════════════════════════════════════════
  // Step 11: Jun 1 — Harvests, Hive Inspection, Photo
  // ════════════════════════════════════════════════════════════════════

  test('S11-01: Harvest lettuce from SFG Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'lettuce-1', variety: 'Butterhead', quantity: 2, unit: 'lbs',
        quality: 'good', harvestDate: '2025-06-01', gardenBedId: bedIds.sfg,
        notes: 'Nice heads, some starting to bolt in heat.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S11-02: Harvest lettuce from MIGardener Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'lettuce-1', variety: 'Mix', quantity: 3, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-06-01', gardenBedId: bedIds.migardener },
    });
    expect(resp.status()).toBe(201);
  });

  test('S11-03: Harvest arugula from MIGardener Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'arugula-1', variety: 'Standard', quantity: 1.5, unit: 'lbs',
        quality: 'good', harvestDate: '2025-06-01', gardenBedId: bedIds.migardener },
    });
    expect(resp.status()).toBe(201);
  });

  test('S11-04: Harvest peas from Row Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'pea-1', variety: 'Sugar Snap', quantity: 4, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-06-01', gardenBedId: bedIds.row,
        notes: 'Great pea harvest. Clearing row for fall beans.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S11-05: Harvest lettuce from Trellis Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'lettuce-1', variety: 'Romaine', quantity: 2, unit: 'lbs',
        quality: 'good', harvestDate: '2025-06-01', gardenBedId: bedIds.trellis },
    });
    expect(resp.status()).toBe(201);
  });

  test('S11-06: Hive inspection — June', async () => {
    if (!beehiveId) return;
    const resp = await ctx.post('/api/hive-inspections', {
      data: { beehiveId, date: '2025-06-01', queenSeen: true,
        broodPattern: 'excellent', temperament: 'calm',
        notes: 'Strong colony. Adding super for honey production.' },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S11-07: Upload mid-season photo', async () => {
    const resp = await ctx.post('/api/photos', {
      multipart: {
        file: { name: 'june_garden.png', mimeType: 'image/png', buffer: createValidPNG() },
        caption: `Garden in full swing - Jun 1, 2025 ${RUN_ID}`,
        category: 'garden',
      },
    });
    expect(resp.status()).toBe(201);
  });

  test('S11-08: Log June eggs', async () => {
    if (!chickenId) return;
    for (const d of ['2025-06-02', '2025-06-09', '2025-06-16', '2025-06-23']) {
      await ctx.post('/api/egg-production', {
        data: { chickenId, eggsCollected: 32, date: d },
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 12: Jun 15 — Relay Plantings
  // ════════════════════════════════════════════════════════════════════

  test('S12-01: RELAY SFG — lettuce squares → lettuce #2 (rows 2-3)', async () => {
    await fillBedRegion(ctx, bedIds.sfg, 'lettuce-1', 'Butterhead #2', '2025-06-15', 0, 2, 3, 3);
  });

  test('S12-02: RELAY MIGardener — lettuce+arugula → lettuce #2 + arugula #2', async () => {
    test.setTimeout(120000);
    for (let row = 0; row < 16; row += 2) {
      await fillBedRegion(ctx, bedIds.migardener, 'lettuce-1', 'Mix #2', '2025-06-15', 0, row, 15, row);
    }
    for (let row = 16; row < 32; row += 2) {
      await fillBedRegion(ctx, bedIds.migardener, 'arugula-1', 'Standard #2', '2025-06-15', 0, row, 15, row);
    }
  });

  test('S12-03: RELAY Trellis — lettuce squares → bush beans (rows 0-3)', async () => {
    await fillBedRegion(ctx, bedIds.trellis, 'bean-1', 'Provider (trellis relay)', '2025-06-15', 0, 0, 3, 3);
  });

  test('S12-04: Turn compost — second turning', async () => {
    if (!compostPileId) return;
    const resp = await ctx.put(`/api/compost-piles/${compostPileId}`, {
      data: { lastTurned: true },
    });
    expect(resp.ok()).toBeTruthy();
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 13: Jul 1 — Beet/Pea Harvest, Relay, Honey
  // ════════════════════════════════════════════════════════════════════

  test('S13-01: Harvest beets from Intensive Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'beet-1', variety: 'Detroit Dark Red', quantity: 8, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-07-01', gardenBedId: bedIds.intensive,
        notes: 'Beautiful beets. Clearing space for fall turnips.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S13-02: RELAY Intensive — beet area → turnips (rows 0-7)', async () => {
    test.setTimeout(120000);
    await fillBedRegion(ctx, bedIds.intensive, 'turnip-1', 'Purple Top', '2025-07-15', 0, 0, 7, 7);
  });

  test('S13-03: RELAY Row — pea row → fall beans (rows 0-5)', async () => {
    test.setTimeout(60000);
    await fillBedRegion(ctx, bedIds.row, 'bean-1', 'Blue Lake #2 (fall)', '2025-07-01', 0, 0, 7, 5);
  });

  test('S13-04: Honey harvest — 10 lbs', async () => {
    if (!beehiveId) return;
    const resp = await ctx.post('/api/honey-harvests', {
      data: { beehiveId, date: '2025-07-01', quantity: 10, unit: 'lbs',
        notes: 'First honey harvest of the season! Light amber color.' },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S13-05: Hive inspection — July', async () => {
    if (!beehiveId) return;
    const resp = await ctx.post('/api/hive-inspections', {
      data: { beehiveId, date: '2025-07-01', queenSeen: true,
        broodPattern: 'good', temperament: 'calm',
        notes: 'Harvested one super. Colony still strong.' },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S13-06: Log July eggs', async () => {
    if (!chickenId) return;
    for (const d of ['2025-06-30', '2025-07-07', '2025-07-14', '2025-07-21']) {
      await ctx.post('/api/egg-production', {
        data: { chickenId, eggsCollected: 30, date: d },
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 14: Jul 15 — Compost Ready, Harvest Carrots, Relay
  // ════════════════════════════════════════════════════════════════════

  test('S14-01: Mark compost pile as ready', async () => {
    if (!compostPileId) return;
    const resp = await ctx.put(`/api/compost-piles/${compostPileId}`, {
      data: { status: 'ready' },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S14-02: Harvest carrots from SFG Bed', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'carrot-1', variety: 'Nantes', quantity: 6, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-07-15', gardenBedId: bedIds.sfg,
        notes: 'Sweet and crisp. 3.5 months from seed.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S14-03: RELAY SFG — carrot squares → fall radish (rows 6-7)', async () => {
    await fillBedRegion(ctx, bedIds.sfg, 'radish-1', 'Cherry Belle #2 (fall)', '2025-07-15', 0, 6, 3, 7);
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 15: Aug 1 — Major Harvest, More Relays
  // ════════════════════════════════════════════════════════════════════

  test('S15-01: Harvest tomatoes', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'tomato-1', variety: 'Brandywine', quantity: 12, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-08-01', gardenBedId: bedIds.sfg,
        notes: 'First big tomato harvest. Beautiful heirloom flavor.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S15-02: Harvest peppers', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'pepper-1', variety: 'Bell', quantity: 5, unit: 'lbs',
        quality: 'good', harvestDate: '2025-08-01', gardenBedId: bedIds.sfg },
    });
    expect(resp.status()).toBe(201);
  });

  test('S15-03: Harvest cucumbers', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'cucumber-1', variety: 'Marketmore', quantity: 8, unit: 'lbs',
        quality: 'excellent', harvestDate: '2025-08-01', gardenBedId: bedIds.trellis },
    });
    expect(resp.status()).toBe(201);
  });

  test('S15-04: Harvest corn', async () => {
    const resp = await ctx.post('/api/harvests', {
      data: { plantId: 'corn-1', variety: 'Golden Bantam', quantity: 24, unit: 'count',
        quality: 'good', harvestDate: '2025-08-01', gardenBedId: bedIds.row,
        notes: '2 ears per stalk average.' },
    });
    expect(resp.status()).toBe(201);
  });

  test('S15-05: RELAY Intensive — fall beets #2 (rows 0-3)', async () => {
    test.setTimeout(60000);
    await fillBedRegion(ctx, bedIds.intensive, 'beet-1', 'Detroit Dark Red #2 (fall)', '2025-08-01', 0, 0, 7, 3);
  });

  test('S15-06: Hive inspection — August', async () => {
    if (!beehiveId) return;
    const resp = await ctx.post('/api/hive-inspections', {
      data: { beehiveId, date: '2025-08-01', queenSeen: false,
        broodPattern: 'good', temperament: 'slightly defensive',
        notes: 'Queen not spotted but eggs present. Hot day, bees a bit agitated.' },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S15-07: Upload peak harvest photo', async () => {
    const resp = await ctx.post('/api/photos', {
      multipart: {
        file: { name: 'august_harvest.png', mimeType: 'image/png', buffer: createValidPNG() },
        caption: `Peak harvest! Tomatoes, peppers, cucumbers - Aug 1, 2025 ${RUN_ID}`,
        category: 'harvest',
      },
    });
    expect(resp.status()).toBe(201);
  });

  test('S15-08: Log August eggs', async () => {
    if (!chickenId) return;
    for (const d of ['2025-07-28', '2025-08-04', '2025-08-11', '2025-08-18']) {
      await ctx.post('/api/egg-production', {
        data: { chickenId, eggsCollected: 28, date: d },
      });
    }
  });

  test('S15-09: Garden snapshot at Aug 1 — all beds should have plants', async () => {
    const resp = await ctx.get('/api/garden-planner/garden-snapshot?date=2025-08-01');
    expect(resp.ok()).toBeTruthy();
    const snapshot = await resp.json();

    expect(snapshot.summary.totalPlants).toBeGreaterThan(0);
    // All 5 beds should have active plants
    expect(snapshot.summary.bedsWithPlants).toBeGreaterThanOrEqual(5);
  });

  test('S15-10: Verify harvest stats accumulating', async () => {
    const resp = await ctx.get('/api/harvests/stats');
    expect(resp.ok()).toBeTruthy();
    const stats = await resp.json();
    expect(stats).toBeDefined();

    // Total harvest count via listing
    const harvestsResp = await ctx.get('/api/harvests');
    const harvests = await harvestsResp.json();
    // Should have: radish, spinach, lettuce x3, arugula, peas, beets, carrots, tomato, pepper, cucumber, corn = 13+
    expect(harvests.length).toBeGreaterThanOrEqual(10);
  });
});
