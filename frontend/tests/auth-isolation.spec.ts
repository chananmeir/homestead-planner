import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';

// Two isolated test users — unique names to avoid collision with smoke tests
const USER_A = {
  username: 'isolation_user_a',
  email: 'isolation_a@test.com',
  password: 'IsolationA1!',
};

const USER_B = {
  username: 'isolation_user_b',
  email: 'isolation_b@test.com',
  password: 'IsolationB1!',
};

// Unique suffix to avoid collision across test runs
const RUN_ID = Date.now().toString(36);

// Track IDs created by User A for cross-user access tests
const userAIds: Record<string, number> = {};

test.describe.serial('Auth & Data Isolation', () => {
  let ctxA: APIRequestContext;
  let ctxB: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    // Create separate API contexts (separate cookie jars)
    ctxA = await playwright.request.newContext({ baseURL: BACKEND_URL });
    ctxB = await playwright.request.newContext({ baseURL: BACKEND_URL });

    // Register both users (idempotent)
    await registerViaAPI(ctxA, USER_A.username, USER_A.email, USER_A.password);
    await registerViaAPI(ctxB, USER_B.username, USER_B.email, USER_B.password);

    // Login both
    await loginViaAPI(ctxA, USER_A.username, USER_A.password);
    await loginViaAPI(ctxB, USER_B.username, USER_B.password);
  });

  test.afterAll(async () => {
    await ctxA?.dispose();
    await ctxB?.dispose();
  });

  // ── Step 1: User A creates test data across all features ──

  test('User A creates data across all features', async () => {
    // 1. Garden Bed
    const bedRes = await ctxA.post('/api/garden-beds', {
      data: {
        name: `IsolationBed-${RUN_ID}`,
        width: 4,
        length: 8,
        planningMethod: 'square-foot',
      },
    });
    expect(bedRes.status()).toBe(201);
    const bed = await bedRes.json();
    userAIds.bed = bed.id;

    // 2. Seed
    const seedRes = await ctxA.post('/api/seeds', {
      data: {
        plantId: 'tomato-1',
        variety: `IsolationVariety-${RUN_ID}`,
        isGlobal: false,
      },
    });
    expect(seedRes.status()).toBe(201);
    const seed = await seedRes.json();
    userAIds.seed = seed.id;

    // 3. Harvest
    const harvestRes = await ctxA.post('/api/harvests', {
      data: {
        plantId: 'tomato-1',
        harvestDate: new Date().toISOString(),
        quantity: 5,
        unit: 'lbs',
        notes: `isolation-${RUN_ID}`,
      },
    });
    expect(harvestRes.status()).toBe(201);
    const harvest = await harvestRes.json();
    userAIds.harvest = harvest.id;

    // 4. Compost Pile
    const compostRes = await ctxA.post('/api/compost-piles', {
      data: {
        name: `IsolationPile-${RUN_ID}`,
        location: 'Backyard',
        size: { width: 3, length: 3, height: 3 },
      },
    });
    expect(compostRes.status()).toBe(201);
    const compost = await compostRes.json();
    userAIds.compost = compost.id;

    // 5. Chicken
    const chickenRes = await ctxA.post('/api/chickens', {
      data: {
        name: `IsolationHen-${RUN_ID}`,
        breed: 'Rhode Island Red',
      },
    });
    expect(chickenRes.status()).toBe(201);
    const chicken = await chickenRes.json();
    userAIds.chicken = chicken.id;

    // 6. Garden Plan
    const planRes = await ctxA.post('/api/garden-plans', {
      data: {
        name: `IsolationPlan-${RUN_ID}`,
        year: 2026,
        season: 'spring',
      },
    });
    expect(planRes.status()).toBe(201);
    const plan = await planRes.json();
    userAIds.plan = plan.id;

    // 7. Property
    const propRes = await ctxA.post('/api/properties', {
      data: {
        name: `IsolationProperty-${RUN_ID}`,
        width: 100,
        length: 100,
      },
    });
    expect(propRes.status()).toBe(201);
    const prop = await propRes.json();
    userAIds.property = prop.id;
  });

  // ── Step 2: User B verifies zero visibility into User A data ──

  test('User B cannot see User A garden beds', async () => {
    const res = await ctxB.get('/api/garden-beds');
    expect(res.status()).toBe(200);
    const beds = await res.json();
    const leakedBed = beds.find(
      (b: { name: string }) => b.name === `IsolationBed-${RUN_ID}`,
    );
    expect(leakedBed).toBeUndefined();
  });

  test('User B cannot see User A seeds', async () => {
    const res = await ctxB.get('/api/my-seeds');
    expect(res.status()).toBe(200);
    const seeds = await res.json();
    const leakedSeed = seeds.find(
      (s: { variety: string }) => s.variety === `IsolationVariety-${RUN_ID}`,
    );
    expect(leakedSeed).toBeUndefined();
  });

  test('User B cannot see User A harvests', async () => {
    const res = await ctxB.get('/api/harvests');
    expect(res.status()).toBe(200);
    const harvests = await res.json();
    const leakedHarvest = harvests.find(
      (h: { notes: string }) => h.notes === `isolation-${RUN_ID}`,
    );
    expect(leakedHarvest).toBeUndefined();
  });

  test('User B cannot see User A compost piles', async () => {
    const res = await ctxB.get('/api/compost-piles');
    expect(res.status()).toBe(200);
    const piles = await res.json();
    const leakedPile = piles.find(
      (p: { name: string }) => p.name === `IsolationPile-${RUN_ID}`,
    );
    expect(leakedPile).toBeUndefined();
  });

  test('User B cannot see User A chickens', async () => {
    const res = await ctxB.get('/api/chickens');
    expect(res.status()).toBe(200);
    const chickens = await res.json();
    const leakedChicken = chickens.find(
      (c: { name: string }) => c.name === `IsolationHen-${RUN_ID}`,
    );
    expect(leakedChicken).toBeUndefined();
  });

  test('User B cannot see User A garden plans', async () => {
    const res = await ctxB.get('/api/garden-plans');
    expect(res.status()).toBe(200);
    const plans = await res.json();
    const leakedPlan = plans.find(
      (p: { name: string }) => p.name === `IsolationPlan-${RUN_ID}`,
    );
    expect(leakedPlan).toBeUndefined();
  });

  test('User B cannot see User A properties', async () => {
    const res = await ctxB.get('/api/properties');
    expect(res.status()).toBe(200);
    const props = await res.json();
    const leakedProp = props.find(
      (p: { name: string }) => p.name === `IsolationProperty-${RUN_ID}`,
    );
    expect(leakedProp).toBeUndefined();
  });

  // ── Step 3: User B creates own data, verifies isolation ──

  test('User B creates own data and only sees own', async () => {
    // Create User B's bed
    const bedRes = await ctxB.post('/api/garden-beds', {
      data: {
        name: `UserB-Bed-${RUN_ID}`,
        width: 4,
        length: 4,
        planningMethod: 'square-foot',
      },
    });
    expect(bedRes.status()).toBe(201);

    // List beds — should see ONLY User B's bed, not User A's
    const listRes = await ctxB.get('/api/garden-beds');
    const beds = await listRes.json();
    const bedNames: string[] = beds.map((b: { name: string }) => b.name);
    expect(bedNames).toContain(`UserB-Bed-${RUN_ID}`);
    expect(bedNames).not.toContain(`IsolationBed-${RUN_ID}`);

    // Meanwhile, User A still sees only their own bed
    const listA = await ctxA.get('/api/garden-beds');
    const bedsA = await listA.json();
    const bedNamesA: string[] = bedsA.map((b: { name: string }) => b.name);
    expect(bedNamesA).toContain(`IsolationBed-${RUN_ID}`);
    expect(bedNamesA).not.toContain(`UserB-Bed-${RUN_ID}`);
  });

  // ── Step 4: Direct ID access returns 403 ──

  test('Direct ID access returns 403 for other user', async () => {
    // User B tries to access User A's bed by ID
    const bedRes = await ctxB.get(`/api/garden-beds/${userAIds.bed}`);
    expect(bedRes.status()).toBe(403);

    // User B tries to access User A's compost pile by ID
    const compostRes = await ctxB.get(`/api/compost-piles/${userAIds.compost}`);
    expect(compostRes.status()).toBe(403);

    // User B tries to access User A's chicken by ID
    const chickenRes = await ctxB.get(`/api/chickens/${userAIds.chicken}`);
    expect(chickenRes.status()).toBe(403);

    // User B tries to access User A's property by ID
    const propRes = await ctxB.get(`/api/properties/${userAIds.property}`);
    expect(propRes.status()).toBe(403);

    // Garden plans return 404 instead of 403 (by design — don't reveal existence)
    const planRes = await ctxB.get(`/api/garden-plans/${userAIds.plan}`);
    expect(planRes.status()).toBe(404);
  });

  // ── Step 5: UI test — User A only sees own beds ──

  test('UI - User A only sees own beds in designer', async ({ page }) => {
    await page.goto('/');
    await login(page, USER_A.username, USER_A.password);
    await navigateTo(page, TABS.GARDEN_DESIGNER);

    // Bed names appear as <option> elements in a <select> dropdown,
    // which Playwright considers "hidden". Use toBeAttached instead.
    const userAOption = page.locator(`option:has-text("IsolationBed-${RUN_ID}")`);
    await expect(userAOption).toBeAttached({ timeout: 15000 });

    // User B's bed should NOT exist in the dropdown
    const userBOption = page.locator(`option:has-text("UserB-Bed-${RUN_ID}")`);
    await expect(userBOption).not.toBeAttached();
  });
});
