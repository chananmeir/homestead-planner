import { test, expect } from '@playwright/test';
import { ensureTestUser, login, loginViaAPI, TEST_USER } from './helpers/auth';
import { navigateTo, TABS } from './helpers/navigation';

const BACKEND_URL = 'http://localhost:5000';

test.describe.serial('E2E Core — Critical User Journeys', () => {
  // Shared state across serial tests
  const ts = Date.now();
  const bedName = `E2E-Bed-${ts}`;
  let bedId: number;
  let planId: number;

  // ── E2E-01: Login + Create Bed + Place Plant ─────────────────────────
  test('E2E-01: Login, create bed, place plant', async ({ page, request }) => {
    // 1. Ensure test user exists (idempotent)
    await ensureTestUser(request);
    // Also authenticate the request fixture for API calls later
    await loginViaAPI(request, TEST_USER.username, TEST_USER.password);

    // 2. Login via UI
    await page.goto('/');
    await login(page);
    await expect(page.getByText(`Welcome, ${TEST_USER.username}`)).toBeVisible({ timeout: 5000 });

    // 3. Navigate to Garden Designer
    await navigateTo(page, TABS.GARDEN_DESIGNER);

    // 4. Open bed creation modal
    const addBedBtn = page.locator('[data-testid="add-bed-btn"], button:has-text("Add Bed"), button:has-text("Create Your First Bed")');
    await addBedBtn.first().click();
    await expect(page.getByText('Add Garden Bed')).toBeVisible({ timeout: 5000 });

    // 5. Fill bed name, verify defaults
    await page.locator('#bed-name').fill(bedName);
    await expect(page.locator('#planning-method')).toHaveValue('square-foot');

    // 6. Submit
    await page.locator('[data-testid="create-bed-submit"]').click();
    await expect(page.getByText('Add Garden Bed')).not.toBeVisible({ timeout: 5000 });

    // 7. Verify bed appears in the "Active:" indicator (not the hidden <option>)
    await expect(
      page.locator('.bg-green-50', { hasText: bedName })
    ).toBeVisible({ timeout: 5000 });

    // 8. Get bed ID from API
    const bedsResponse = await request.get(`${BACKEND_URL}/api/garden-beds`);
    expect(bedsResponse.ok()).toBeTruthy();
    const beds = await bedsResponse.json();
    const createdBed = beds.find((b: { name: string }) => b.name === bedName);
    expect(createdBed).toBeTruthy();
    bedId = createdBed.id;

    // 9. Place plant at (0,0) via API
    const today = new Date().toISOString().split('T')[0];
    const placeResponse = await request.post(`${BACKEND_URL}/api/planted-items`, {
      data: {
        gardenBedId: bedId,
        plantId: 'tomato-1',
        position: { x: 0, y: 0 },
        quantity: 1,
        status: 'planned',
        plantedDate: today,
      },
    });
    expect(placeResponse.status()).toBe(201);

    // 10. Reload and verify plant persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await navigateTo(page, TABS.GARDEN_DESIGNER);

    // 11. Verify via API that planted item exists on the bed
    const bedDetailResponse = await request.get(`${BACKEND_URL}/api/garden-beds/${bedId}`);
    expect(bedDetailResponse.ok()).toBeTruthy();
    const bedDetail = await bedDetailResponse.json();
    const plantedItems = bedDetail.plantedItems || bedDetail.planted_items || [];
    expect(plantedItems.length).toBeGreaterThanOrEqual(1);
    const tomato = plantedItems.find((p: { plantId: string }) => p.plantId === 'tomato-1');
    expect(tomato).toBeTruthy();
  });

  // ── E2E-02: Conflict on Same-Cell Placement ─────────────────────────
  test('E2E-02: Conflict detection on same-cell placement', async ({ request }) => {
    // 1. Login via API (session cookie stored on request context)
    await loginViaAPI(request, TEST_USER.username, TEST_USER.password);

    // 2. Verify bed from E2E-01 exists
    expect(bedId).toBeDefined();

    // 3. Attempt to place a pepper at the SAME position (0,0) — should conflict
    const today = new Date().toISOString().split('T')[0];
    const conflictResponse = await request.post(`${BACKEND_URL}/api/planted-items`, {
      data: {
        gardenBedId: bedId,
        plantId: 'pepper-1',
        position: { x: 0, y: 0 },
        quantity: 1,
        status: 'planned',
        plantedDate: today,
      },
    });

    // 4. Assert 409 conflict
    expect(conflictResponse.status()).toBe(409);

    // 5. Assert response body has conflict details
    const body = await conflictResponse.json();
    expect(body.conflicts).toBeDefined();
    expect(body.conflicts.length).toBeGreaterThanOrEqual(1);

    // 6. Assert the conflict references the existing tomato plant
    const conflictNames = body.conflicts.map((c: { plantName?: string }) => c.plantName || '').join(' ');
    expect(conflictNames.toLowerCase()).toContain('tomato');
  });

  // ── E2E-03: Create Plan + Export + Verify Calendar ───────────────────
  test('E2E-03: Create plan, export to calendar, verify events', async ({ page, request }) => {
    // 1. Login via API
    await loginViaAPI(request, TEST_USER.username, TEST_USER.password);

    // 2. Verify bed exists from E2E-01
    expect(bedId).toBeDefined();

    // 3. Create plan via API
    const planResponse = await request.post(`${BACKEND_URL}/api/garden-plans`, {
      data: {
        name: `E2E Plan ${ts}`,
        year: 2026,
        items: [
          {
            plantId: 'lettuce-1',
            unitType: 'plants',
            targetValue: 16,
            plantEquivalent: 16,
            successionEnabled: false,
            successionCount: 1,
            bedAssignments: [{ bedId: bedId, quantity: 16 }],
            firstPlantDate: '2026-05-01',
          },
        ],
      },
    });
    expect(planResponse.status()).toBe(201);
    const plan = await planResponse.json();
    planId = plan.id;

    // 4. Export plan to calendar (with conflict override since tomato is there)
    const exportResponse = await request.post(
      `${BACKEND_URL}/api/garden-plans/${planId}/export-to-calendar`,
      { data: { conflictOverride: true } }
    );
    expect(exportResponse.status()).toBe(200);

    // 5. Verify export response has events
    const exportResult = await exportResponse.json();
    expect(exportResult.events_created || exportResult.eventsCreated).toBeGreaterThanOrEqual(1);

    // 6. Navigate to Planting Calendar in browser
    await page.goto('/');
    await login(page);
    await navigateTo(page, TABS.PLANTING_CALENDAR);

    // 7. Wait for loading to finish
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 5000 }).catch(() => {});

    // 8. Verify "Lettuce" text appears in the calendar view
    await expect(page.getByText('Lettuce').first()).toBeVisible({ timeout: 10000 });
  });
});
