import { test, expect, APIRequestContext } from '@playwright/test';
import { registerViaAPI, loginViaAPI, login } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';
const RUN_ID = Date.now().toString(36);

const LS_USER = {
  username: `ls_test_${RUN_ID}`,
  email: `ls_test_${RUN_ID}@test.com`,
  password: 'LsTest1!',
};

/**
 * Livestock — E2E Tests
 *
 * Covers: chickens CRUD, duck creation, beehive CRUD + inspections + honey harvests,
 * general livestock (goat) + health records, egg production, UI tab switching & cards.
 *
 * Strategy: API-first for data setup + UI verification in Livestock tab.
 */
test.describe.serial('Livestock — E2E Tests', () => {
  let ctx: APIRequestContext;

  // Track IDs across tests
  let chickenId: number;
  let chicken2Id: number;
  let duckId: number;
  let beehiveId: number;
  let goatId: number;

  // ── Setup: register user, login ────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    ctx = await playwright.request.newContext({ baseURL: BACKEND_URL });

    await registerViaAPI(ctx, LS_USER.username, LS_USER.email, LS_USER.password);
    await loginViaAPI(ctx, LS_USER.username, LS_USER.password);
  });

  test.afterAll(async () => {
    // Cleanup: delete all livestock for this user
    for (const endpoint of ['/api/chickens', '/api/ducks', '/api/beehives', '/api/livestock']) {
      const resp = await ctx.get(endpoint);
      if (resp.ok()) {
        const items = await resp.json();
        for (const item of items) {
          await ctx.delete(`${endpoint}/${item.id}`).catch(() => {});
        }
      }
    }
    await ctx.dispose();
  });

  // Helper: navigate to Livestock tab
  async function setupLivestock(page: import('@playwright/test').Page) {
    await page.goto('/');
    await login(page, LS_USER.username, LS_USER.password);
    await navigateTo(page, TABS.LIVESTOCK);
    // Wait for page to load (Add New button visible)
    await expect(page.locator('[data-testid="btn-add-livestock"]')).toBeVisible({ timeout: 10000 });
  }

  // ════════════════════════════════════════════════════════════════════
  // Suite 1: Chickens CRUD + Egg Production
  // ════════════════════════════════════════════════════════════════════

  test('LS-01: Create chicken via API', async () => {
    const resp = await ctx.post('/api/chickens', {
      data: {
        name: `Henny ${RUN_ID}`,
        breed: 'Rhode Island Red',
        quantity: 6,
        purpose: 'eggs',
        sex: 'female',
        coopLocation: 'Main Coop',
        notes: `E2E chicken ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const chicken = await resp.json();
    chickenId = chicken.id;

    expect(chicken.name).toBe(`Henny ${RUN_ID}`);
    expect(chicken.breed).toBe('Rhode Island Red');
    expect(chicken.quantity).toBe(6);
    expect(chicken.purpose).toBe('eggs');
    expect(chicken.sex).toBe('female');
    expect(chicken.coopLocation).toBe('Main Coop');
    expect(chicken.status).toBe('active');
  });

  test('LS-02: Create second chicken, verify GET returns both', async () => {
    const resp = await ctx.post('/api/chickens', {
      data: {
        name: `Clucky ${RUN_ID}`,
        breed: 'Leghorn',
        quantity: 3,
        purpose: 'dual',
        sex: 'mixed',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const chicken = await resp.json();
    chicken2Id = chicken.id;

    // GET all chickens
    const allResp = await ctx.get('/api/chickens');
    expect(allResp.ok()).toBeTruthy();
    const chickens = await allResp.json();
    expect(chickens.length).toBeGreaterThanOrEqual(2);

    const found = chickens.find((c: any) => c.id === chickenId);
    expect(found).toBeTruthy();
    expect(found.name).toBe(`Henny ${RUN_ID}`);
  });

  test('LS-03: Update chicken via API', async () => {
    const resp = await ctx.put(`/api/chickens/${chickenId}`, {
      data: {
        quantity: 8,
        notes: `Updated via E2E ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();

    // Verify via GET
    const getResp = await ctx.get(`/api/chickens/${chickenId}`);
    const chicken = await getResp.json();
    expect(chicken.quantity).toBe(8);
    expect(chicken.notes).toBe(`Updated via E2E ${RUN_ID}`);
  });

  test('LS-04: Add egg production record via API', async () => {
    const resp = await ctx.post('/api/egg-production', {
      data: {
        chickenId: chickenId,
        eggsCollected: 5,
        eggsSold: 1,
        eggsEaten: 3,
        notes: `E2E egg record ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const record = await resp.json();

    expect(record.chickenId).toBe(chickenId);
    expect(record.eggsCollected).toBe(5);
    expect(record.eggsSold).toBe(1);
    expect(record.eggsEaten).toBe(3);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 2: Ducks & Beehives
  // ════════════════════════════════════════════════════════════════════

  test('LS-05: Create duck via API', async () => {
    const resp = await ctx.post('/api/ducks', {
      data: {
        name: `Quackers ${RUN_ID}`,
        breed: 'Pekin',
        quantity: 4,
        purpose: 'eggs',
        sex: 'female',
        notes: `E2E duck ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const duck = await resp.json();
    duckId = duck.id;

    expect(duck.name).toBe(`Quackers ${RUN_ID}`);
    expect(duck.breed).toBe('Pekin');
    expect(duck.quantity).toBe(4);
    expect(duck.status).toBe('active');
  });

  test('LS-06: Create beehive via API', async () => {
    const resp = await ctx.post('/api/beehives', {
      data: {
        name: `Hive Alpha ${RUN_ID}`,
        type: 'Langstroth',
        queenMarked: true,
        queenColor: 'yellow',
        location: 'South Field',
        notes: `E2E beehive ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const hive = await resp.json();
    beehiveId = hive.id;

    expect(hive.name).toBe(`Hive Alpha ${RUN_ID}`);
    expect(hive.type).toBe('Langstroth');
    expect(hive.queenMarked).toBe(true);
    expect(hive.queenColor).toBe('yellow');
    expect(hive.location).toBe('South Field');
    expect(hive.status).toBe('active');
  });

  test('LS-07: Log hive inspection via API', async () => {
    const resp = await ctx.post('/api/hive-inspections', {
      data: {
        beehiveId: beehiveId,
        queenSeen: true,
        eggsSeen: true,
        broodPattern: 'excellent',
        temperament: 'calm',
        population: 'strong',
        honeyStores: 'full',
        notes: `E2E inspection ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const inspection = await resp.json();

    expect(inspection.beehiveId).toBe(beehiveId);
    expect(inspection.queenSeen).toBe(true);
    expect(inspection.broodPattern).toBe('excellent');
    expect(inspection.temperament).toBe('calm');
    expect(inspection.population).toBe('strong');
    expect(inspection.honeyStores).toBe('full');
  });

  test('LS-08: Log honey harvest via API', async () => {
    const resp = await ctx.post('/api/honey-harvests', {
      data: {
        beehiveId: beehiveId,
        framesHarvested: 4,
        honeyWeight: 12.5,
        waxWeight: 1.2,
        notes: `E2E honey harvest ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const harvest = await resp.json();

    expect(harvest.beehiveId).toBe(beehiveId);
    expect(harvest.framesHarvested).toBe(4);
    expect(harvest.honeyWeight).toBe(12.5);
    expect(harvest.waxWeight).toBe(1.2);
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 3: General Livestock & Health Records
  // ════════════════════════════════════════════════════════════════════

  test('LS-09: Create goat (general livestock) via API', async () => {
    const resp = await ctx.post('/api/livestock', {
      data: {
        name: `Billy ${RUN_ID}`,
        species: 'goat',
        breed: 'Nigerian Dwarf',
        sex: 'male',
        purpose: 'dairy',
        location: 'Pasture A',
        weight: 75,
        notes: `E2E goat ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const goat = await resp.json();
    goatId = goat.id;

    expect(goat.name).toBe(`Billy ${RUN_ID}`);
    expect(goat.species).toBe('goat');
    expect(goat.breed).toBe('Nigerian Dwarf');
    expect(goat.purpose).toBe('dairy');
    expect(goat.weight).toBe(75);
    expect(goat.status).toBe('active');
  });

  test('LS-10: Add health record via API', async () => {
    const resp = await ctx.post('/api/health-records', {
      data: {
        livestockId: goatId,
        type: 'vaccination',
        treatment: 'CDT Vaccine',
        medication: 'CDT Toxoid',
        dosage: '2ml',
        veterinarian: 'Dr. Smith',
        cost: 45.00,
        notes: `E2E health record ${RUN_ID}`,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const record = await resp.json();

    expect(record.livestockId).toBe(goatId);
    expect(record.type).toBe('vaccination');
    expect(record.treatment).toBe('CDT Vaccine');
    expect(record.medication).toBe('CDT Toxoid');
    expect(record.cost).toBe(45.00);
  });

  test('LS-11: Delete livestock via API, verify gone', async () => {
    // Delete the second chicken
    const resp = await ctx.delete(`/api/chickens/${chicken2Id}`);
    expect(resp.status()).toBe(204);

    // Verify it's gone from GET
    const allResp = await ctx.get('/api/chickens');
    const chickens = await allResp.json();
    const found = chickens.find((c: any) => c.id === chicken2Id);
    expect(found).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════════
  // Suite 4: UI Verification
  // ════════════════════════════════════════════════════════════════════

  test('LS-12: Chickens tab shows animal cards', async ({ page }) => {
    await setupLivestock(page);

    // Should default to chickens tab
    const chickensTab = page.locator('[data-testid="livestock-tab-chickens"]');
    await expect(chickensTab).toBeVisible();

    // Chicken card should be visible (Henny — the one we didn't delete)
    const chickenCard = page.locator(`[data-testid="animal-card-${chickenId}"]`);
    await expect(chickenCard).toBeVisible();

    // Card should show the chicken name
    await expect(chickenCard.locator('h3')).toHaveText(`Henny ${RUN_ID}`);
  });

  test('LS-13: Tab switching shows correct category', async ({ page }) => {
    await setupLivestock(page);

    // Switch to Ducks tab
    await page.locator('[data-testid="livestock-tab-ducks"]').click();
    await page.waitForTimeout(500);

    // Duck card should be visible
    const duckCard = page.locator(`[data-testid="animal-card-${duckId}"]`);
    await expect(duckCard).toBeVisible();
    await expect(duckCard.locator('h3')).toHaveText(`Quackers ${RUN_ID}`);

    // Switch to Beehives tab
    await page.locator('[data-testid="livestock-tab-bees"]').click();
    await page.waitForTimeout(500);

    // Hive card should be visible
    const hiveCard = page.locator(`[data-testid="hive-card-${beehiveId}"]`);
    await expect(hiveCard).toBeVisible();
    await expect(hiveCard.locator('h3')).toHaveText(`Hive Alpha ${RUN_ID}`);

    // Switch to Other tab
    await page.locator('[data-testid="livestock-tab-other"]').click();
    await page.waitForTimeout(500);

    // Goat card should be visible
    const goatCard = page.locator(`[data-testid="animal-card-${goatId}"]`);
    await expect(goatCard).toBeVisible();
    await expect(goatCard.locator('h3')).toHaveText(`Billy ${RUN_ID}`);
  });

  test('LS-14: Add New button opens modal with category-specific form', async ({ page }) => {
    await setupLivestock(page);

    // Click Add New on chickens tab
    await page.locator('[data-testid="btn-add-livestock"]').click();

    // Modal should open with "Add Chicken" title
    await expect(page.locator('text=Add Chicken').first()).toBeVisible({ timeout: 5000 });

    // Breed select should be visible (chicken-specific field)
    await expect(page.locator('text=Breed').first()).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Switch to Beehives tab and open modal
    await page.locator('[data-testid="livestock-tab-bees"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="btn-add-livestock"]').click();

    // Modal should show "Add Beehive"
    await expect(page.locator('text=Add Beehive').first()).toBeVisible({ timeout: 5000 });

    // Hive-specific field: "Hive Type" should be visible
    await expect(page.locator('text=Hive Type').first()).toBeVisible();

    await page.keyboard.press('Escape');
  });
});
