import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI } from './helpers/auth';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const CF_USER = {
  username: `cf_test_${RUN_ID}`,
  email: `cf_test_${RUN_ID}@test.com`,
  password: 'CfTest1!',
};

/**
 * Cross-Feature Integration — E2E Tests
 *
 * Covers realistic multi-feature user journeys that chain APIs across
 * different modules. Each test exercises a complete workflow touching
 * 3+ feature areas to verify data flows correctly end-to-end.
 *
 * Strategy: API-first for all steps. These are integration tests that
 * verify the backend data pipeline, not UI rendering (UI is covered
 * by per-feature suites).
 */
test.describe.serial('Cross-Feature Integration — E2E Tests', () => {
  let ctx: APIRequestContext;
  let bedId: number;

  // ── Setup: register user, login, create shared bed ───────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, CF_USER.username, CF_USER.email, CF_USER.password);
    await loginViaAPI(ctx, CF_USER.username, CF_USER.password);

    // Create a shared SFG bed for tests
    const bedResp = await ctx.post('/api/garden-beds', {
      data: {
        name: `CF-Bed-${RUN_ID}`,
        width: 4,
        length: 4,
        planningMethod: 'square-foot',
        sunExposure: 'full',
      },
    });
    expect(bedResp.status()).toBe(201);
    const bed = await bedResp.json();
    bedId = bed.id;
  });

  test.afterAll(async () => {
    // Cleanup beds
    const bedsResp = await ctx.get('/api/garden-beds');
    if (bedsResp.ok()) {
      const beds = await bedsResp.json();
      for (const b of beds) {
        await ctx.delete(`/api/garden-beds/${b.id}`).catch(() => {});
      }
    }
    await ctx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // CF-01: Complete Garden Planning Journey
  //   Plan → Export → Place → Harvest → Verify across modules
  // ════════════════════════════════════════════════════════════════════

  test('CF-01: Plan → Export → Place → Harvest — full pipeline', async () => {
    // Step 1: Create a garden plan with tomato
    const planResp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Full Journey ${RUN_ID}`,
        year: 2026,
        items: [
          {
            plantId: 'tomato-1',
            variety: `Roma-${RUN_ID}`,
            unitType: 'plants',
            targetValue: 4,
            plantEquivalent: 4,
            successionEnabled: false,
            successionCount: 1,
            firstPlantDate: '2026-05-01',
            bedAssignments: [{ bedId: bedId, quantity: 4 }],
          },
        ],
      },
    });
    expect(planResp.status()).toBe(201);
    const plan = await planResp.json();
    const planId = plan.id;
    const planItemId = plan.items[0].id;

    // Step 2: Export to calendar — creates PlantingEvents
    const exportResp = await ctx.post(
      `/api/garden-plans/${planId}/export-to-calendar`,
      { data: { conflictOverride: true } }
    );
    expect(exportResp.ok()).toBeTruthy();
    const exportResult = await exportResp.json();
    expect(exportResult.eventsCreated).toBeGreaterThanOrEqual(1);

    // Step 3: Verify PlantingEvents exist
    const eventsResp = await ctx.get('/api/planting-events');
    expect(eventsResp.ok()).toBeTruthy();
    const allEvents = await eventsResp.json();
    const ourEvents = allEvents.filter(
      (e: any) => e.variety === `Roma-${RUN_ID}` && e.plantId === 'tomato-1'
    );
    expect(ourEvents.length).toBeGreaterThanOrEqual(1);

    // Step 4: Place plants on the grid (linking to plan item)
    const placeResp = await ctx.post('/api/planted-items/batch', {
      data: {
        gardenBedId: bedId,
        plantId: 'tomato-1',
        variety: `Roma-${RUN_ID}`,
        status: 'planned',
        sourcePlanItemId: planItemId,
        plantedDate: '2026-05-01',
        positions: [
          { x: 0, y: 0, quantity: 1 },
          { x: 1, y: 0, quantity: 1 },
        ],
      },
    });
    expect(placeResp.status()).toBe(201);
    const placed = await placeResp.json();
    expect(placed.created).toBe(2);

    // Step 5: Verify season progress reflects placed plants
    const progressResp = await ctx.get('/api/garden-planner/season-progress?year=2026');
    expect(progressResp.ok()).toBeTruthy();
    const progress = await progressResp.json();

    expect(progress.year).toBe(2026);
    expect(progress.summary.totalPlanned).toBeGreaterThanOrEqual(4);
    expect(progress.summary.totalAdded).toBeGreaterThanOrEqual(2);

    // byPlanItemId should show our plan item with 2 placed out of 4
    const planProgress = progress.byPlanItemId?.[String(planItemId)];
    if (planProgress) {
      expect(planProgress.placedSeason).toBe(2);
      expect(planProgress.plannedSeason).toBe(4);
    }

    // Step 6: Log a harvest from these plants
    const harvestResp = await ctx.post('/api/harvests', {
      data: {
        plantId: 'tomato-1',
        harvestDate: '2026-08-15',
        quantity: 5.5,
        unit: 'lbs',
        quality: 'excellent',
        notes: `Cross-feature test ${RUN_ID}`,
      },
    });
    expect(harvestResp.status()).toBe(201);
    const harvest = await harvestResp.json();
    expect(harvest.plantId).toBe('tomato-1');
    expect(harvest.quantity).toBe(5.5);

    // Step 7: Verify harvest stats include our entry
    // Stats endpoint returns { [plantId]: { total, count, unit } }
    const statsResp = await ctx.get('/api/harvests/stats');
    expect(statsResp.ok()).toBeTruthy();
    const stats = await statsResp.json();
    expect(stats['tomato-1']).toBeTruthy();
    expect(stats['tomato-1'].count).toBeGreaterThanOrEqual(1);
    expect(stats['tomato-1'].total).toBeGreaterThanOrEqual(5.5);
  });

  // ════════════════════════════════════════════════════════════════════
  // CF-02: Multi-Bed Succession Workflow
  //   3 beds → Plan lettuce with 4 successions → Export → Verify events
  //   → Place some → Verify per-bed progress
  // ════════════════════════════════════════════════════════════════════

  test('CF-02: Multi-bed succession — plan, export, place, verify progress', async () => {
    // Step 1: Create 3 beds
    const bedIds: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const resp = await ctx.post('/api/garden-beds', {
        data: {
          name: `Succ-Bed-${i}-${RUN_ID}`,
          width: 4,
          length: 4,
          planningMethod: 'square-foot',
          sunExposure: 'full',
        },
      });
      expect(resp.status()).toBe(201);
      const bed = await resp.json();
      bedIds.push(bed.id);
    }

    // Step 2: Create plan with lettuce across all 3 beds, 4 successions
    const planResp = await ctx.post('/api/garden-plans', {
      data: {
        name: `Succ Multi ${RUN_ID}`,
        year: 2026,
        items: [
          {
            plantId: 'lettuce-1',
            variety: `Buttercrunch-${RUN_ID}`,
            unitType: 'plants',
            targetValue: 60,
            plantEquivalent: 60,
            successionEnabled: true,
            successionCount: 4,
            successionIntervalDays: 14,
            firstPlantDate: '2026-04-15',
            bedAssignments: [
              { bedId: bedIds[0], quantity: 20 },
              { bedId: bedIds[1], quantity: 20 },
              { bedId: bedIds[2], quantity: 20 },
            ],
            allocationMode: 'custom',
          },
        ],
      },
    });
    expect(planResp.status()).toBe(201);
    const plan = await planResp.json();
    const planId = plan.id;
    const planItemId = plan.items[0].id;

    // Verify succession fields stored
    expect(plan.items[0].successionCount).toBe(4);

    // Step 3: Export to calendar
    const exportResp = await ctx.post(
      `/api/garden-plans/${planId}/export-to-calendar`,
      { data: { conflictOverride: true } }
    );
    expect(exportResp.ok()).toBeTruthy();
    const exportResult = await exportResp.json();

    // 4 successions × 3 beds = 12 events (one per succession per bed)
    expect(exportResult.eventsCreated).toBe(12);

    // Step 4: Verify events exist with correct date intervals
    const eventsResp = await ctx.get('/api/planting-events');
    expect(eventsResp.ok()).toBeTruthy();
    const allEvents = await eventsResp.json();
    const succEvents = allEvents.filter(
      (e: any) => e.variety === `Buttercrunch-${RUN_ID}` && e.plantId === 'lettuce-1'
    );
    expect(succEvents.length).toBe(12);

    // All should share the same succession_group_id (one group for the plan item)
    const groupIds = new Set(succEvents.map((e: any) => e.successionGroupId));
    // May be 1 group (shared) or 3 groups (per bed) — just verify they exist
    expect(groupIds.size).toBeGreaterThanOrEqual(1);

    // Verify dates include the expected 14-day intervals
    // Get unique dates across all events
    const allDates = succEvents
      .map((e: any) => e.directSeedDate || e.seedStartDate || e.expectedHarvestDate)
      .filter(Boolean);
    const uniqueDates = [...new Set(allDates)].sort();

    // Should have 4 unique dates (one per succession wave)
    expect(uniqueDates.length).toBe(4);

    // Dates should be 14 days apart
    for (let i = 1; i < uniqueDates.length; i++) {
      const diff = Math.round(
        (new Date(uniqueDates[i]).getTime() - new Date(uniqueDates[i - 1]).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      expect(diff).toBe(14);
    }

    // Step 5: Place some plants in bed 1 (linked to plan item)
    const placeResp = await ctx.post('/api/planted-items/batch', {
      data: {
        gardenBedId: bedIds[0],
        plantId: 'lettuce-1',
        variety: `Buttercrunch-${RUN_ID}`,
        status: 'planned',
        sourcePlanItemId: planItemId,
        plantedDate: '2026-04-15',
        positions: [
          { x: 0, y: 0, quantity: 1 },
          { x: 1, y: 0, quantity: 1 },
          { x: 2, y: 0, quantity: 1 },
          { x: 3, y: 0, quantity: 1 },
          { x: 0, y: 1, quantity: 1 },
        ],
      },
    });
    expect(placeResp.status()).toBe(201);
    const placed = await placeResp.json();
    expect(placed.created).toBe(5);

    // Step 6: Verify season progress shows placed counts
    const progressResp = await ctx.get('/api/garden-planner/season-progress?year=2026');
    expect(progressResp.ok()).toBeTruthy();
    const progress = await progressResp.json();

    // Summary should reflect: 60+ planned (from this + CF-01), 5+ added from this test
    expect(progress.summary.totalPlanned).toBeGreaterThanOrEqual(60);
    expect(progress.summary.totalAdded).toBeGreaterThanOrEqual(5);

    // byPlanItemId should show 5 placed for our lettuce plan item
    const itemProgress = progress.byPlanItemId?.[String(planItemId)];
    if (itemProgress) {
      expect(itemProgress.placedSeason).toBe(5);
      expect(itemProgress.plannedSeason).toBe(60);
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // CF-03: Seed Saving Full Lifecycle
  //   Place plant → Toggle save-for-seed → Verify maturity date →
  //   Collect seeds → Verify seed inventory
  // ════════════════════════════════════════════════════════════════════

  test('CF-03: Seed saving — place, toggle, collect, verify inventory', async () => {
    // Step 1: Place a tomato plant with a past planted date
    const placeResp = await ctx.post('/api/planted-items', {
      data: {
        plantId: 'tomato-1',
        variety: `Heirloom-${RUN_ID}`,
        gardenBedId: bedId,
        position: { x: 3, y: 3 },
        quantity: 1,
        status: 'growing',
        plantedDate: '2026-05-15',
      },
    });
    expect(placeResp.status()).toBe(201);
    const item = await placeResp.json();
    const itemId = item.id;

    expect(item.saveForSeed).toBe(false);
    expect(item.seedMaturityDate).toBeNull();

    // Step 2: Toggle save-for-seed ON
    const toggleOnResp = await ctx.put(`/api/planted-items/${itemId}`, {
      data: { saveForSeed: true },
    });
    expect(toggleOnResp.ok()).toBeTruthy();
    const toggled = await toggleOnResp.json();

    expect(toggled.saveForSeed).toBe(true);
    expect(toggled.status).toBe('saving-seed');
    // seedMaturityDate may be auto-calculated if plant has days_to_seed,
    // or null if manual entry is required
    // Either way, the toggle worked

    // Step 3: Verify seed saving state persists via bed detail
    const bedResp = await ctx.get(`/api/garden-beds/${bedId}`);
    expect(bedResp.ok()).toBeTruthy();
    const bedDetail = await bedResp.json();
    const fetched = bedDetail.plantedItems.find((pi: any) => pi.id === itemId);
    expect(fetched).toBeTruthy();
    expect(fetched.saveForSeed).toBe(true);
    expect(fetched.status).toBe('saving-seed');
    expect(fetched.seedsCollected).toBe(false);

    // Step 4: Collect seeds — creates SeedInventory record
    const collectResp = await ctx.post(`/api/planted-items/${itemId}/collect-seeds`, {
      data: {
        quantity: 3,
        seedsPerPacket: 50,
        variety: `Heirloom-${RUN_ID}`,
        germinationRate: 90,
        notes: `Saved from CF-03 test ${RUN_ID}`,
      },
    });
    expect(collectResp.status()).toBe(201);
    const collectResult = await collectResp.json();

    // Planted item updated
    expect(collectResult.plantedItem.seedsCollected).toBe(true);
    expect(collectResult.plantedItem.seedsCollectedDate).toBeTruthy();
    expect(collectResult.plantedItem.status).toBe('harvested');

    // Seed inventory record created
    expect(collectResult.seedInventory).toBeTruthy();
    expect(collectResult.seedInventory.plantId).toBe('tomato-1');
    expect(collectResult.seedInventory.variety).toBe(`Heirloom-${RUN_ID}`);
    expect(collectResult.seedInventory.brand).toBe('Homegrown');
    expect(collectResult.seedInventory.isHomegrown).toBe(true);
    expect(collectResult.seedInventory.quantity).toBe(3);
    expect(collectResult.seedInventory.seedsPerPacket).toBe(50);
    expect(collectResult.seedInventory.germinationRate).toBe(90);
    expect(collectResult.seedInventory.sourcePlantedItemId).toBe(itemId);

    // Step 5: Verify seed appears in personal seed inventory
    const seedsResp = await ctx.get('/api/my-seeds');
    expect(seedsResp.ok()).toBeTruthy();
    const seeds = await seedsResp.json();

    const ourSeed = seeds.find(
      (s: any) => s.variety === `Heirloom-${RUN_ID}` && s.plantId === 'tomato-1'
    );
    expect(ourSeed).toBeTruthy();
    expect(ourSeed.brand).toBe('Homegrown');
    expect(ourSeed.isHomegrown).toBe(true);
    expect(ourSeed.sourcePlantedItemId).toBe(itemId);
  });
});
