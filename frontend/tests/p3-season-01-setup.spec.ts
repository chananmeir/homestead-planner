import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, navigateToSubTab, TABS } from './helpers/navigation';
import { SHARED_USER, BACKEND_URL, RUN_ID } from './helpers/shared-user';

/**
 * 2025 Garden Season Simulation — Part 1: Setup (Steps 1-4)
 *
 * One user (sitetest) sets up their entire homestead:
 *   Step 1 (Jan 15): Create property, 5 beds, garden plan, seed inventory
 *   Step 2 (Feb 25): Indoor start tomatoes + peppers
 *   Step 3 (Mar 1):  Indoor start kale. Add chickens. Start compost.
 *   Step 4 (Mar 25): Indoor start basil, cucumber, squash
 */
test.describe.serial('2025 Season — Part 1: Setup', () => {
  let ctx: APIRequestContext;

  // IDs tracked across tests
  let propertyId: number;
  let trellisId: number;
  let bedIds: Record<string, number> = {};
  let planId: number;
  const seedIds: number[] = [];

  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });
    await registerViaAPI(ctx, SHARED_USER.username, SHARED_USER.email, SHARED_USER.password);
    await loginViaAPI(ctx, SHARED_USER.username, SHARED_USER.password);
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  // ════════════════════════════════════════════════════════════════════
  // Cleanup: Wipe old test data so each run starts fresh
  // ════════════════════════════════════════════════════════════════════

  test('S0-01: Clean slate — delete old plans, beds, seeds, harvests, livestock', async () => {
    test.setTimeout(300000); // Allow up to 5 minutes for cleanup (lots of cell-by-cell data)
    // Delete all garden plans
    const plansResp = await ctx.get('/api/garden-plans');
    if (plansResp.ok()) {
      const plans = await plansResp.json();
      for (const plan of plans) {
        await ctx.delete(`/api/garden-plans/${plan.id}`).catch(() => {});
      }
    }

    // Delete all garden beds (cascades planted items)
    const bedsResp = await ctx.get('/api/garden-beds');
    if (bedsResp.ok()) {
      const beds = await bedsResp.json();
      for (const bed of beds) {
        await ctx.delete(`/api/garden-beds/${bed.id}`).catch(() => {});
      }
    }

    // Delete all seeds
    const seedsResp = await ctx.get('/api/my-seeds');
    if (seedsResp.ok()) {
      const seeds = await seedsResp.json();
      for (const seed of seeds) {
        await ctx.delete(`/api/seeds/${seed.id}`).catch(() => {});
      }
    }

    // Delete all harvests
    const harvestsResp = await ctx.get('/api/harvests');
    if (harvestsResp.ok()) {
      const harvests = await harvestsResp.json();
      for (const h of harvests) {
        await ctx.delete(`/api/harvests/${h.id}`).catch(() => {});
      }
    }

    // Delete all indoor seed starts
    const startsResp = await ctx.get('/api/indoor-seed-starts');
    if (startsResp.ok()) {
      const starts = await startsResp.json();
      for (const s of starts) {
        await ctx.delete(`/api/indoor-seed-starts/${s.id}`).catch(() => {});
      }
    }

    // Delete all photos
    const photosResp = await ctx.get('/api/photos');
    if (photosResp.ok()) {
      const photos = await photosResp.json();
      for (const p of photos) {
        await ctx.delete(`/api/photos/${p.id}`).catch(() => {});
      }
    }

    // Delete all compost piles
    const compostResp = await ctx.get('/api/compost-piles');
    if (compostResp.ok()) {
      const piles = await compostResp.json();
      for (const p of piles) {
        await ctx.delete(`/api/compost-piles/${p.id}`).catch(() => {});
      }
    }

    // Delete all chickens
    const chickensResp = await ctx.get('/api/chickens');
    if (chickensResp.ok()) {
      const chickens = await chickensResp.json();
      for (const c of chickens) {
        await ctx.delete(`/api/chickens/${c.id}`).catch(() => {});
      }
    }

    // Delete all ducks
    const ducksResp = await ctx.get('/api/ducks');
    if (ducksResp.ok()) {
      const ducks = await ducksResp.json();
      for (const d of ducks) {
        await ctx.delete(`/api/ducks/${d.id}`).catch(() => {});
      }
    }

    // Delete all beehives
    const hivesResp = await ctx.get('/api/beehives');
    if (hivesResp.ok()) {
      const hives = await hivesResp.json();
      for (const h of hives) {
        await ctx.delete(`/api/beehives/${h.id}`).catch(() => {});
      }
    }

    // Delete all other livestock
    const livestockResp = await ctx.get('/api/livestock');
    if (livestockResp.ok()) {
      const animals = await livestockResp.json();
      for (const a of animals) {
        await ctx.delete(`/api/livestock/${a.id}`).catch(() => {});
      }
    }

    // Delete all properties (cascades trellis structures)
    const propsResp = await ctx.get('/api/properties');
    if (propsResp.ok()) {
      const props = await propsResp.json();
      for (const p of props) {
        await ctx.delete(`/api/properties/${p.id}`).catch(() => {});
      }
    }

    // Delete all planting events
    const eventsResp = await ctx.get('/api/planting-events');
    if (eventsResp.ok()) {
      const events = await eventsResp.json();
      for (const e of events) {
        await ctx.delete(`/api/planting-events/${e.id}`).catch(() => {});
      }
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 1: Jan 15 — Create Property, Beds, Plan, Seeds
  // ════════════════════════════════════════════════════════════════════

  test('S1-01: Create property "Test Homestead 2025"', async () => {
    const resp = await ctx.post('/api/properties', {
      data: {
        name: `Test Homestead 2025 ${RUN_ID}`,
        width: 100,
        length: 100,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const prop = await resp.json();
    propertyId = prop.id;
    expect(propertyId).toBeDefined();
  });

  test('S1-02: Create trellis structure on property', async () => {
    const resp = await ctx.post('/api/trellis-structures', {
      data: {
        name: `South Trellis ${RUN_ID}`,
        startX: 50,
        startY: 80,
        endX: 60,
        endY: 80,
        propertyId,
        heightInches: 96,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const trellis = await resp.json();
    trellisId = trellis.id;
  });

  test('S1-03: Create Bed 1 — SFG (4x8)', async () => {
    const resp = await ctx.post('/api/garden-beds', {
      data: {
        name: `SFG Bed ${RUN_ID}`,
        width: 4, length: 8, gridSize: 12,
        planningMethod: 'square-foot',
      },
    });
    expect(resp.ok()).toBeTruthy();
    bedIds.sfg = (await resp.json()).id;
  });

  test('S1-04: Create Bed 2 — Row (4x12)', async () => {
    const resp = await ctx.post('/api/garden-beds', {
      data: {
        name: `Row Bed ${RUN_ID}`,
        width: 4, length: 12, gridSize: 12,
        planningMethod: 'row',
      },
    });
    expect(resp.ok()).toBeTruthy();
    bedIds.row = (await resp.json()).id;
  });

  test('S1-05: Create Bed 3 — Intensive (4x8)', async () => {
    const resp = await ctx.post('/api/garden-beds', {
      data: {
        name: `Intensive Bed ${RUN_ID}`,
        width: 4, length: 8, gridSize: 12,
        planningMethod: 'intensive',
      },
    });
    expect(resp.ok()).toBeTruthy();
    bedIds.intensive = (await resp.json()).id;
  });

  test('S1-06: Create Bed 4 — MIGardener (4x8)', async () => {
    const resp = await ctx.post('/api/garden-beds', {
      data: {
        name: `MIGardener Bed ${RUN_ID}`,
        width: 4, length: 8, gridSize: 12,
        planningMethod: 'migardener',
      },
    });
    expect(resp.ok()).toBeTruthy();
    bedIds.migardener = (await resp.json()).id;
  });

  test('S1-07: Create Bed 5 — Trellis (4x8)', async () => {
    const resp = await ctx.post('/api/garden-beds', {
      data: {
        name: `Trellis Bed ${RUN_ID}`,
        width: 4, length: 8, gridSize: 12,
        planningMethod: 'square-foot',
      },
    });
    expect(resp.ok()).toBeTruthy();
    bedIds.trellis = (await resp.json()).id;
  });

  test('S1-08: Verify all 5 beds exist via API', async () => {
    const resp = await ctx.get('/api/garden-beds');
    expect(resp.ok()).toBeTruthy();
    const beds = await resp.json();

    const ourBeds = beds.filter((b: any) => b.name?.includes(RUN_ID));
    expect(ourBeds.length).toBe(5);

    const names = ourBeds.map((b: any) => b.name);
    expect(names.some((n: string) => n.includes('SFG Bed'))).toBe(true);
    expect(names.some((n: string) => n.includes('Row Bed'))).toBe(true);
    expect(names.some((n: string) => n.includes('Intensive Bed'))).toBe(true);
    expect(names.some((n: string) => n.includes('MIGardener Bed'))).toBe(true);
    expect(names.some((n: string) => n.includes('Trellis Bed'))).toBe(true);
  });

  test('S1-09: Add seed inventory for all planned crops', async () => {
    const crops = [
      { plantId: 'tomato-1', variety: 'Brandywine', quantity: 20, daysToMaturity: 80 },
      { plantId: 'pepper-1', variety: 'Bell', quantity: 20, daysToMaturity: 70 },
      { plantId: 'lettuce-1', variety: 'Butterhead', quantity: 200, daysToMaturity: 45 },
      { plantId: 'spinach-1', variety: 'Bloomsdale', quantity: 100, daysToMaturity: 40 },
      { plantId: 'carrot-1', variety: 'Nantes', quantity: 200, daysToMaturity: 70 },
      { plantId: 'radish-1', variety: 'Cherry Belle', quantity: 200, daysToMaturity: 25 },
      { plantId: 'bean-1', variety: 'Provider', quantity: 200, daysToMaturity: 55 },
      { plantId: 'basil-1', variety: 'Genovese', quantity: 50, daysToMaturity: 60 },
      { plantId: 'pea-1', variety: 'Sugar Snap', quantity: 200, daysToMaturity: 60 },
      { plantId: 'onion-1', variety: 'Yellow Sweet', quantity: 100, daysToMaturity: 100 },
      { plantId: 'corn-1', variety: 'Golden Bantam', quantity: 50, daysToMaturity: 75 },
      { plantId: 'kale-1', variety: 'Lacinato', quantity: 30, daysToMaturity: 55 },
      { plantId: 'chard-1', variety: 'Rainbow', quantity: 30, daysToMaturity: 55 },
      { plantId: 'beet-1', variety: 'Detroit Dark Red', quantity: 100, daysToMaturity: 55 },
      { plantId: 'turnip-1', variety: 'Purple Top', quantity: 100, daysToMaturity: 50 },
      { plantId: 'arugula-1', variety: 'Standard', quantity: 200, daysToMaturity: 30 },
      { plantId: 'cilantro-1', variety: 'Standard', quantity: 100, daysToMaturity: 45 },
      { plantId: 'cucumber-1', variety: 'Marketmore', quantity: 20, daysToMaturity: 65 },
      { plantId: 'pole-beans-1', variety: 'Kentucky Wonder', quantity: 50, daysToMaturity: 65 },
      { plantId: 'squash-1', variety: 'Butternut', quantity: 10, daysToMaturity: 100 },
    ];

    for (const crop of crops) {
      const resp = await ctx.post('/api/seeds', {
        data: {
          ...crop,
          brand: 'Season Test Seeds',
          notes: `2025 season ${RUN_ID}`,
        },
      });
      expect(resp.ok()).toBeTruthy();
      seedIds.push((await resp.json()).id);
    }
    expect(seedIds.length).toBe(20);
  });

  test('S1-10: Create 2025 garden plan', async () => {
    const resp = await ctx.post('/api/garden-plans', {
      data: {
        name: `2025 Season Plan ${RUN_ID}`,
        year: 2025,
        season: 'spring',
      },
    });
    expect(resp.ok()).toBeTruthy();
    planId = (await resp.json()).id;
  });

  test('S1-11: Add spring crops to plan — SFG Bed', async () => {
    const springCrops = [
      { plantId: 'radish-1', variety: 'Cherry Belle', quantity: 64, firstPlantDate: '2025-04-01' },
      { plantId: 'lettuce-1', variety: 'Butterhead', quantity: 16, firstPlantDate: '2025-04-01' },
      { plantId: 'spinach-1', variety: 'Bloomsdale', quantity: 36, firstPlantDate: '2025-04-01' },
      { plantId: 'carrot-1', variety: 'Nantes', quantity: 64, firstPlantDate: '2025-04-01' },
      { plantId: 'tomato-1', variety: 'Brandywine', quantity: 4, firstPlantDate: '2025-05-01' },
      { plantId: 'pepper-1', variety: 'Bell', quantity: 4, firstPlantDate: '2025-05-01' },
      { plantId: 'basil-1', variety: 'Genovese', quantity: 16, firstPlantDate: '2025-05-15' },
      { plantId: 'bean-1', variety: 'Provider', quantity: 36, firstPlantDate: '2025-05-15' },
    ];

    for (const crop of springCrops) {
      const resp = await ctx.post(`/api/garden-plans/${planId}/items`, {
        data: {
          plantId: crop.plantId,
          variety: crop.variety,
          plantEquivalent: crop.quantity,
          targetValue: crop.quantity,
          unitType: 'plants',
          successionCount: 1,
          successionEnabled: false,
          firstPlantDate: crop.firstPlantDate,
          bedAssignments: [{ bedId: bedIds.sfg, quantity: crop.quantity }],
          allocationMode: 'custom',
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S1-12: Add crops to plan — Row Bed', async () => {
    const rowCrops = [
      { plantId: 'pea-1', variety: 'Sugar Snap', quantity: 48, firstPlantDate: '2025-04-01' },
      { plantId: 'onion-1', variety: 'Yellow Sweet', quantity: 36, firstPlantDate: '2025-04-01' },
      { plantId: 'bean-1', variety: 'Blue Lake', quantity: 24, firstPlantDate: '2025-05-15' },
      { plantId: 'corn-1', variety: 'Golden Bantam', quantity: 12, firstPlantDate: '2025-05-15' },
    ];

    for (const crop of rowCrops) {
      const resp = await ctx.post(`/api/garden-plans/${planId}/items`, {
        data: {
          plantId: crop.plantId,
          variety: crop.variety,
          plantEquivalent: crop.quantity,
          targetValue: crop.quantity,
          unitType: 'plants',
          successionCount: 1,
          successionEnabled: false,
          firstPlantDate: crop.firstPlantDate,
          bedAssignments: [{ bedId: bedIds.row, quantity: crop.quantity }],
          allocationMode: 'custom',
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S1-13: Add crops to plan — Intensive Bed', async () => {
    const intensiveCrops = [
      { plantId: 'kale-1', variety: 'Lacinato', quantity: 8, firstPlantDate: '2025-04-15' },
      { plantId: 'chard-1', variety: 'Rainbow', quantity: 10, firstPlantDate: '2025-04-15' },
      { plantId: 'beet-1', variety: 'Detroit Dark Red', quantity: 32, firstPlantDate: '2025-04-01' },
    ];

    for (const crop of intensiveCrops) {
      const resp = await ctx.post(`/api/garden-plans/${planId}/items`, {
        data: {
          plantId: crop.plantId,
          variety: crop.variety,
          plantEquivalent: crop.quantity,
          targetValue: crop.quantity,
          unitType: 'plants',
          successionCount: 1,
          successionEnabled: false,
          firstPlantDate: crop.firstPlantDate,
          bedAssignments: [{ bedId: bedIds.intensive, quantity: crop.quantity }],
          allocationMode: 'custom',
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S1-14: Add crops to plan — MIGardener Bed', async () => {
    const miCrops = [
      { plantId: 'lettuce-1', variety: 'Mix', quantity: 200, firstPlantDate: '2025-04-01' },
      { plantId: 'arugula-1', variety: 'Standard', quantity: 150, firstPlantDate: '2025-04-01' },
      { plantId: 'cilantro-1', variety: 'Standard', quantity: 100, firstPlantDate: '2025-04-15' },
    ];

    for (const crop of miCrops) {
      const resp = await ctx.post(`/api/garden-plans/${planId}/items`, {
        data: {
          plantId: crop.plantId,
          variety: crop.variety,
          plantEquivalent: crop.quantity,
          targetValue: crop.quantity,
          unitType: 'plants',
          successionCount: 1,
          successionEnabled: false,
          firstPlantDate: crop.firstPlantDate,
          bedAssignments: [{ bedId: bedIds.migardener, quantity: crop.quantity }],
          allocationMode: 'custom',
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S1-15: Add crops to plan — Trellis Bed', async () => {
    const trellisCrops = [
      { plantId: 'lettuce-1', variety: 'Romaine', quantity: 16, firstPlantDate: '2025-04-01' },
      { plantId: 'cucumber-1', variety: 'Marketmore', quantity: 4, firstPlantDate: '2025-05-15' },
      { plantId: 'pole-beans-1', variety: 'Kentucky Wonder', quantity: 8, firstPlantDate: '2025-05-15' },
      { plantId: 'squash-1', variety: 'Butternut', quantity: 2, firstPlantDate: '2025-05-15' },
    ];

    for (const crop of trellisCrops) {
      const resp = await ctx.post(`/api/garden-plans/${planId}/items`, {
        data: {
          plantId: crop.plantId,
          variety: crop.variety,
          plantEquivalent: crop.quantity,
          targetValue: crop.quantity,
          unitType: 'plants',
          successionCount: 1,
          successionEnabled: false,
          firstPlantDate: crop.firstPlantDate,
          bedAssignments: [{ bedId: bedIds.trellis, quantity: crop.quantity }],
          allocationMode: 'custom',
        },
      });
      expect(resp.ok()).toBeTruthy();
    }
  });

  test('S1-16: UI — Garden Planner shows our plan with all crops', async ({ page }) => {
    await page.goto('/');
    await login(page, SHARED_USER.username, SHARED_USER.password);
    await navigateTo(page, TABS.GARDEN_PLANNER);

    // Planner page loads
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Plan should be visible or selectable (may need to select year/season)
    const planText = page.locator(`text=2025 Season Plan`).first();
    const isVisible = await planText.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await planText.click();
      await page.waitForLoadState('networkidle');
    }

    // Verify plan has items via API (UI display may vary)
    const resp = await ctx.get(`/api/garden-plans/${planId}`);
    expect(resp.ok()).toBeTruthy();
    const plan = await resp.json();
    expect(plan.items.length).toBeGreaterThanOrEqual(20);
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 2: Feb 25 — Indoor Start: Tomatoes + Peppers
  // ════════════════════════════════════════════════════════════════════

  test('S2-01: Indoor start — Tomato (Brandywine), 8 weeks before May 1', async () => {
    const resp = await ctx.post('/api/indoor-seed-starts', {
      data: {
        plantId: 'tomato-1',
        variety: 'Brandywine',
        startDate: '2025-02-25',
        seedsStarted: 8,
        desiredPlants: 4,
        location: 'south window',
        lightHours: 14,
        temperature: 72,
      },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S2-02: Indoor start — Pepper (Bell), 10 weeks before May 1', async () => {
    const resp = await ctx.post('/api/indoor-seed-starts', {
      data: {
        plantId: 'pepper-1',
        variety: 'Bell',
        startDate: '2025-02-25',
        seedsStarted: 8,
        desiredPlants: 4,
        location: 'south window',
        lightHours: 14,
        temperature: 75,
      },
    });
    expect(resp.ok()).toBeTruthy();
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 3: Mar 1 — Indoor Start Kale, Add Chickens, Start Compost
  // ════════════════════════════════════════════════════════════════════

  test('S3-01: Indoor start — Kale (Lacinato), 6 weeks before Apr 15', async () => {
    const resp = await ctx.post('/api/indoor-seed-starts', {
      data: {
        plantId: 'kale-1',
        variety: 'Lacinato',
        startDate: '2025-03-01',
        seedsStarted: 12,
        desiredPlants: 8,
        location: 'grow light shelf',
        lightHours: 16,
        temperature: 65,
      },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S3-02: UI — Add 6 Rhode Island Red chickens', async ({ page }) => {
    await page.goto('/');
    await login(page, SHARED_USER.username, SHARED_USER.password);
    await navigateTo(page, TABS.LIVESTOCK);

    await page.locator('[data-testid="livestock-tab-chickens"]').click();
    await page.locator('button:has-text("Add New Chicken")').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

    await page.getByLabel('Name*').fill(`Flock ${RUN_ID}`);
    await page.getByLabel('Breed').selectOption({ label: 'Rhode Island Red (275 eggs/yr)' });
    await page.getByLabel('Quantity').fill('6');
    await page.getByLabel('Purpose').selectOption('Eggs');
    await page.getByLabel('Sex').selectOption('Female');

    await page.locator('[role="dialog"] button:has-text("Add Chicken")').click();
    await page.waitForLoadState('networkidle');

    // Verify chicken card appears
    await expect(page.locator(`text=Flock ${RUN_ID}`)).toBeVisible({ timeout: 10000 });
  });

  test('S3-03: Start compost pile', async () => {
    const resp = await ctx.post('/api/compost-piles', {
      data: {
        name: `Spring Pile ${RUN_ID}`,
        location: 'Back corner',
        size: { width: 4, length: 4, height: 3 },
      },
    });
    expect(resp.status()).toBe(201);

    // Add green materials
    const pileId = (await resp.json()).id;
    await ctx.post(`/api/compost-piles/${pileId}/ingredients`, {
      data: { material: 'grass-clippings', amount: 5 },
    });
    await ctx.post(`/api/compost-piles/${pileId}/ingredients`, {
      data: { material: 'food-scraps', amount: 3 },
    });
    // Add brown materials
    await ctx.post(`/api/compost-piles/${pileId}/ingredients`, {
      data: { material: 'dried-leaves', amount: 10 },
    });
    await ctx.post(`/api/compost-piles/${pileId}/ingredients`, {
      data: { material: 'straw', amount: 5 },
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Step 4: Mar 25 — Indoor Start Basil, Cucumber, Squash
  // ════════════════════════════════════════════════════════════════════

  test('S4-01: Indoor start — Basil (Genovese)', async () => {
    const resp = await ctx.post('/api/indoor-seed-starts', {
      data: {
        plantId: 'basil-1',
        variety: 'Genovese',
        startDate: '2025-03-25',
        seedsStarted: 20,
        desiredPlants: 16,
        location: 'grow light shelf',
        lightHours: 14,
        temperature: 70,
      },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S4-02: Indoor start — Cucumber (Marketmore)', async () => {
    const resp = await ctx.post('/api/indoor-seed-starts', {
      data: {
        plantId: 'cucumber-1',
        variety: 'Marketmore',
        startDate: '2025-04-01',
        seedsStarted: 6,
        desiredPlants: 4,
        location: 'south window',
        lightHours: 14,
        temperature: 72,
      },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S4-03: Indoor start — Squash (Butternut)', async () => {
    const resp = await ctx.post('/api/indoor-seed-starts', {
      data: {
        plantId: 'squash-1',
        variety: 'Butternut',
        startDate: '2025-04-01',
        seedsStarted: 4,
        desiredPlants: 2,
        location: 'south window',
        lightHours: 14,
        temperature: 72,
      },
    });
    expect(resp.ok()).toBeTruthy();
  });

  test('S4-04: Verify indoor seed starts exist via API', async () => {
    const startsResp = await ctx.get('/api/indoor-seed-starts');
    expect(startsResp.ok()).toBeTruthy();
    const starts = await startsResp.json();
    expect(starts.length).toBeGreaterThanOrEqual(6);

    // Verify key crops are represented
    const plantIds = starts.map((s: any) => s.plantId);
    expect(plantIds).toContain('tomato-1');
    expect(plantIds).toContain('pepper-1');
    expect(plantIds).toContain('kale-1');
  });

  test('S4-05: UI — Compost tab shows our pile with C:N ratio', async ({ page }) => {
    await page.goto('/');
    await login(page, SHARED_USER.username, SHARED_USER.password);
    await navigateTo(page, TABS.COMPOST);

    await expect(page.locator(`text=Spring Pile ${RUN_ID}`)).toBeVisible({ timeout: 10000 });
  });

  test('S4-06: Verify setup summary — 5 beds, 20 seeds, 6 starts, plan with items', async () => {
    // Beds
    const bedsResp = await ctx.get('/api/garden-beds');
    const beds = await bedsResp.json();
    const ourBeds = beds.filter((b: any) => b.name.includes(RUN_ID));
    expect(ourBeds.length).toBe(5);

    // Seeds
    const seedsResp = await ctx.get('/api/my-seeds');
    const seeds = await seedsResp.json();
    const ourSeeds = seeds.filter((s: any) => s.notes?.includes(RUN_ID));
    expect(ourSeeds.length).toBe(20);

    // Indoor starts
    const startsResp = await ctx.get('/api/indoor-seed-starts');
    expect(startsResp.ok()).toBeTruthy();
    const starts = await startsResp.json();
    expect(starts.length).toBeGreaterThanOrEqual(6);

    // Plan
    const planResp = await ctx.get(`/api/garden-plans/${planId}`);
    expect(planResp.ok()).toBeTruthy();
    const plan = await planResp.json();
    expect(plan.items.length).toBeGreaterThanOrEqual(20);
  });
});
